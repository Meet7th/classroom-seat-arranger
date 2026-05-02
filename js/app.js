// ==================== Global State ====================
const state = {
    rows: 7, cols: 11,
    seats: [],
    drawOrder: [],
    currentDrawIndex: 0,
    platformLeft: { disabled: false, student: null, type: 'platform-left', number: 0, row: -1, col: -1 },
    platformRight: { disabled: false, student: null, type: 'platform-right', number: -1, row: -1, col: -2 },
    showDoors: true, doorPosition: 'right', showPlatformLeft: true, showPlatformRight: true,
    students: [], drawnStudents: [], remainingStudents: [],
    blacklist: [], whitelist: [], history: [],
    plugins: {},
    selectedSeat: null, swapMode: false,
    heatmapVisible: false, heatmapType: 'composite',
    batchMode: false, batchSeats: [],
    poolFilter: 'all', poolSearch: '',
    selectedPoolStudent: null,
    // Subject definitions (expandable)
    subjects: ['语文', '数学', '英语', '物理', '化学', '历史', '地理', '政治', '生物'],
    // Personality types
    personalityTypes: ['外向', '内向', '中性'],
    // Class positions
    classPositions: ['班长', '副班长', '学习委员', '体育委员', '文艺委员', '劳动委员', '小组长', '课代表'],
    settings: {
        numberingMode: 'horizontal-snake',
        maleMapping: '男', femaleMapping: '女',
        blacklistPenalty: 95, blacklistRadius: 2,
        whitelistDeskBonus: 200, whitelistFrontBackBonus: 120,
        whitelistDiagonalBonus: 60, whitelistFallbackBonus: 150,
        drawMode: 'predictable', genderBalance: true, antiCluster: true,
        lunchUnderlineColor: '#007AFF', seatFontSize: 13,
        drawAnimationDuration: 400, screenshotBgColor: '#ffffff',
        screenshotTransparentBg: false,
        exportIncludeGender: true, exportIncludeLunch: true,
        exportIncludeSeatNumber: true,
        enableDragDrop: true, enableClickSwap: true,
        showStatsByDefault: true, showProbabilityByDefault: true,
        autoDrawInterval: 800,
        theme: '', accentColor: '#007AFF',
        // Quick info bar items visibility
        quickInfoItems: {
            layout: true, total: true, drawn: true, remaining: true,
            male: true, female: true, lunch: true
        },
        // Composite evaluation weights
        weights: {
            academic: 60,       // 学业成绩权重
            personality: 15,    // 性格互补权重
            hobby: 10,          // 爱好搭配权重
            position: 10,       // 职务平衡权重
            gender: 5           // 性别均衡权重
        }
    }
};

// ==================== Undo/Redo System ====================
const UndoManager = {
    stack: [], redoStack: [], maxStack: 50,
    push(action) {
        this.stack.push(action);
        if (this.stack.length > this.maxStack) this.stack.shift();
        this.redoStack = [];
        this.updateButtons();
    },
    undo() {
        if (this.stack.length === 0) return;
        const action = this.stack.pop();
        this.redoStack.push(action);
        action.undo();
        this.updateButtons();
        Toast.info('已撤销: ' + action.desc);
        addLog('↩️', '撤销: ' + action.desc);
    },
    redo() {
        if (this.redoStack.length === 0) return;
        const action = this.redoStack.pop();
        this.stack.push(action);
        action.redo();
        this.updateButtons();
        Toast.info('已重做: ' + action.desc);
    },
    updateButtons() {
        document.getElementById('undoBtn').style.opacity = this.stack.length > 0 ? '1' : '0.3';
        document.getElementById('redoBtn').style.opacity = this.redoStack.length > 0 ? '1' : '0.3';
    }
};

// ==================== Operation Log ====================
const opLogs = [];
function addLog(icon, text) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    opLogs.unshift({ icon, text, time });
    if (opLogs.length > 100) opLogs.pop();
    renderLogList();
}
function renderLogList() {
    const el = document.getElementById('logList');
    if (opLogs.length === 0) { el.innerHTML = '<div class="log-empty">暂无操作记录</div>'; return; }
    el.innerHTML = opLogs.slice(0, 50).map(l =>
        `<div class="log-item"><span class="log-icon">${l.icon}</span><span>${escapeHtml(l.text)}</span><span class="log-time">${l.time}</span></div>`
    ).join('');
}

// ==================== Toast ====================
const Toast = {
    show(message, type = 'success', duration = 2500) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toast-out 0.3s ease-out forwards';
            setTimeout(() => { if (toast.parentNode) container.removeChild(toast); }, 300);
        }, duration);
    },
    success(m) { this.show(m, 'success'); },
    error(m) { this.show(m, 'error'); },
    warning(m) { this.show(m, 'warning'); },
    info(m) { this.show(m, 'info'); }
};

// ==================== Utils ====================
function debounce(func, wait) {
    let timeout;
    return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); };
}
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function formatTime(d) { return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; }
// [AUDIT-1] XSS escape utility
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ==================== Draggable Panels ====================
function makeDraggable(element) {
    const dragState = { isDragging: false, initialX: 0, initialY: 0, xOffset: 0, yOffset: 0 };
    const onStart = (clientX, clientY, e) => {
        if (e.target.closest('.island-close,.probability-close,.probability-toggle-btn')) return;
        dragState.isDragging = true;
        dragState.initialX = clientX - dragState.xOffset;
        dragState.initialY = clientY - dragState.yOffset;
    };
    const onMove = (clientX, clientY, ev) => {
        if (!dragState.isDragging) return;
        if (ev) ev.preventDefault();
        dragState.xOffset = clientX - dragState.initialX;
        dragState.yOffset = clientY - dragState.initialY;
        element.style.transform = `translate(${dragState.xOffset}px,${dragState.yOffset}px)`;
    };
    const onEnd = () => { dragState.isDragging = false; };
    element.addEventListener('mousedown', e => {
        onStart(e.clientX, e.clientY, e);
        const move = ev => onMove(ev.clientX, ev.clientY, ev);
        const end = () => { onEnd(); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', end); };
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', end);
    });
    element.addEventListener('touchstart', e => {
        e.preventDefault(); // [FIX #4] Prevent scroll during drag
        onStart(e.touches[0].clientX, e.touches[0].clientY, e);
        const move = ev => onMove(ev.touches[0].clientX, ev.touches[0].clientY, ev);
        const end = () => { onEnd(); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); };
        document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', end);
    }, { passive: false });
}

// ==================== Plugin Manager ====================
const PluginManager = {
    register(name, plugin) {
        if (state.plugins[name]) { Toast.warning(`插件 ${plugin.name} 已存在`); return; }
        state.plugins[name] = { ...plugin, enabled: plugin.defaultEnabled !== false, settings: { ...(plugin.defaultSettings || {}) } };
        if (state.plugins[name].init) {
            try { state.plugins[name].init(); }
            catch (err) { console.error(`插件 ${name} 初始化失败`, err); Toast.error(`插件 ${plugin.name} 初始化失败`); delete state.plugins[name]; return; }
        }
        this.renderPluginsList();
        Toast.success(`插件 ${plugin.name} 已安装`);
    },
    isEnabled(name) { return state.plugins[name] && state.plugins[name].enabled; },
    call(name, method, ...args) {
        if (this.isEnabled(name) && state.plugins[name][method]) {
            try { return state.plugins[name][method](...args); }
            catch (err) { console.error(`插件 ${name}.${method} 失败`, err); Toast.error(`插件调用失败`); }
        }
    },
    getPluginSettings(name) { return state.plugins[name]?.settings || {}; },
    uninstall(name) {
        if (state.plugins[name]) {
            const pn = state.plugins[name].name;
            delete state.plugins[name];
            this.renderPluginsList();
            Toast.success(`插件 ${pn} 已卸载`);
        }
    },
    renderPluginsList() {
        const container = document.getElementById('pluginsList');
        container.innerHTML = '';
        Object.entries(state.plugins).forEach(([name, plugin]) => {
            const isSystem = plugin.isSystem;
            const securityIcon = plugin.securityStatus === 'ok' ? '🛡️' : plugin.securityStatus === 'risk' ? '⚠️' : '';
            const div = document.createElement('div');
            div.className = 'plugin-item';
            div.innerHTML = `
                <div class="plugin-info">
                    <div class="plugin-name">${isSystem ? '⭐ ' : ''}${escapeHtml(plugin.name)} <span style="font-size:10px;color:var(--text-tertiary);">v${escapeHtml(plugin.version)}</span> ${securityIcon}</div>
                    <div class="plugin-desc">${escapeHtml(plugin.description)}${plugin.securityStatus === 'risk' ? ' <span style="color:var(--warning);">[风险]</span>' : ''}</div>
                </div>
                <div class="plugin-actions">
                    ${plugin.hasSettings ? `<button class="btn btn-secondary btn-icon plugin-settings-btn" data-plugin="${name}">⚙</button>` : ''}
                    ${!isSystem ? `<button class="btn btn-danger btn-icon plugin-uninstall-btn" data-plugin="${name}">✕</button>` : ''}
                    <label class="switch"><input type="checkbox" ${plugin.enabled ? 'checked' : ''} data-plugin="${name}" ${isSystem ? 'disabled' : ''}><span class="slider"></span></label>
                </div>`;
            container.appendChild(div);
        });
        container.querySelectorAll('input[type="checkbox"]:not([disabled])').forEach(cb => {
            cb.addEventListener('change', e => {
                const pn = e.target.dataset.plugin;
                state.plugins[pn].enabled = e.target.checked;
                Toast.success(`${state.plugins[pn].name} 已${e.target.checked ? '启用' : '禁用'}`);
            });
        });
        container.querySelectorAll('.plugin-settings-btn').forEach(btn => {
            btn.addEventListener('click', e => this.openPluginSettings(e.target.dataset.plugin));
        });
        container.querySelectorAll('.plugin-uninstall-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const pn = e.target.dataset.plugin;
                if (confirm(`确定卸载 ${state.plugins[pn].name}？`)) this.uninstall(pn);
            });
        });
    },
    openPluginSettings(pluginName) {
        const plugin = state.plugins[pluginName];
        document.getElementById('pluginSettingsTitle').textContent = `${plugin.name} 设置`;
        const content = document.getElementById('pluginSettingsContent');
        content.innerHTML = '';
        if (plugin.renderSettings) plugin.renderSettings(content, plugin.settings);
        else content.innerHTML = '<p style="color:var(--text-tertiary);">该插件暂无设置选项</p>';
        document.getElementById('pluginSettingsModal').classList.add('active');
    },
    getBlankTemplate() {
        return `const MyPlugin = {
    name: "我的插件", description: "插件功能描述", version: "1.0.0",
    defaultEnabled: true, hasSettings: false, defaultSettings: {},
    renderSettings(container, settings) { container.innerHTML = '<p>设置内容</p>'; },
    saveSettings() {},
    init() { console.log("插件初始化"); },
    beforeDraw(availableStudents, probabilities, nextSeat) {
        return { availableStudents, probabilities };
    },
    afterDraw(student, seat) {},
    beforeExport(data) { return data; }
};
PluginManager.register('my-plugin', MyPlugin);`;
    }
};

// ==================== AI Plugin Development Doc Generator ====================
function generateAiDevDoc() {
    return `# 座位编排系统 - AI 插件开发文档 v${ModuleRegistry.systemVersion}

> 本文档供 AI 助手参考，用于为用户生成插件代码。
> 请严格遵守安全规范，不得生成任何恶意代码。

## 一、系统概述

本系统是一个教室座位智能编排系统，支持：
- 多维度学生数据（多科成绩、性格、爱好、职务）
- 概率公平抽取算法
- 成绩热力图可视化
- 智能座位推荐

## 二、插件结构

\`\`\`javascript
const MyPlugin = {
    name: "插件名称",           // 显示名称（必填）
    description: "功能描述",    // 简要描述（必填）
    version: "1.0.0",          // 语义化版本号（必填）
    author: "作者名",           // 作者（可选）
    dependencies: [],           // 依赖的其他插件ID（可选）
    permissions: ['core.read'], // 所需权限声明（见下方）

    defaultEnabled: true,       // 默认启用
    hasSettings: false,         // 是否有设置面板
    defaultSettings: {},        // 默认设置

    // 生命周期
    init() { /* 插件初始化，系统启动时调用 */ },
    destroy() { /* 插件销毁，卸载时调用 */ },

    // 核心钩子
    beforeDraw(availableStudents, probabilities, nextSeat) {
        // 在每次抽取前调用
        // 可修改概率分布
        // 必须返回 { availableStudents, probabilities }
        return { availableStudents, probabilities };
    },
    afterDraw(student, seat) {
        // 在每次抽取后调用
        // student: 被抽中的学生对象
        // seat: 被分配的座位对象
    },
    beforeExport(data) {
        // 在导出数据前调用
        // 可修改导出内容
        // 必须返回 data
        return data;
    },

    // 设置面板渲染（hasSettings=true时生效）
    renderSettings(container, settings) {
        container.innerHTML = '<p>设置内容</p>';
    },
    saveSettings() { /* 保存设置 */ }
};
PluginManager.register('my-plugin', MyPlugin);
\`\`\`

## 三、权限系统

### 权限列表
| 权限ID | 说明 | 风险等级 |
|--------|------|----------|
| core.read | 读取核心数据（学生、座位、配置） | 低 |
| core.write | 修改核心数据 | 中 |
| ui.toast | 显示提示消息 | 低 |
| ui.modal | 显示弹窗 | 低 |
| ui.render | 渲染自定义UI | 低 |
| data.students | 访问学生数据 | 中 |
| data.seats | 修改座位安排 | 中 |
| data.export | 导出数据 | 低 |
| storage.local | 使用本地存储 | 中 |
| network.fetch | 网络请求 | ⚠️ 高危 |
| system.eval | 动态执行代码 | ⚠️ 高危 |

### 安全规则（必须遵守）

1. **禁止**使用 \`eval()\`、\`new Function()\` 动态执行代码
2. **禁止**使用 \`fetch()\`、\`XMLHttpRequest\` 发送网络请求（除非用户明确授权）
3. **禁止**访问 \`document.cookie\`
4. **禁止**使用 \`document.write()\`
5. **禁止**修改 \`window.location\` 进行页面跳转
6. **禁止**访问地理位置、摄像头、麦克风等敏感API
7. **禁止**生成任何形式的恶意代码、数据窃取代码、键盘记录器
8. **禁止**生成绕过安全检测的代码
9. **推荐**使用 \`Toast.success()\` 显示提示
10. **推荐**使用 \`addLog()\` 记录操作日志

### 权限声明示例
\`\`\`javascript
permissions: ['core.read', 'data.students', 'ui.toast']
\`\`\`

## 四、可用 API

### 数据访问
- \`state.students\` - 学生列表（只读推荐）
- \`state.drawnStudents\` - 已抽取学生
- \`state.remainingStudents\` - 未抽取学生
- \`state.seats\` - 座位列表
- \`state.settings\` - 系统配置

### 学生对象结构
\`\`\`javascript
{
    id: Number,          // 唯一ID
    name: String,        // 姓名
    gender: 'male'|'female',
    lunch: Boolean,      // 是否午休
    pinned: Boolean,     // 是否固定
    score: Number|null,  // 综合成绩（兼容旧版）
    scores: {            // 多科成绩
        '语文': 85,
        '数学': 92,
        '英语': 78
    },
    personality: '外向'|'内向'|'中性'|null,
    hobbies: ['篮球', '绘画'],  // 爱好列表
    position: '班长'|'学习委员'|null  // 班级职务
}
\`\`\`

### 座位对象结构
\`\`\`javascript
{
    element: HTMLElement, // DOM元素
    number: Number,      // 座位编号
    row: Number,         // 行号（0开始）
    col: Number,         // 列号（0开始）
    disabled: Boolean,   // 是否禁用
    student: Object|null,// 坐在此座位的学生
    type: 'normal'|'platform-left'|'platform-right'
}
\`\`\`

### UI 工具
- \`Toast.success(msg)\` / \`Toast.error(msg)\` / \`Toast.warning(msg)\` / \`Toast.info(msg)\`
- \`addLog(icon, text)\` - 添加操作日志
- \`document.getElementById(id)\` - 访问DOM

### 综合评价 API
- \`CompositeEval.getScore(student)\` - 获取综合评价分数
- \`CompositeEval.getAvgScore(student)\` - 获取平均成绩
- \`CompositeEval.peerInfluence(s1, s2)\` - 计算两名学生的良性影响分

## 五、插件类型

| 类型 | 说明 | 示例 |
|------|------|------|
| algorithm | 抽取/分配算法 | 自定义抽取策略 |
| visualization | 数据可视化 | 自定义图表 |
| notification | 通知提醒 | 定时提醒 |
| export | 导出格式 | PDF导出、自定义模板 |
| analysis | 数据分析 | 成绩趋势分析 |
| utility | 实用工具 | 批量操作、快捷功能 |

## 六、重要提示

1. 所有插件代码将在安全沙箱中运行
2. 涉及高危操作的代码会被自动禁用
3. 插件不得要求用户关闭安全检测
4. 如需特殊权限，请在 permissions 中声明并说明理由
5. 插件不得收集或上传用户数据
6. 插件不得干扰系统核心功能

---
*文档版本: v${ModuleRegistry.systemVersion} | 生成时间: ${new Date().toLocaleString('zh-CN')}*
`;
}

// ==================== Module Registry & Version Control ====================
const ModuleRegistry = {
    modules: new Map(),
    systemVersion: '5.0.0',

    /**
     * Register a module with metadata
     * @param {Object} mod - Module definition
     * @param {string} mod.id - Unique module ID
     * @param {string} mod.name - Display name
     * @param {string} mod.version - Semver version
     * @param {string} mod.type - 'core'|'panel'|'plugin'|'algorithm'|'theme'
     * @param {string} mod.status - 'ok'|'warn'|'error'|'disabled'
     * @param {Function} mod.init - Initialization function
     * @param {Function} mod.destroy - Cleanup function
     * @param {Array} mod.dependencies - Required module IDs
     * @param {Object} mod.permissions - Required permissions
     */
    register(mod) {
        if (!mod.id || !mod.version) {
            console.error('Module must have id and version');
            return false;
        }
        // Check dependencies
        if (mod.dependencies) {
            for (const dep of mod.dependencies) {
                if (!this.modules.has(dep)) {
                    console.error(`Module ${mod.id} missing dependency: ${dep}`);
                    mod.status = 'error';
                }
            }
        }
        this.modules.set(mod.id, {
            ...mod,
            status: mod.status || 'ok',
            loadedAt: Date.now(),
            health: { uptime: 0, errors: 0, lastError: null }
        });
        return true;
    },

    unregister(id) {
        const mod = this.modules.get(id);
        if (!mod) return false;
        if (mod.type === 'core') { console.error('Cannot unregister core module'); return false; }
        if (mod.destroy) try { mod.destroy(); } catch(e) { console.error(`Module ${id} destroy error`, e); }
        this.modules.delete(id);
        return true;
    },

    get(id) { return this.modules.get(id); },
    getAll() { return [...this.modules.values()]; },
    getByType(type) { return this.getAll().filter(m => m.type === type); },

    /**
     * Hot-swap a module (replace without refresh)
     */
    hotSwap(id, newMod) {
        const old = this.modules.get(id);
        if (!old) return this.register(newMod);
        if (old.destroy) try { old.destroy(); } catch(e) {}
        newMod.id = id; // Ensure same ID
        this.modules.set(id, {
            ...newMod,
            loadedAt: Date.now(),
            health: old.health || { uptime: 0, errors: 0, lastError: null }
        });
        if (newMod.init) try { newMod.init(); } catch(e) { console.error(`Hot-swap init error for ${id}`, e); }
        return true;
    },

    /**
     * Get system health summary
     */
    getHealth() {
        const mods = this.getAll();
        return {
            total: mods.length,
            ok: mods.filter(m => m.status === 'ok').length,
            warn: mods.filter(m => m.status === 'warn').length,
            error: mods.filter(m => m.status === 'error').length,
            disabled: mods.filter(m => m.status === 'disabled').length,
            uptime: Date.now() - (window._startTime || Date.now()),
            memoryUsage: performance?.memory?.usedJSHeapSize || null
        };
    },

    /**
     * Render module list in system panel
     */
    renderList() {
        const container = document.getElementById('moduleList');
        if (!container) return;
        const mods = this.getAll();
        container.innerHTML = mods.map(m => `
            <div class="module-card" data-module="${m.id}">
                <div class="module-info">
                    <div class="module-name">
                        ${escapeHtml(m.name || m.id)}
                        <span class="module-version">v${escapeHtml(m.version)}</span>
                        <span class="module-type-badge ${m.type}">${m.type}</span>
                    </div>
                    <div class="module-desc">${escapeHtml(m.description || '')}</div>
                </div>
                <div class="module-status">
                    <span class="status-dot ${m.status}"></span>
                    ${m.type !== 'core' ? `<label class="switch"><input type="checkbox" ${m.status !== 'disabled' ? 'checked' : ''} data-mod-toggle="${m.id}"><span class="slider"></span></label>` : ''}
                </div>
            </div>
        `).join('');
        container.querySelectorAll('[data-mod-toggle]').forEach(cb => {
            cb.addEventListener('change', e => {
                const modId = e.target.dataset.modToggle;
                const mod = this.modules.get(modId);
                if (mod) {
                    mod.status = e.target.checked ? 'ok' : 'disabled';
                    if (mod.init && e.target.checked) try { mod.init(); } catch(e) {}
                    if (mod.destroy && !e.target.checked) try { mod.destroy(); } catch(e) {}
                    this.renderList();
                    Toast.success(`${mod.name} 已${e.target.checked ? '启用' : '停用'}`);
                }
            });
        });
        document.getElementById('moduleSubtitle').textContent = `系统模块 v${this.systemVersion} · ${mods.length} 个模块`;
    },

    /**
     * Render health monitor
     */
    renderHealth() {
        const grid = document.getElementById('healthGrid');
        if (!grid) return;
        const h = this.getHealth();
        const uptimeStr = h.uptime > 60000 ? Math.floor(h.uptime / 60000) + '分钟' : Math.floor(h.uptime / 1000) + '秒';
        grid.innerHTML = `
            <div class="health-item"><div class="health-value" style="color:var(--success);">${h.ok}</div><div class="health-label">正常模块</div></div>
            <div class="health-item"><div class="health-value" style="color:var(--warning);">${h.warn}</div><div class="health-label">告警模块</div></div>
            <div class="health-item"><div class="health-value" style="color:var(--danger);">${h.error}</div><div class="health-label">异常模块</div></div>
            <div class="health-item"><div class="health-value">${uptimeStr}</div><div class="health-label">运行时间</div></div>
        `;
    }
};

// ==================== Security Sandbox ====================
const SecuritySandbox = {
    // Dangerous API patterns to detect
    dangerousPatterns: [
        { pattern: /eval\s*\(/, name: 'eval执行', severity: 'high', action: 'block' },
        { pattern: /new\s+Function\s*\(/, name: '动态函数构造', severity: 'high', action: 'block' },
        { pattern: /document\.cookie/, name: 'Cookie访问', severity: 'high', action: 'block' },
        { pattern: /localStorage\.(setItem|removeItem|clear)/, name: '存储写入', severity: 'medium', action: 'warn' },
        { pattern: /fetch\s*\(/, name: '网络请求(fetch)', severity: 'high', action: 'block' },
        { pattern: /XMLHttpRequest/, name: '网络请求(XHR)', severity: 'high', action: 'block' },
        { pattern: /\.innerHTML\s*=/, name: 'innerHTML注入', severity: 'medium', action: 'warn' },
        { pattern: /document\.write/, name: 'document.write', severity: 'high', action: 'block' },
        { pattern: /window\.location/, name: '页面跳转', severity: 'high', action: 'block' },
        { pattern: /navigator\.geolocation/, name: '地理位置', severity: 'high', action: 'block' },
        { pattern: /navigator\.mediaDevices/, name: '媒体设备', severity: 'high', action: 'block' },
        { pattern: /Notification\s*\(/, name: '系统通知', severity: 'low', action: 'allow' },
        { pattern: /alert\s*\(/, name: '弹窗(alert)', severity: 'low', action: 'allow' },
        { pattern: /confirm\s*\(/, name: '确认框', severity: 'low', action: 'allow' },
    ],

    // Permission categories
    permissions: {
        'core.read': { name: '读取核心数据', risk: 'low' },
        'core.write': { name: '修改核心数据', risk: 'medium' },
        'ui.toast': { name: '显示提示', risk: 'low' },
        'ui.modal': { name: '显示弹窗', risk: 'low' },
        'ui.render': { name: '渲染UI', risk: 'low' },
        'data.students': { name: '访问学生数据', risk: 'medium' },
        'data.seats': { name: '修改座位', risk: 'medium' },
        'data.export': { name: '导出数据', risk: 'low' },
        'network.fetch': { name: '网络请求', risk: 'high' },
        'storage.local': { name: '本地存储', risk: 'medium' },
        'system.eval': { name: '动态执行代码', risk: 'high' },
    },

    /**
     * Scan plugin code for security issues
     * @param {string} code - Plugin source code
     * @returns {Object} Security report
     */
    scan(code) {
        const issues = [];
        const permissions = [];
        let riskLevel = 'safe'; // safe, low, medium, high, critical

        for (const { pattern, name, severity, action } of this.dangerousPatterns) {
            if (pattern.test(code)) {
                issues.push({ name, severity, action });
                if (action === 'block') {
                    if (severity === 'high') riskLevel = 'critical';
                    else if (riskLevel !== 'critical') riskLevel = 'high';
                } else if (action === 'warn') {
                    if (riskLevel === 'safe' || riskLevel === 'low') riskLevel = 'medium';
                }
            }
        }

        // Determine required permissions
        if (/state\./.test(code)) permissions.push('core.read');
        if (/state\.\w+\s*=/.test(code)) permissions.push('core.write');
        if (/Toast\./.test(code)) permissions.push('ui.toast');
        if (/document\./.test(code)) permissions.push('ui.render');
        if (/students/.test(code)) permissions.push('data.students');
        if (/seats/.test(code)) permissions.push('data.seats');
        if (/localStorage/.test(code)) permissions.push('storage.local');

        return {
            riskLevel,
            issues,
            permissions,
            blockedAPIs: issues.filter(i => i.action === 'block').map(i => i.name),
            warnings: issues.filter(i => i.action === 'warn').map(i => i.name),
            safe: issues.length === 0 || issues.every(i => i.action === 'allow')
        };
    },

    /**
     * Create sandboxed plugin wrapper
     * @param {string} code - Plugin source code
     * @param {Object} report - Security scan report
     * @returns {Function} Sandboxed execution function
     */
    createSandbox(code, report) {
        let safeCode = code;
        for (const issue of report.issues) {
            if (issue.action === 'block') {
                safeCode = safeCode.replace(
                    /eval\s*\(/g, '(function(){console.warn("[Security] eval blocked");return null;})('
                );
            }
        }

        return function(pluginContext) {
            const safeConsole = { log: console.log, warn: console.warn, error: console.error };
            const safePluginManager = { register: (n, p) => PluginManager.register(n, p) };
            const safeState = new Proxy(state, {
                get(target, prop) {
                    if (prop === 'plugins' || prop === 'history') return JSON.parse(JSON.stringify(target[prop]));
                    return target[prop];
                }
            });
            const safeToast = {
                success: (m) => Toast.success(m),
                error: (m) => Toast.error(m),
                warning: (m) => Toast.warning(m),
                info: (m) => Toast.info(m)
            };
            const safeAddLog = (icon, text) => addLog(icon, text);
            try {
                const fn = new Function('PluginManager', 'console', 'state', 'Toast', 'addLog', safeCode);
                fn(safePluginManager, safeConsole, safeState, safeToast, safeAddLog);
            } catch(err) {
                console.error('Plugin sandbox execution error:', err);
                throw err;
            }
        };
    },

    /**
     * Render security report in system panel
     */
    renderReport() {
        const container = document.getElementById('securityReport');
        if (!container) return;
        const plugins = Object.entries(state.plugins);
        if (plugins.length === 0) {
            container.innerHTML = '<p style="color:var(--text-tertiary);font-size:12px;text-align:center;padding:12px;">暂无已安装插件</p>';
            return;
        }
        container.innerHTML = plugins.map(([name, plugin]) => {
            const statusIcon = plugin.securityStatus === 'ok' ? '✅' : plugin.securityStatus === 'risk' ? '⚠️' : '❓';
            const statusText = plugin.securityStatus === 'ok' ? '安全' : plugin.securityStatus === 'risk' ? '风险' : '未检测';
            const statusClass = plugin.securityStatus === 'ok' ? 'pass' : plugin.securityStatus === 'risk' ? 'warn' : '';
            return `
                <div class="security-item">
                    <span class="security-icon ${statusClass}">${statusIcon}</span>
                    <span style="flex:1;font-weight:600;">${escapeHtml(plugin.name)}</span>
                    <span style="font-size:10px;color:var(--text-tertiary);">v${escapeHtml(plugin.version || '?')}</span>
                    <span class="permission-tag ${plugin.securityStatus === 'risk' ? 'risk' : 'allowed'}">${statusText}</span>
                </div>
                ${plugin.securityReport ? `
                    <div style="padding:4px 0 8px 24px;font-size:11px;color:var(--text-secondary);">
                        ${plugin.securityReport.blockedAPIs?.length ? `<div>🚫 禁用: ${escapeHtml(plugin.securityReport.blockedAPIs.join(', '))}</div>` : ''}
                        ${plugin.securityReport.warnings?.length ? `<div>⚠️ 警告: ${escapeHtml(plugin.securityReport.warnings.join(', '))}</div>` : ''}
                    </div>
                ` : ''}
            `;
        }).join('');
    }
};

// ==================== Theme Repository ====================
const ThemeRepository = {
    themes: [
        {
            id: 'default', name: '默认蓝', description: '经典蓝色主题',
            vars: { '--primary':'#007AFF', '--primary-light':'#5AC8FA', '--primary-dark':'#0051D5', '--danger':'#FF3B30', '--success':'#34C759', '--warning':'#FF9500', '--info':'#AF52DE' },
            preview: 'linear-gradient(135deg,#007AFF,#5AC8FA)'
        },
        {
            id: 'ocean', name: '深海蓝', description: '沉稳深邃的海洋色系',
            vars: { '--primary':'#0A84FF', '--primary-light':'#409CFF', '--primary-dark':'#0060CC', '--danger':'#FF453A', '--success':'#30D158', '--warning':'#FF9F0A', '--info':'#BF5AF2' },
            preview: 'linear-gradient(135deg,#0A84FF,#0060CC)'
        },
        {
            id: 'forest', name: '森林绿', description: '清新自然的绿色主题',
            vars: { '--primary':'#34C759', '--primary-light':'#5AC8FA', '--primary-dark':'#248A3D', '--danger':'#FF3B30', '--success':'#30D158', '--warning':'#FF9500', '--info':'#AF52DE' },
            preview: 'linear-gradient(135deg,#34C759,#248A3D)'
        },
        {
            id: 'sunset', name: '日落橙', description: '温暖活力的橙色主题',
            vars: { '--primary':'#FF6B35', '--primary-light':'#FF8F5E', '--primary-dark':'#E05520', '--danger':'#FF3B30', '--success':'#34C759', '--warning':'#FFB340', '--info':'#AF52DE' },
            preview: 'linear-gradient(135deg,#FF6B35,#FFB340)'
        },
        {
            id: 'purple', name: '星空紫', description: '优雅神秘的紫色主题',
            vars: { '--primary':'#AF52DE', '--primary-light':'#BF69E8', '--primary-dark':'#8B3CB0', '--danger':'#FF3B30', '--success':'#34C759', '--warning':'#FF9500', '--info':'#5856D6' },
            preview: 'linear-gradient(135deg,#AF52DE,#5856D6)'
        },
        {
            id: 'minimal', name: '极简灰', description: '低饱和度的极简风格',
            vars: { '--primary':'#636366', '--primary-light':'#8E8E93', '--primary-dark':'#48484A', '--danger':'#FF3B30', '--success':'#34C759', '--warning':'#FF9500', '--info':'#AF52DE' },
            preview: 'linear-gradient(135deg,#636366,#8E8E93)'
        }
    ],

    currentTheme: 'default',

    apply(id) {
        const theme = this.themes.find(t => t.id === id);
        if (!theme) return;
        Object.entries(theme.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
        this.currentTheme = id;
        state.settings.themeId = id;
        this.renderList();
    },

    renderList() {
        const container = document.getElementById('themeRepoList');
        if (!container) return;
        container.innerHTML = this.themes.map(t => `
            <div class="theme-card ${t.id === this.currentTheme ? 'active' : ''}" data-theme-id="${t.id}">
                <div class="theme-card-preview" style="background:${t.preview};"></div>
                <div class="theme-card-name">${t.name}</div>
                <div class="theme-card-desc">${t.description}</div>
            </div>
        `).join('');
        container.querySelectorAll('.theme-card').forEach(card => {
            card.addEventListener('click', () => this.apply(card.dataset.themeId));
        });
    },

    exportTheme() {
        const computed = getComputedStyle(document.documentElement);
        const vars = {};
        ['--primary','--primary-light','--primary-dark','--danger','--success','--warning','--info',
         '--text-primary','--text-secondary','--bg-primary','--bg-secondary','--bg-tertiary',
         '--radius-sm','--radius-md','--radius-lg','--font-sans'].forEach(v => {
            vars[v] = computed.getPropertyValue(v).trim();
        });
        const blob = new Blob([JSON.stringify({ name: '自定义主题', vars, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `主题_${Date.now()}.json`;
        link.href = URL.createObjectURL(blob); link.click();
        Toast.success('主题已导出');
    },

    importTheme(json) {
        try {
            const data = JSON.parse(json);
            if (!data.vars) throw new Error('无效主题文件');
            Object.entries(data.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
            Toast.success(`主题 "${data.name || '自定义'}" 已应用`);
        } catch(e) { Toast.error('主题导入失败: ' + e.message); }
    }
};

// ==================== Composite Evaluation Engine ====================
const CompositeEval = {
    /**
     * Calculate composite evaluation score for a student
     * @param {Object} student - Student data
     * @returns {number} 0-100 composite score
     */
    getScore(student) {
        if (!student) return 0;
        const w = state.settings.weights;
        let totalWeight = 0, totalScore = 0;

        // Academic (average of all subject scores)
        if (w.academic > 0) {
            const scores = student.scores || {};
            const vals = Object.values(scores).filter(v => v !== null && v !== undefined);
            if (vals.length > 0) {
                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                totalScore += avg * w.academic;
                totalWeight += w.academic;
            }
        }

        // Personality complement bonus (calculated during recommendation, not per-student)
        // Here we give a base score based on personality adaptability
        if (w.personality > 0 && student.personality) {
            const pScore = student.personality === '中性' ? 80 : student.personality === '外向' ? 70 : 65;
            totalScore += pScore * w.personality;
            totalWeight += w.personality;
        }

        // Hobby diversity bonus
        if (w.hobby > 0 && student.hobbies && student.hobbies.length > 0) {
            const hScore = Math.min(100, 50 + student.hobbies.length * 10);
            totalScore += hScore * w.hobby;
            totalWeight += w.hobby;
        }

        // Position responsibility bonus
        if (w.position > 0 && student.position) {
            const posScores = { '班长': 95, '副班长': 90, '学习委员': 90, '体育委员': 85, '文艺委员': 85, '劳动委员': 80, '小组长': 75, '课代表': 80 };
            const pScore = posScores[student.position] || 60;
            totalScore += pScore * w.position;
            totalWeight += w.position;
        }

        return totalWeight > 0 ? Math.round(totalScore / totalWeight) : (student.score || 0);
    },

    /**
     * Get average subject score
     */
    getAvgScore(student) {
        if (!student) return null;
        const scores = student.scores || {};
        const vals = Object.values(scores).filter(v => v !== null && v !== undefined);
        if (vals.length === 0) return student.score || null;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    },

    /**
     * Get single subject score
     */
    getSubjectScore(student, subject) {
        if (!student || !student.scores) return null;
        return student.scores[subject] ?? null;
    },

    /**
     * Calculate peer influence score between two adjacent students
     * Higher = more positive mutual influence
     */
    peerInfluence(s1, s2) {
        if (!s1 || !s2) return 0;
        let score = 0;

        // Academic complement: high scorer next to low scorer = positive
        const avg1 = this.getAvgScore(s1), avg2 = this.getAvgScore(s2);
        if (avg1 !== null && avg2 !== null) {
            const diff = Math.abs(avg1 - avg2);
            if (diff > 15 && diff < 40) score += 20; // Good pairing range
            else if (diff <= 15) score += 10; // Similar level, can discuss together
        }

        // Personality complement
        if (s1.personality && s2.personality) {
            if (s1.personality === '外向' && s2.personality === '内向') score += 15;
            else if (s1.personality === '内向' && s2.personality === '外向') score += 15;
            else if (s1.personality === '中性' || s2.personality === '中性') score += 8;
        }

        // Shared hobbies
        if (s1.hobbies && s2.hobbies) {
            const shared = s1.hobbies.filter(h => s2.hobbies.includes(h));
            score += Math.min(20, shared.length * 8);
        }

        // Position diversity (different roles complement each other)
        if (s1.position && s2.position && s1.position !== s2.position) score += 10;

        // Gender balance bonus
        if (s1.gender !== s2.gender) score += 5;

        return score;
    },

    /**
     * Generate explanation for why two students should sit together/apart
     */
    explainPairing(s1, s2, relationship) {
        const reasons = [];
        const avg1 = this.getAvgScore(s1), avg2 = this.getAvgScore(s2);

        if (avg1 !== null && avg2 !== null) {
            const diff = Math.abs(avg1 - avg2);
            if (diff > 20) reasons.push(`学业互补：${escapeHtml(s1.name)}(${avg1}分)与${escapeHtml(s2.name)}(${avg2}分)成绩差${diff}分，可形成帮扶关系`);
            else if (diff <= 10) reasons.push(`学业同步：两人成绩相近(${avg1}/${avg2}分)，便于讨论交流`);
        }

        if (s1.personality && s2.personality) {
            if ((s1.personality === '外向' && s2.personality === '内向') || (s1.personality === '内向' && s2.personality === '外向'))
                reasons.push(`性格互补：${s1.personality}型与${s2.personality}型搭配，有利于社交能力均衡发展`);
        }

        if (s1.hobbies && s2.hobbies) {
            const shared = s1.hobbies.filter(h => s2.hobbies.includes(h));
            if (shared.length > 0) reasons.push(`共同爱好：${shared.join('、')}，有共同话题`);
        }

        if (s1.position && s2.position && s1.position !== s2.position)
            reasons.push(`职务搭配：${s1.position}与${s2.position}协作，有利于班级管理`);

        if (s1.gender !== s2.gender) reasons.push('性别均衡：男女搭配坐，符合教育部建议');

        return reasons.length > 0 ? reasons.join('。') : '综合评估后的位置建议';
    },

    /**
     * Render algorithm explanation modal content
     */
    renderExplanation() {
        const w = state.settings.weights;
        const container = document.getElementById('algoWeightBars');
        if (!container) return;
        container.innerHTML = `
            <div style="margin-top:12px;">
                <div class="algo-weight-bar"><span class="algo-weight-label">学业成绩</span><div class="algo-weight-track"><div class="algo-weight-fill" style="width:${w.academic}%;background:var(--primary);">${w.academic}%</div></div></div>
                <div class="algo-weight-bar"><span class="algo-weight-label">性格互补</span><div class="algo-weight-track"><div class="algo-weight-fill" style="width:${w.personality}%;background:var(--success);">${w.personality}%</div></div></div>
                <div class="algo-weight-bar"><span class="algo-weight-label">爱好搭配</span><div class="algo-weight-track"><div class="algo-weight-fill" style="width:${w.hobby}%;background:var(--warning);">${w.hobby}%</div></div></div>
                <div class="algo-weight-bar"><span class="algo-weight-label">职务平衡</span><div class="algo-weight-track"><div class="algo-weight-fill" style="width:${w.position}%;background:var(--info);">${w.position}%</div></div></div>
                <div class="algo-weight-bar"><span class="algo-weight-label">性别均衡</span><div class="algo-weight-track"><div class="algo-weight-fill" style="width:${w.gender}%;background:#FF2D55;">${w.gender}%</div></div></div>
            </div>
        `;
    }
};

// ==================== Pinyin Initial Search ====================
// [FEATURE #26] Lazy PinyinMap - initialized on first search
let _pinyinMap = null;
function _getPinyinMap() {
    if (!_pinyinMap) {
        _pinyinMap = {
    '阿':'a','爱':'ai','安':'an','昂':'ang','奥':'ao',
    '八':'ba','白':'bai','百':'bai','柏':'bai','班':'ban','半':'ban','包':'bao','宝':'bao','保':'bao','鲍':'bao','北':'bei','贝':'bei','本':'ben','毕':'bi','边':'bian','卞':'bian','别':'bie','宾':'bin','丙':'bing','伯':'bo','卜':'bo','补':'bu','步':'bu',
    '才':'cai','蔡':'cai','曹':'cao','草':'cao','岑':'cen','柴':'chai','昌':'chang','常':'chang','超':'chao','朝':'chao','车':'che','陈':'chen','成':'cheng','程':'cheng','池':'chi','迟':'chi','充':'chong','初':'chu','楚':'chu','储':'chu','褚':'chu','春':'chun','崔':'cui','存':'cun',
    '达':'da','大':'da','戴':'dai','丹':'dan','但':'dan','党':'dang','刀':'dao','到':'dao','邓':'deng','狄':'di','典':'dian','丁':'ding','东':'dong','冬':'dong','董':'dong','杜':'du','段':'duan','顿':'dun','多':'duo',
    '娥':'e','恩':'en',
    '发':'fa','范':'fan','方':'fang','飞':'fei','丰':'feng','冯':'feng','凤':'feng','伏':'fu','符':'fu','福':'fu','傅':'fu',
    '刚':'gang','高':'gao','郜':'gao','戈':'ge','葛':'ge','耿':'geng','公':'gong','龚':'gong','巩':'gong','古':'gu','顾':'gu','关':'guan','管':'guan','广':'guang','桂':'gui','郭':'guo','国':'guo','果':'guo',
    '哈':'ha','海':'hai','韩':'han','杭':'hang','郝':'hao','何':'he','和':'he','贺':'he','衡':'heng','红':'hong','洪':'hong','侯':'hou','后':'hou','胡':'hu','花':'hua','华':'hua','桓':'huan','黄':'huang','回':'hui','惠':'hui','火':'huo','霍':'huo',
    '及':'ji','吉':'ji','纪':'ji','季':'ji','贾':'jia','简':'jian','江':'jiang','姜':'jiang','蒋':'jiang','焦':'jiao','金':'jin','晋':'jin','靳':'jin','经':'jing','景':'jing','靖':'jing','鞠':'ju','隽':'jun',
    '开':'kai','阚':'kan','康':'kang','柯':'ke','可':'ke','孔':'kong','寇':'kou','匡':'kuang','邝':'kuang','况':'kuang','奎':'kui','昆':'kun',
    '来':'lai','赖':'lai','兰':'lan','蓝':'lan','郎':'lang','劳':'lao','乐':'le','雷':'lei','冷':'leng','黎':'li','李':'li','力':'li','历':'li','厉':'li','利':'li','栗':'li','连':'lian','廉':'lian','练':'lian','梁':'liang','廖':'liao','林':'lin','凌':'ling','刘':'liu','柳':'liu','龙':'long','娄':'lou','卢':'lu','鲁':'lu','陆':'lu','路':'lu','吕':'lv','罗':'luo','骆':'luo',
    '麻':'ma','马':'ma','买':'mai','麦':'mai','满':'man','毛':'mao','茅':'mao','梅':'mei','孟':'meng','米':'mi','苗':'miao','闵':'min','明':'ming','莫':'mo','牟':'mu','木':'mu','穆':'mu',
    '那':'na','南':'nan','倪':'ni','聂':'nie','宁':'ning','牛':'niu','农':'nong',
    '欧':'ou','偶':'ou',
    '潘':'pan','庞':'pang','裴':'pei','彭':'peng','皮':'pi','平':'ping','蒲':'pu','濮':'pu','朴':'pu','浦':'pu',
    '戚':'qi','齐':'qi','祁':'qi','钱':'qian','强':'qiang','乔':'qiao','秦':'qin','丘':'qiu','邱':'qiu','裘':'qiu','曲':'qu','瞿':'qu','全':'quan','权':'quan',
    '冉':'ran','饶':'rao','任':'ren','荣':'rong','容':'rong','阮':'ruan','芮':'rui',
    '萨':'sa','桑':'sang','沙':'sha','单':'shan','商':'shang','尚':'shang','邵':'shao','佘':'she','申':'shen','沈':'shen','盛':'sheng','施':'shi','石':'shi','时':'shi','史':'shi','寿':'shou','舒':'shu','帅':'shuai','双':'shuang','税':'shui','司':'si','宋':'song','苏':'su','宿':'su','隋':'sui','孙':'sun','索':'suo',
    '邰':'tai','谈':'tan','谭':'tan','汤':'tang','唐':'tang','陶':'tao','滕':'teng','田':'tian','铁':'tie','童':'tong','佟':'tong','涂':'tu','屠':'tu',
    '万':'wan','汪':'wang','王':'wang','危':'wei','韦':'wei','卫':'wei','魏':'wei','温':'wen','文':'wen','翁':'weng','邬':'wu','巫':'wu','吴':'wu','武':'wu','伍':'wu',
    '奚':'xi','习':'xi','席':'xi','夏':'xia','鲜':'xian','向':'xiang','项':'xiang','肖':'xiao','萧':'xiao','谢':'xie','辛':'xin','邢':'xing','幸':'xing','熊':'xiong','修':'xiu','徐':'xu','许':'xu','续':'xu','宣':'xuan','薛':'xue','荀':'xun',
    '牙':'ya','严':'yan','言':'yan','阎':'yan','颜':'yan','杨':'yang','阳':'yang','姚':'yao','叶':'ye','衣':'yi','易':'yi','殷':'yin','尹':'yin','应':'ying','尤':'you','游':'you','于':'yu','余':'yu','俞':'yu','虞':'yu','禹':'yu','玉':'yu','元':'yuan','袁':'yuan','岳':'yue','云':'yun','郧':'yun','恽':'yun',
    '宰':'zai','臧':'zang','曾':'zeng','翟':'zhai','詹':'zhan','湛':'zhan','张':'zhang','章':'zhang','赵':'zhao','甄':'zhen','郑':'zheng','支':'zhi','钟':'zhong','仲':'zhong','周':'zhou','朱':'zhu','诸':'zhu','祝':'zhu','庄':'zhuang','卓':'zhuo','宗':'zong','邹':'zou','祖':'zu','左':'zuo',
    // [FIX #17] 补全常见姓氏
    '阙':'que','缪':'miao','乜':'nie','干':'gan','於':'yu','干':'gan','郏':'jia','郏':'jia','逄':'pang','嵇':'ji','濮阳':'pu','澹台':'tan','公冶':'gong','东方':'dong','上官':'shang','欧阳':'ou','诸葛':'ge','令狐':'ling','皇甫':'huang','尉迟':'yu','公孙':'gong','轩辕':'xuan','夏侯':'xia','闻人':'wen'
        };
    }
    return _pinyinMap;
}
// Backward compatibility alias
const PinyinMap = new Proxy({}, { get: (_, key) => _getPinyinMap()[key] });

/**
 * Get pinyin initials for a Chinese name
 * @param {string} name - Chinese name
 * @returns {string} pinyin initials (lowercase)
 */
// [FIX] Use pinyin-pro library for complete pinyin support
function _fallbackPinyinInitials(name) {
    let result = '';
    for (const ch of name) {
        const lower = ch.toLowerCase();
        if (/[a-z0-9]/.test(lower)) { result += lower; continue; }
        const py = PinyinMap[ch];
        if (py) result += py[0];
    }
    return result;
}
function _fallbackFullPinyin(name) {
    let result = '';
    for (const ch of name) {
        const lower = ch.toLowerCase();
        if (/[a-z0-9]/.test(lower)) { result += lower; continue; }
        const py = PinyinMap[ch];
        if (py) result += py;
    }
    return result;
}
// [FIX] pinyin-pro CDN exports `pinyin` directly on window (not pinyinPro.pinyin)
function getPinyinInitials(name) {
    try {
        if (typeof pinyin === 'function') {
            return pinyin(name, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();
        }
    } catch(e) { console.warn('pinyin-pro error:', e); }
    return _fallbackPinyinInitials(name);
}

/**
 * Get full pinyin for a Chinese name
 * @param {string} name - Chinese name
 * @returns {string} full pinyin (lowercase, no tones)
 */
function getFullPinyin(name) {
    try {
        if (typeof pinyin === 'function') {
            return pinyin(name, { toneType: 'none', type: 'array' }).join('').toLowerCase();
        }
    } catch(e) { console.warn('pinyin-pro error:', e); }
    return _fallbackFullPinyin(name);
}

/**
 * [FIX #4] Unified student matching function
 * Supports: name contains, full pinyin contains, pinyin initials substring match
 * @param {Object} student - student object
 * @param {string} query - lowercase query string
 * @returns {boolean}
 */
function matchStudent(student, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const name = student.name.toLowerCase();
    if (name.includes(q)) return true;
    const fullPy = getFullPinyin(student.name).toLowerCase();
    if (fullPy.includes(q.replace(/\s/g, ''))) return true;
    const initials = getPinyinInitials(student.name).toLowerCase();
    // Support any continuous substring match on initials (e.g. "lmf", "lm", "l" match "路明非")
    if (initials.includes(q)) return true;
    // Also match position and personality
    if (student.position && student.position.toLowerCase().includes(q)) return true;
    if (student.personality && student.personality.toLowerCase().includes(q)) return true;
    if (student.hobbies && student.hobbies.some(h => h.toLowerCase().includes(q))) return true;
    return false;
}

/**
 * [FEATURE #8] Parse advanced search query
 * Supports: >score, <score, gender:, lunch:, personality:, position:
 * @param {string} query - raw query string
 * @returns {Object} { text, filters }
 */
function parseQuery(query) {
    const filters = {};
    let text = query || '';
    // Extract special filters
    const patterns = [
        { re: /(?:成绩|score)\s*>\s*(\d+)/i, key: 'scoreAbove' },
        { re: /(?:成绩|score)\s*<\s*(\d+)/i, key: 'scoreBelow' },
        { re: /(?:性别|gender)\s*[:：]\s*(男|女|male|female)/i, key: 'gender' },
        { re: /(?:午休|lunch)\s*[:：]\s*(是|否|yes|no|1|0)/i, key: 'lunch' },
        { re: /(?:性格|personality)\s*[:：]\s*(外向|内向|中性)/i, key: 'personality' },
        { re: /(?:职务|position)\s*[:：]\s*(\S+)/i, key: 'position' },
    ];
    patterns.forEach(({ re, key }) => {
        const m = text.match(re);
        if (m) { filters[key] = m[1]; text = text.replace(m[0], '').trim(); }
    });
    return { text: text.trim(), filters };
}

/**
 * Smart search component for blacklist/whitelist
 */
class SmartSearch {
    /**
     * @param {Object} opts
     * @param {string} opts.inputId - Search input element ID
     * @param {string} opts.dropdownId - Dropdown element ID
     * @param {string} opts.textareaId - Target textarea element ID
     * @param {string} opts.listKey - 'blacklist' or 'whitelist'
     */
    constructor({ inputId, dropdownId, textareaId, listKey }) {
        this.input = document.getElementById(inputId);
        this.dropdown = document.getElementById(dropdownId);
        this.textarea = document.getElementById(textareaId);
        this.listKey = listKey;
        this.highlightIdx = -1;
        this.filteredStudents = [];
        this._bound = false;
        this.bind();
    }

    bind() {
        if (this._bound) return;
        this._bound = true;
        this.input.addEventListener('input', () => this.onInput());
        this.input.addEventListener('focus', () => this.onInput());
        this.input.addEventListener('keydown', e => this.onKeydown(e));
        document.addEventListener('click', e => {
            if (!e.target.closest('.smart-search')) this.close();
        });
        // Reposition dropdown on scroll (sidebar scroll changes input rect)
        const scrollParent = this.input.closest('.sidebar-content');
        if (scrollParent) {
            scrollParent.addEventListener('scroll', () => {
                if (this.dropdown.classList.contains('open')) this.render();
            }, { passive: true });
        }
    }

    onInput() {
        const query = this.input.value.trim().toLowerCase();
        if (!query) { this.close(); return; }
        // [FIX #4] Use unified matchStudent
        this.filteredStudents = state.students.filter(s => matchStudent(s, query)).slice(0, 15);
        this.highlightIdx = -1;
        this.render();
    }

    onKeydown(e) {
        if (!this.dropdown.classList.contains('open')) return;
        const items = this.dropdown.querySelectorAll('.smart-search-item:not(.disabled)');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.highlightIdx = Math.min(this.highlightIdx + 1, items.length - 1);
            this.updateHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.highlightIdx = Math.max(this.highlightIdx - 1, 0);
            this.updateHighlight(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.highlightIdx >= 0 && items[this.highlightIdx]) {
                this.selectStudent(items[this.highlightIdx].dataset.name);
            } else if (items.length > 0) {
                this.selectStudent(items[0].dataset.name);
            }
        } else if (e.key === 'Escape') {
            this.close();
        }
    }

    updateHighlight(items) {
        items.forEach((item, i) => item.classList.toggle('highlighted', i === this.highlightIdx));
        if (items[this.highlightIdx]) items[this.highlightIdx].scrollIntoView({ block: 'nearest' });
    }

    render() {
        // Position dropdown using fixed coordinates to escape overflow:hidden ancestors
        const rect = this.input.getBoundingClientRect();
        this.dropdown.style.top = (rect.bottom + 4) + 'px';
        this.dropdown.style.left = rect.left + 'px';
        this.dropdown.style.width = rect.width + 'px';
        if (this.filteredStudents.length === 0) {
            this.dropdown.innerHTML = '<div class="smart-search-empty">未找到匹配学生</div>';
            this.dropdown.classList.add('open');
            return;
        }
        const query = this.input.value.trim().toLowerCase();
        this.dropdown.innerHTML = this.filteredStudents.map(s => {
            const initials = getPinyinInitials(s.name);
            const fullPy = getFullPinyin(s.name);
            let hint = '';
            if (initials.includes(query) && !s.name.toLowerCase().includes(query)) hint = `拼音: ${fullPy}`;
            const genderIcon = s.gender === 'male' ? '♂' : '♀';
            return `<div class="smart-search-item" data-name="${escapeHtml(s.name)}"><span>${escapeHtml(s.name)} ${genderIcon}</span><span class="match-hint">${escapeHtml(hint)}</span></div>`;
        }).join('');
        this.dropdown.classList.add('open');
        this.dropdown.querySelectorAll('.smart-search-item').forEach(item => {
            item.addEventListener('click', () => this.selectStudent(item.dataset.name));
        });
    }

    selectStudent(name) {
        const current = this.textarea.value.trim();
        // Add to the last incomplete line, or start a new line
        if (current === '') {
            this.textarea.value = name + ' ';
        } else {
            const lines = current.split('\n');
            const lastLine = lines[lines.length - 1].trim();
            if (lastLine === '') {
                lines[lines.length - 1] = name + ' ';
            } else {
                // Check if the last line already ends with space (incomplete group)
                lines[lines.length - 1] = lastLine + ' ' + name;
            }
            this.textarea.value = lines.join('\n');
        }
        // Trigger input event to save
        this.textarea.dispatchEvent(new Event('input'));
        // [FIX #2] Directly parse and update state to ensure sync
        const lines = this.textarea.value.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
        state[this.listKey] = lines.map(l => l.trim().split(/\s+/).map(n => n.trim()));
        this.input.value = '';
        this.close();
        Toast.success(`已添加 ${name}`);
    }

    close() {
        this.dropdown.classList.remove('open');
        this.dropdown.style.top = '';
        this.dropdown.style.left = '';
        this.dropdown.style.width = '';
        this.highlightIdx = -1;
    }
}

// ==================== Algorithm (Bug-fixed) ====================
const Algorithm = {
    // [FIX] History now properly tracked via pushHistory()
    pushHistory() {
        const snapshot = [];
        [...state.seats, state.platformLeft, state.platformRight].forEach(s => {
            if (s.student) snapshot.push({ id: s.student.id, name: s.student.name, row: s.row, col: s.col, type: s.type });
        });
        if (snapshot.length > 0) {
            state.history.push(snapshot);
            if (state.history.length > 20) state.history.shift();
        }
    },
    calculateProbabilities() {
        if (state.remainingStudents.length === 0) return [];
        let probabilities = {};
        state.remainingStudents.forEach(s => { probabilities[s.id] = 1; });
        if (state.settings.antiCluster) {
            this.applyBlacklist(probabilities);
            this.applyWhitelist(probabilities);
        }
        if (state.settings.genderBalance) this.applyGenderBalance(probabilities);
        this.applyHistory(probabilities);
        // [FIX] Pass nextSeat to plugin hooks
        const nextSeat = state.drawOrder[state.currentDrawIndex] || null;
        Object.keys(state.plugins).forEach(pn => {
            if (PluginManager.isEnabled(pn) && state.plugins[pn].beforeDraw) {
                try {
                    const result = state.plugins[pn].beforeDraw(state.remainingStudents, probabilities, nextSeat);
                    if (result && result.probabilities) probabilities = result.probabilities;
                } catch(e) { console.error(`Plugin ${pn}.beforeDraw error`, e); }
            }
        });
        // [FIX] Clamp probabilities to prevent collapse from extreme blacklist/whitelist values
        Object.keys(probabilities).forEach(id => {
            probabilities[id] = Math.max(probabilities[id], 0.001);
        });
        // Normalize
        const total = Object.values(probabilities).reduce((a, b) => a + b, 0);
        if (total <= 0) {
            // Fallback: uniform distribution (should never reach here after clamping)
            state.remainingStudents.forEach(s => { probabilities[s.id] = 1 / state.remainingStudents.length; });
        } else {
            Object.keys(probabilities).forEach(id => { probabilities[id] = probabilities[id] / total; });
        }
        return Object.entries(probabilities)
            .map(([id, prob]) => ({ student: state.students.find(s => s.id === parseInt(id)), probability: prob }))
            .filter(item => item.student)
            .sort((a, b) => b.probability - a.probability);
    },
    calculateEffectiveDistance(seat1, seat2) {
        if (!seat1 || !seat2) return Infinity;
        if (seat1.type !== 'normal' || seat2.type !== 'normal') return Math.abs(seat1.row - seat2.row) + Math.abs(seat1.col - seat2.col);
        const row1 = seat1.row, col1 = seat1.col, row2 = seat2.row, col2 = seat2.col;
        if (row1 === row2) {
            const minC = Math.min(col1, col2), maxC = Math.max(col1, col2);
            for (let c = minC + 1; c < maxC; c++) {
                const idx = row1 * state.cols + c;
                if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) return Infinity;
            }
        }
        if (col1 === col2) {
            const minR = Math.min(row1, row2), maxR = Math.max(row1, row2);
            for (let r = minR + 1; r < maxR; r++) {
                const idx = r * state.cols + col1;
                if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) return Infinity;
            }
        }
        if (row1 !== row2 && col1 !== col2) {
            let path1Blocked = false, path2Blocked = false;
            for (let c = Math.min(col1, col2) + 1; c < Math.max(col1, col2); c++) {
                const idx = row1 * state.cols + c;
                if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) { path1Blocked = true; break; }
            }
            if (!path1Blocked) {
                for (let r = Math.min(row1, row2) + 1; r < Math.max(row1, row2); r++) {
                    const idx = r * state.cols + col2;
                    if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) { path1Blocked = true; break; }
                }
            }
            for (let r = Math.min(row1, row2) + 1; r < Math.max(row1, row2); r++) {
                const idx = r * state.cols + col1;
                if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) { path2Blocked = true; break; }
            }
            if (!path2Blocked) {
                for (let c = Math.min(col1, col2) + 1; c < Math.max(col1, col2); c++) {
                    const idx = row2 * state.cols + c;
                    if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) { path2Blocked = true; break; }
                }
            }
            if (path1Blocked && path2Blocked) return Infinity;
        }
        return Math.abs(row1 - row2) + Math.abs(col1 - col2);
    },
    applyBlacklist(probabilities) {
        const drawnSeats = [...state.seats, state.platformLeft, state.platformRight].filter(s => s.student && !s.disabled);
        const nextSeat = state.drawOrder[state.currentDrawIndex];
        if (!nextSeat) return;
        // [FIX #7] Helper: extract clean name and check if it's an anchor
        const parseName = (raw) => {
            let name = raw;
            let isAnchor = false;
            if (name.startsWith('*')) { isAnchor = true; name = name.slice(1); }
            if ((name.startsWith('(') && name.endsWith(')')) || (name.startsWith('（') && name.endsWith('）'))) {
                isAnchor = true; name = name.slice(1, -1);
            }
            return { name, isAnchor };
        };
        state.blacklist.forEach(group => {
            const parsed = group.map(parseName);
            const cleanGroup = parsed.map(p => p.name);
            const anchorNames = parsed.filter(p => p.isAnchor).map(p => p.name);
            const drawnInGroup = cleanGroup.filter(name => drawnSeats.some(s => s.student.name === name));
            if (drawnInGroup.length === 0) return;
            // Determine anchors: if explicit markers exist, use them; otherwise use first drawn
            let anchors;
            if (anchorNames.length > 0) {
                anchors = drawnInGroup.filter(n => anchorNames.includes(n));
                if (anchors.length === 0) return; // [FIX #1] No anchor drawn yet, skip group
            } else {
                const drawOrder = state.drawnStudents.map(s => s.name);
                anchors = [drawnInGroup.sort((a, b) => drawOrder.indexOf(a) - drawOrder.indexOf(b))[0]];
            }
            // Only penalize remaining students based on proximity to anchor(s)
            state.remainingStudents.forEach(student => {
                if (!cleanGroup.includes(student.name)) return;
                let minDist = Infinity;
                anchors.forEach(dn => {
                    const ds = drawnSeats.find(s => s.student.name === dn);
                    if (ds) minDist = Math.min(minDist, this.calculateEffectiveDistance(ds, nextSeat));
                });
                if (minDist <= state.settings.blacklistRadius) {
                    // [FIX] Use floor to prevent exact 0 which causes normalization collapse
                    probabilities[student.id] *= Math.max(0.001, 1 - state.settings.blacklistPenalty / 100);
                }
            });
        });
    },
    applyWhitelist(probabilities) {
        const drawnSeats = [...state.seats, state.platformLeft, state.platformRight].filter(s => s.student && !s.disabled);
        const nextSeat = state.drawOrder[state.currentDrawIndex];
        if (!nextSeat || nextSeat.type !== 'normal') return;
        // [FIX #7] Helper: extract clean name and check if it's an anchor
        const parseName = (raw) => {
            let name = raw;
            let isAnchor = false;
            if (name.startsWith('*')) { isAnchor = true; name = name.slice(1); }
            if ((name.startsWith('(') && name.endsWith(')')) || (name.startsWith('（') && name.endsWith('）'))) {
                isAnchor = true; name = name.slice(1, -1);
            }
            return { name, isAnchor };
        };
        state.whitelist.forEach(group => {
            const parsed = group.map(parseName);
            const cleanGroup = parsed.map(p => p.name);
            const anchorNames = parsed.filter(p => p.isAnchor).map(p => p.name);
            const drawnInGroup = cleanGroup.filter(name => drawnSeats.some(s => s.student.name === name));
            if (drawnInGroup.length === 0) return;
            // Determine anchors
            let anchorDrawn;
            if (anchorNames.length > 0) {
                anchorDrawn = drawnInGroup.filter(n => anchorNames.includes(n));
                if (anchorDrawn.length === 0) return; // [FIX #1] No anchor drawn yet, skip group
            } else {
                anchorDrawn = drawnInGroup;
            }
            state.remainingStudents.forEach(student => {
                if (!cleanGroup.includes(student.name)) return;
                let bestBonus = 0;
                anchorDrawn.forEach(dn => {
                    const ds = drawnSeats.find(s => s.student.name === dn);
                    if (!ds) return;
                    const dist = this.calculateEffectiveDistance(ds, nextSeat);
                    if (dist === Infinity) return;
                    const rowDiff = Math.abs(ds.row - nextSeat.row);
                    const colDiff = Math.abs(ds.col - nextSeat.col);
                    let bonus = 0;
                    if (rowDiff === 0 && colDiff === 1) bonus = state.settings.whitelistDeskBonus / 100;
                    else if (rowDiff === 1 && colDiff === 0) bonus = state.settings.whitelistFrontBackBonus / 100;
                    else if (rowDiff === 1 && colDiff === 1) bonus = state.settings.whitelistDiagonalBonus / 100;
                    else if (dist <= 5) bonus = state.settings.whitelistFallbackBonus / 100;
                    bestBonus = Math.max(bestBonus, bonus);
                });
                if (bestBonus > 0) {
                    // [FIX] Use cubic scaling so extreme bonus values produce near-certain results
                    // At 200%: multiplier ≈ 27; at 500%: multiplier ≈ 216
                    probabilities[student.id] *= Math.pow(1 + bestBonus, 3);
                }
            });
        });
    },
    applyGenderBalance(probabilities) {
        const rm = state.remainingStudents.filter(s => s.gender === 'male').length;
        const rf = state.remainingStudents.filter(s => s.gender === 'female').length;
        const total = rm + rf;
        if (total === 0) return;
        const mr = rm / total, fr = rf / total;
        state.remainingStudents.forEach(s => {
            if (s.gender === 'male' && mr > 0.6) probabilities[s.id] *= 0.7;
            else if (s.gender === 'female' && fr > 0.6) probabilities[s.id] *= 0.7;
        });
    },
    // [FIX] History-based adjacency penalty now works
    applyHistory(probabilities) {
        if (state.history.length === 0) return;
        const recent = state.history.slice(-5);
        state.remainingStudents.forEach(student => {
            let penalty = 0;
            recent.forEach(snapshot => {
                const studentEntry = snapshot.find(h => h.id === student.id);
                if (!studentEntry) return;
                snapshot.forEach(entry => {
                    if (entry.id === student.id) return;
                    // Check if this person is already drawn and seated
                    const isDrawn = state.drawnStudents.some(d => d.id === entry.id);
                    if (!isDrawn) return;
                    if (this.areAdjacentByRC(studentEntry.row, studentEntry.col, entry.row, entry.col)) {
                        penalty += 0.1;
                    }
                });
            });
            probabilities[student.id] *= Math.max(0.1, 1 - penalty);
        });
    },
    areAdjacentByRC(r1, c1, r2, c2) {
        if (r1 < 0 || r2 < 0) return false; // platform seats
        return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
    },
    drawStudent() {
        const probabilities = this.calculateProbabilities();
        if (probabilities.length === 0) return null;
        let random = Math.random();
        let cumulative = 0;
        for (let i = 0; i < probabilities.length; i++) {
            cumulative += probabilities[i].probability;
            if (random <= cumulative || i === probabilities.length - 1) {
                const idx = state.remainingStudents.findIndex(s => s.id === probabilities[i].student.id);
                return state.remainingStudents.splice(idx, 1)[0];
            }
        }
        return state.remainingStudents.shift();
    }
};

// ==================== UI ====================
const UI = {
    _seatAbort: null,
    longPressTimer: null,
    _closeMenuFn: null,
    _autoDrawInterval: null,
    _autoDrawRunning: false,

    init() {
        this.renderClassroom();
        this.bindEvents();
        this.updateStats();
        this.applyGlobalSettings();
        PluginManager.renderPluginsList();
        this.updateEmptyState();
        this.renderPool();
        UndoManager.updateButtons();
        makeDraggable(document.getElementById('probabilityPanel'));
        makeDraggable(document.getElementById('recommendPanel'));
        makeDraggable(document.getElementById('sidePanel'));
        // Initialize smart search for blacklist/whitelist
        this.blacklistSearch = new SmartSearch({ inputId: 'blacklistSearch', dropdownId: 'blacklistDropdown', textareaId: 'blacklist', listKey: 'blacklist' });
        this.whitelistSearch = new SmartSearch({ inputId: 'whitelistSearch', dropdownId: 'whitelistDropdown', textareaId: 'whitelist', listKey: 'whitelist' });
        // Initialize subject tabs and heatmap subject select
        this.renderSubjectTabs();
        this.updateHeatmapSubjectSelect();
    },

    // ==================== Render Classroom ====================
    renderClassroom() {
        document.getElementById('frontDoor').style.display = state.showDoors ? 'block' : 'none';
        document.getElementById('backDoor').style.display = state.showDoors ? 'block' : 'none';
        this.applyDoorPosition();
        const pL = document.getElementById('platformLeft');
        const pR = document.getElementById('platformRight');
        pL.style.display = state.showPlatformLeft ? 'flex' : 'none';
        pR.style.display = state.showPlatformRight ? 'flex' : 'none';
        pL.classList.toggle('disabled', state.platformLeft.disabled);
        pR.classList.toggle('disabled', state.platformRight.disabled);

        // Column headers
        const colHeaders = document.getElementById('columnHeaders');
        colHeaders.innerHTML = '';
        colHeaders.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
        for (let col = 0; col < state.cols; col++) {
            const ch = document.createElement('div');
            ch.className = 'column-header';
            ch.textContent = col + 1;
            ch.dataset.col = col;
            ch.addEventListener('contextmenu', e => { e.preventDefault(); this.showColumnContextMenu(e, col); });
            ch.addEventListener('touchstart', e => {
                this.longPressTimer = setTimeout(() => { e.preventDefault(); this.showColumnContextMenu(e.touches[0], col); }, 500);
            }, { passive: false });
            ch.addEventListener('touchend', () => clearTimeout(this.longPressTimer));
            ch.addEventListener('touchmove', () => clearTimeout(this.longPressTimer));
            colHeaders.appendChild(ch);
        }

        // Seats grid
        const grid = document.getElementById('seatsGrid');
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
        state.seats = [];
        const totalSeats = state.rows * state.cols;
        const randomNumbers = this.generateUniqueRandomNumbers(totalSeats);
        for (let row = 0; row < state.rows; row++) {
            for (let col = 0; col < state.cols; col++) {
                const seatEl = document.createElement('div');
                seatEl.className = 'seat';
                seatEl.dataset.row = row;
                seatEl.dataset.col = col;
                let seatNumber;
                if (state.settings.numberingMode === 'horizontal-snake') {
                    seatNumber = row % 2 === 0 ? row * state.cols + col + 1 : (row + 1) * state.cols - col;
                } else if (state.settings.numberingMode === 'vertical-snake') {
                    seatNumber = col % 2 === 0 ? col * state.rows + row + 1 : (col + 1) * state.rows - row;
                } else {
                    seatNumber = randomNumbers[row * state.cols + col];
                }
                seatEl.innerHTML = `<span class="seat-number">${seatNumber}</span><span class="seat-name" style="font-size:${state.settings.seatFontSize}px;"></span><span class="seat-gender"></span><div class="heatmap-overlay"></div>`;
                grid.appendChild(seatEl);
                state.seats.push({ element: seatEl, number: seatNumber, row, col, disabled: false, student: null, type: 'normal' });
            }
        }
        this.generateDrawOrder();
        this.checkAisles();
        this.bindSeatEvents();
        this.updateEmptyState();
        if (state.heatmapVisible) this.renderHeatmap();
        this.animateSeatsIn();
    },

    generateUniqueRandomNumbers(n) {
        const numbers = Array.from({ length: n }, (_, i) => i + 1);
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        return numbers;
    },

    generateDrawOrder() {
        state.drawOrder = [];
        if (!state.platformRight.disabled && state.showPlatformRight) state.drawOrder.push(state.platformRight);
        if (!state.platformLeft.disabled && state.showPlatformLeft) state.drawOrder.push(state.platformLeft);
        state.drawOrder.push(...[...state.seats].filter(s => !s.disabled).sort((a, b) => a.number - b.number));
    },

    // [FIX] Aisles no longer clear seat HTML
    checkAisles() {
        for (let col = 0; col < state.cols; col++) {
            let allDisabled = true;
            for (let row = 0; row < state.rows; row++) {
                if (!state.seats[row * state.cols + col].disabled) { allDisabled = false; break; }
            }
            for (let row = 0; row < state.rows; row++) {
                const s = state.seats[row * state.cols + col];
                s.element.classList.toggle('aisle', allDisabled);
            }
        }
    },

    updateEmptyState() {
        const es = document.getElementById('emptyState');
        const cl = document.getElementById('classroom');
        if (state.students.length === 0) { es.style.display = 'block'; cl.style.display = 'none'; }
        else { es.style.display = 'none'; cl.style.display = 'flex'; }
    },

    // [FIX] Unified seat event binding
    bindSeatEvents() {
        if (this._seatAbort) this._seatAbort.abort();
        this._seatAbort = new AbortController();
        const sig = this._seatAbort.signal;

        const bindSeat = (seat, el) => {
            el.draggable = state.settings.enableDragDrop;
            el.addEventListener('click', e => {
                if (state.batchMode) { this.toggleBatchSeat(seat); return; }
                if (state.swapMode && state.selectedSeat) {
                    if (state.selectedSeat !== seat && !seat.disabled) {
                        this.doSwap(state.selectedSeat, seat);
                    }
                    return;
                }
                // Pool click-to-place
                if (state.selectedPoolStudent !== null && !seat.student && !seat.disabled) {
                    const student = state.remainingStudents.find(s => s.id === state.selectedPoolStudent);
                    if (student) {
                        state.remainingStudents = state.remainingStudents.filter(s => s.id !== student.id);
                        state.drawnStudents.push(student);
                        seat.student = student;
                        this.updateSeatDisplay(seat);
                        this.updateStats();
                        this.updateProbabilityPanel();
                        this.renderPool();
                        state.selectedPoolStudent = null;
                        document.querySelectorAll('.seat').forEach(s => s.classList.remove('pool-target'));
                        addLog('🎯', `${student.name} 被点击分配到 ${seat.type === 'normal' ? seat.number + '号' : '讲台'}`);
                        Toast.success(`${student.name} 已分配到 ${seat.type === 'normal' ? seat.number + '号座位' : '讲台座位'}`);
                        return;
                    }
                }
                if (state.settings.enableClickSwap && seat.student) this.handleSeatClick(seat);
                else if (seat.student) this.toggleLunch(seat);
            }, { signal: sig });
            el.addEventListener('contextmenu', e => { e.preventDefault(); this.showContextMenu(e, seat); }, { signal: sig });
            // Long press
            let tts = 0, tsx = 0, tsy = 0;
            el.addEventListener('touchstart', e => {
                tts = Date.now(); tsx = e.touches[0].clientX; tsy = e.touches[0].clientY;
                this.longPressTimer = setTimeout(() => { e.preventDefault(); this.showContextMenu(e.touches[0], seat); }, 500);
            }, { passive: false, signal: sig });
            el.addEventListener('touchend', e => {
                clearTimeout(this.longPressTimer);
                if (!e.changedTouches || e.changedTouches.length === 0) return;
                const dur = Date.now() - tts;
                const dist = Math.hypot(e.changedTouches[0].clientX - tsx, e.changedTouches[0].clientY - tsy);
                if (dur < 300 && dist < 10) {
                    if (state.batchMode) { this.toggleBatchSeat(seat); return; }
                    if (state.swapMode && state.selectedSeat) {
                        if (state.selectedSeat !== seat && !seat.disabled) this.doSwap(state.selectedSeat, seat);
                        return;
                    }
                    if (state.settings.enableClickSwap && seat.student) this.handleSeatClick(seat);
                    else if (seat.student) this.toggleLunch(seat);
                }
            }, { signal: sig });
            el.addEventListener('touchmove', () => clearTimeout(this.longPressTimer), { signal: sig });
            // Drag & Drop
            if (state.settings.enableDragDrop) {
                el.addEventListener('dragstart', e => {
                    clearTimeout(this.longPressTimer); // [FIX #13] Cancel long press on drag
                    if (!seat.student) { e.preventDefault(); return; }
                    e.dataTransfer.setData('text/plain', JSON.stringify({ type: seat.type, index: seat.type === 'normal' ? state.seats.indexOf(seat) : seat.type }));
                    el.classList.add('dragging');
                }, { signal: sig });
                el.addEventListener('dragend', () => { el.classList.remove('dragging'); document.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over')); }, { signal: sig });
                el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); }, { signal: sig });
                el.addEventListener('dragleave', () => el.classList.remove('drag-over'), { signal: sig });
                el.addEventListener('drop', e => {
                    e.preventDefault(); el.classList.remove('drag-over');
                    try {
                        const src = JSON.parse(e.dataTransfer.getData('text/plain'));
                        const tgt = { type: seat.type, index: seat.type === 'normal' ? state.seats.indexOf(seat) : seat.type };
                        this.handleDrop(src, tgt);
                    } catch(err) { console.error('拖拽数据解析失败', err); }
                }, { signal: sig });
            }
            // Pool drop target
            el.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/pool-student')) e.preventDefault(); }, { signal: sig });
            el.addEventListener('drop', e => {
                if (e.dataTransfer.types.includes('text/pool-student')) {
                    e.preventDefault();
                    try {
                        const data = JSON.parse(e.dataTransfer.getData('text/pool-student'));
                        const student = state.remainingStudents.find(s => s.id === data.id);
                        if (student && !seat.student && !seat.disabled) {
                            // Remove from remaining, assign to seat
                            state.remainingStudents = state.remainingStudents.filter(s => s.id !== student.id);
                            state.drawnStudents.push(student);
                            seat.student = student;
                            this.updateSeatDisplay(seat);
                            this.updateStats();
                            this.updateProbabilityPanel();
                            this.renderPool();
                            addLog('🎯', `${student.name} 被拖拽分配到 ${seat.type === 'normal' ? seat.number + '号' : '讲台'}`);
                            Toast.success(`${student.name} 已分配到 ${seat.type === 'normal' ? seat.number + '号座位' : '讲台座位'}`);
                        }
                    } catch(err) {}
                }
            }, { signal: sig });
        };

        // Bind normal seats
        state.seats.forEach((seat, idx) => bindSeat(seat, seat.element));
        // Bind platform seats
        [state.platformLeft, state.platformRight].forEach(seat => {
            const el = document.getElementById(seat.type === 'platform-left' ? 'platformLeft' : 'platformRight');
            seat.element = el;
            bindSeat(seat, el);
        });
    },

    // ==================== Seat Operations ====================
    handleSeatClick(seat) {
        if (state.swapMode) return; // handled in click listener now
        if (state.selectedSeat === seat) this.clearSelection();
        else { this.clearSelection(); state.selectedSeat = seat; seat.element.classList.add('selected'); }
    },

    doSwap(s1, s2) {
        const desc = `${this.seatLabel(s1)} ↔ ${this.seatLabel(s2)}`;
        const oldS1 = s1.student, oldS2 = s2.student;
        UndoManager.push({
            desc: '互换: ' + desc,
            undo: () => { s1.student = oldS1; s2.student = oldS2; this.updateSeatDisplay(s1); this.updateSeatDisplay(s2); },
            redo: () => { s1.student = oldS2; s2.student = oldS1; this.updateSeatDisplay(s1); this.updateSeatDisplay(s2); }
        });
        this.swapSeats(s1, s2);
        this.clearSelection();
        Toast.success('座位互换成功');
        addLog('🔄', '互换: ' + desc);
    },

    swapSeats(s1, s2) {
        const temp = s1.student; s1.student = s2.student; s2.student = temp;
        this.updateSeatDisplay(s1); this.updateSeatDisplay(s2);
    },

    updateSeatDisplay(seat) {
        const el = seat.type === 'normal' ? seat.element : document.getElementById(seat.type === 'platform-left' ? 'platformLeft' : 'platformRight');
        if (!el) return;
        el.className = seat.type === 'normal' ? 'seat' : 'platform-side-seat';
        if (seat.disabled) { el.classList.add('disabled'); this.clearSeatName(el); return; }
        if (seat.student) {
            el.classList.add(seat.student.gender);
            if (seat.student.pinned) el.classList.add('pinned');
            const nameEl = el.querySelector('.seat-name');
            if (nameEl) {
                nameEl.textContent = seat.student.name;
                nameEl.style.fontSize = `${state.settings.seatFontSize}px`;
                if (seat.student.lunch) {
                    nameEl.classList.add('lunch-underline');
                    nameEl.style.textDecorationColor = state.settings.lunchUnderlineColor;
                } else {
                    nameEl.classList.remove('lunch-underline');
                    nameEl.style.textDecorationColor = '';
                }
            }
            if (seat.type === 'normal') {
                const gEl = el.querySelector('.seat-gender');
                if (gEl) gEl.textContent = seat.student.gender === 'male' ? '男' : '女';
            }
            // [FIX] No-score visual indicator
            if (seat.student.score === null || seat.student.score === undefined) {
                el.classList.add('no-score');
            } else {
                el.classList.remove('no-score');
            }
        } else {
            this.clearSeatName(el);
            el.classList.remove('no-score');
        }
        // Heatmap overlay (uses overlay div, not background)
        const overlay = el.querySelector('.heatmap-overlay');
        if (overlay) {
            if (state.heatmapVisible && seat.student && seat.student.score !== undefined && seat.student.score !== null) {
                overlay.style.background = this.getHeatmapColor(seat.student.score, 0.3);
            } else {
                overlay.style.background = 'transparent';
            }
        }
    },

    clearSeatName(el) {
        const nameEl = el.querySelector('.seat-name');
        if (nameEl) { nameEl.textContent = ''; nameEl.classList.remove('lunch-underline'); nameEl.style.textDecorationColor = ''; }
        const gEl = el.querySelector('.seat-gender');
        if (gEl) gEl.textContent = '';
        const overlay = el.querySelector('.heatmap-overlay');
        if (overlay) overlay.style.background = 'transparent';
        el.classList.remove('pinned');
    },

    clearSelection() {
        if (state.selectedSeat && state.selectedSeat.element) state.selectedSeat.element.classList.remove('selected');
        state.selectedSeat = null; state.swapMode = false;
    },

    toggleLunch(seat) {
        if (!seat.student) return;
        const old = seat.student.lunch;
        seat.student.lunch = !seat.student.lunch;
        UndoManager.push({
            desc: `${seat.student.name} ${old ? '取消' : '标记'}午休`,
            undo: () => { seat.student.lunch = old; this.updateSeatDisplay(seat); this.updateStats(); this.renderPool(); },
            redo: () => { seat.student.lunch = !old; this.updateSeatDisplay(seat); this.updateStats(); this.renderPool(); }
        });
        this.updateSeatDisplay(seat); this.updateStats(); this.renderPool();
        Toast.success(`${seat.student.name} 已${seat.student.lunch ? '标记' : '取消'}午休`);
        addLog('💤', `${seat.student.name} ${seat.student.lunch ? '标记' : '取消'}午休`);
    },

    clearSeat(seat) {
        if (!seat.student) return;
        const student = seat.student;
        const seatLabel = this.seatLabel(seat);
        state.remainingStudents.push(student);
        state.drawnStudents = state.drawnStudents.filter(s => s.id !== student.id);
        seat.student = null;
        UndoManager.push({
            desc: `${student.name} 移至待选区`,
            undo: () => {
                state.remainingStudents = state.remainingStudents.filter(s => s.id !== student.id);
                state.drawnStudents.push(student);
                seat.student = student;
                this.updateSeatDisplay(seat); this.updateStats(); this.updateProbabilityPanel(); this.renderPool();
            },
            redo: () => {
                state.remainingStudents.push(student);
                state.drawnStudents = state.drawnStudents.filter(s => s.id !== student.id);
                seat.student = null;
                this.updateSeatDisplay(seat); this.updateStats(); this.updateProbabilityPanel(); this.renderPool();
            }
        });
        this.updateSeatDisplay(seat); this.updateStats(); this.updateProbabilityPanel(); this.renderPool();
        Toast.success(`${student.name} 已移至待选区`);
        addLog('↩️', `${student.name} 从 ${seatLabel} 移至待选区`);
    },

    disableSeat(seat) {
        if (seat.student) { Toast.warning('请先清空该座位再禁用'); return; }
        seat.disabled = true;
        UndoManager.push({
            desc: `禁用座位 ${this.seatLabel(seat)}`,
            undo: () => { seat.disabled = false; seat.element.classList.remove('aisle'); this.updateSeatDisplay(seat); this.generateDrawOrder(); this.checkAisles(); },
            redo: () => { seat.disabled = true; this.updateSeatDisplay(seat); this.generateDrawOrder(); this.checkAisles(); }
        });
        this.updateSeatDisplay(seat); this.generateDrawOrder(); this.checkAisles();
        Toast.success('座位已禁用'); addLog('🚫', `禁用座位 ${this.seatLabel(seat)}`);
    },

    enableSeat(seat) {
        seat.disabled = false;
        UndoManager.push({
            desc: `启用座位 ${this.seatLabel(seat)}`,
            undo: () => { seat.disabled = true; this.updateSeatDisplay(seat); this.generateDrawOrder(); this.checkAisles(); },
            redo: () => { seat.disabled = false; seat.element.classList.remove('aisle'); this.updateSeatDisplay(seat); this.generateDrawOrder(); }
        });
        seat.element.classList.remove('aisle');
        this.updateSeatDisplay(seat); this.generateDrawOrder();
        Toast.success('座位已启用'); addLog('✅', `启用座位 ${this.seatLabel(seat)}`);
    },

    disableColumn(col) {
        const clearedStudents = [];
        for (let row = 0; row < state.rows; row++) {
            const s = state.seats[row * state.cols + col];
            if (s.student) { clearedStudents.push({ seat: s, student: s.student }); this.clearSeat(s); }
            s.disabled = true; this.updateSeatDisplay(s);
        }
        UndoManager.push({
            desc: `禁用第 ${col + 1} 列`,
            undo: () => {
                for (let row = 0; row < state.rows; row++) {
                    const s = state.seats[row * state.cols + col];
                    s.disabled = false; s.element.classList.remove('aisle'); this.updateSeatDisplay(s);
                }
                clearedStudents.forEach(({ seat, student }) => {
                    state.remainingStudents = state.remainingStudents.filter(s => s.id !== student.id);
                    state.drawnStudents.push(student);
                    seat.student = student;
                    this.updateSeatDisplay(seat);
                });
                this.generateDrawOrder(); this.checkAisles(); this.updateStats(); this.renderPool();
            },
            redo: () => {
                for (let row = 0; row < state.rows; row++) {
                    const s = state.seats[row * state.cols + col];
                    if (s.student) this.clearSeat(s);
                    s.disabled = true; this.updateSeatDisplay(s);
                }
                this.generateDrawOrder(); this.checkAisles();
            }
        });
        this.generateDrawOrder(); this.checkAisles();
        Toast.success(`第 ${col + 1} 列已禁用`); addLog('🚫', `禁用第 ${col + 1} 列`);
    },

    enableColumn(col) {
        for (let row = 0; row < state.rows; row++) {
            const s = state.seats[row * state.cols + col];
            s.disabled = false; s.element.classList.remove('aisle'); this.updateSeatDisplay(s);
        }
        UndoManager.push({
            desc: `启用第 ${col + 1} 列`,
            undo: () => {
                for (let row = 0; row < state.rows; row++) {
                    const s = state.seats[row * state.cols + col];
                    if (s.student) this.clearSeat(s);
                    s.disabled = true; this.updateSeatDisplay(s);
                }
                this.generateDrawOrder(); this.checkAisles();
            },
            redo: () => {
                for (let row = 0; row < state.rows; row++) {
                    const s = state.seats[row * state.cols + col];
                    s.disabled = false; s.element.classList.remove('aisle'); this.updateSeatDisplay(s);
                }
                this.generateDrawOrder();
            }
        });
        this.generateDrawOrder();
        Toast.success(`第 ${col + 1} 列已启用`); addLog('✅', `启用第 ${col + 1} 列`);
    },

    seatLabel(seat) {
        if (seat.type === 'platform-left') return '讲台左';
        if (seat.type === 'platform-right') return '讲台右';
        return seat.number + '号';
    },

    // ==================== Batch Mode ====================
    toggleBatchSeat(seat) {
        const idx = state.batchSeats.indexOf(seat);
        if (idx >= 0) { state.batchSeats.splice(idx, 1); seat.element.classList.remove('selected'); }
        else { state.batchSeats.push(seat); seat.element.classList.add('selected'); }
        document.getElementById('batchCount').textContent = state.batchSeats.length;
    },

    enterBatchMode() {
        state.batchMode = true; state.batchSeats = [];
        document.getElementById('batchToolbar').classList.add('visible');
        document.getElementById('quickInfo').style.display = 'none';
        document.getElementById('batchCount').textContent = '0';
    },

    exitBatchMode() {
        state.batchMode = false;
        state.batchSeats.forEach(s => s.element.classList.remove('selected'));
        state.batchSeats = [];
        document.getElementById('batchToolbar').classList.remove('visible');
        document.getElementById('quickInfo').style.display = '';
    },

    // ==================== Context Menus ====================
    showContextMenu(e, seat) {
        const menu = document.getElementById('seatContextMenu');
        const menuW = 200, menuH = 320;
        let x = e.clientX || e.pageX, y = e.clientY || e.pageY;
        if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 8;
        if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
        if (x < 8) x = 8; if (y < 8) y = 8;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
        menu.dataset.seatType = seat.type;
        menu.dataset.seatIndex = seat.type === 'normal' ? state.seats.indexOf(seat) : '';
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.style.display = 'block';
            const a = item.dataset.action;
            if (!seat.student && ['swap','moveToPool','toggleLunch','clearSeat','togglePin','viewInfo'].includes(a)) item.style.display = 'none';
            if (a === 'enableSeat') item.style.display = seat.disabled ? 'block' : 'none';
            if (a === 'disableSeat') item.style.display = seat.disabled ? 'none' : 'block';
            if (a === 'togglePin' && seat.student) item.textContent = seat.student.pinned ? '📌 取消固定' : '📌 固定学生';
        });
        if (this._closeMenuFn) document.removeEventListener('click', this._closeMenuFn);
        this._closeMenuFn = () => { menu.style.display = 'none'; document.removeEventListener('click', this._closeMenuFn); };
        setTimeout(() => document.addEventListener('click', this._closeMenuFn), 0);
    },

    showColumnContextMenu(e, col) {
        const menu = document.getElementById('columnContextMenu');
        let x = e.clientX || e.pageX, y = e.clientY || e.pageY;
        if (x + 200 > window.innerWidth) x = window.innerWidth - 208;
        if (y + 100 > window.innerHeight) y = window.innerHeight - 108;
        if (x < 8) x = 8; if (y < 8) y = 8;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
        menu.dataset.col = col;
        let allDisabled = true;
        for (let row = 0; row < state.rows; row++) { if (!state.seats[row * state.cols + col].disabled) { allDisabled = false; break; } }
        menu.querySelector('[data-action="disableColumn"]').style.display = allDisabled ? 'none' : 'block';
        menu.querySelector('[data-action="enableColumn"]').style.display = allDisabled ? 'block' : 'none';
        if (this._closeMenuFn) document.removeEventListener('click', this._closeMenuFn);
        this._closeMenuFn = () => { menu.style.display = 'none'; document.removeEventListener('click', this._closeMenuFn); };
        setTimeout(() => document.addEventListener('click', this._closeMenuFn), 0);
    },

    handleDrop(source, target) {
        const getSeat = d => {
            if (d.type === 'normal') return state.seats[d.index];
            if (d.type === 'platform-left') return state.platformLeft;
            if (d.type === 'platform-right') return state.platformRight;
            return state[d.type];
        };
        const src = getSeat(source), tgt = getSeat(target);
        if (src && tgt && src !== tgt && !tgt.disabled && src.student) {
            this.doSwap(src, tgt);
        }
    },

    // ==================== Stats ====================
    updateStats() {
        const el = id => document.getElementById(id);
        // Settings console stats
        if (el('stTotal')) el('stTotal').textContent = state.students.length;
        if (el('stDrawn')) el('stDrawn').textContent = state.drawnStudents.length;
        if (el('stRemaining')) el('stRemaining').textContent = state.remainingStudents.length;
        if (el('stLunch')) el('stLunch').textContent = state.drawnStudents.filter(s => s.lunch).length;
        if (el('stLayout')) el('stLayout').textContent = `${state.rows}×${state.cols}`;
        el('poolSubtitle').textContent = `${state.remainingStudents.length} 人待抽取`;
        this.updateQuickInfo();
    },

    updateProbabilityPanel() {
        const panel = document.getElementById('probabilityPanel');
        if (state.settings.drawMode !== 'predictable' || !state.settings.showProbabilityByDefault) { panel.style.display = 'none'; return; }
        panel.style.display = 'block';
        const probs = Algorithm.calculateProbabilities().slice(0, 5);
        const list = document.getElementById('probabilityContent');
        list.innerHTML = '';
        probs.forEach(item => {
            const div = document.createElement('div');
            div.className = 'probability-item';
            div.innerHTML = `<span class="probability-name">${escapeHtml(item.student.name)}</span><span class="probability-value">${(item.probability * 100).toFixed(1)}%</span>`;
            list.appendChild(div);
        });
    },

    // ==================== Fill Seat ====================
    fillSeat(student) {
        while (state.currentDrawIndex < state.drawOrder.length) {
            const seat = state.drawOrder[state.currentDrawIndex];
            if (!seat.student && !seat.disabled) {
                seat.student = student;
                this.updateSeatDisplay(seat);
                const el = seat.type === 'normal' ? seat.element : document.getElementById(seat.type === 'platform-left' ? 'platformLeft' : 'platformRight');
                if (el) { el.classList.add('drawing'); setTimeout(() => el.classList.remove('drawing'), state.settings.drawAnimationDuration); }
                state.currentDrawIndex++;
                Object.keys(state.plugins).forEach(pn => {
                    try { PluginManager.call(pn, 'afterDraw', student, seat); } catch(e) {}
                });
                return seat;
            }
            state.currentDrawIndex++;
        }
        return null;
    },

    // ==================== Reset ====================
    resetDraw() {
        this.stopAutoDraw();
        const prevDrawn = [...state.drawnStudents];
        const prevSeats = state.seats.map(s => ({ student: s.student, disabled: s.disabled }));
        const prevPL = state.platformLeft.student;
        const prevPR = state.platformRight.student;
        const prevDrawIdx = state.currentDrawIndex;
        UndoManager.push({
            desc: '重置抽取',
            undo: () => {
                state.drawnStudents = prevDrawn;
                state.remainingStudents = state.students.filter(s => !prevDrawn.some(d => d.id === s.id));
                prevSeats.forEach((sv, i) => { if (state.seats[i]) { state.seats[i].student = sv.student; this.updateSeatDisplay(state.seats[i]); } });
                state.platformLeft.student = prevPL; state.platformRight.student = prevPR;
                this.updateSeatDisplay(state.platformLeft); this.updateSeatDisplay(state.platformRight);
                state.currentDrawIndex = prevDrawIdx;
                this.updateStats(); this.updateProbabilityPanel(); this.renderPool();
            },
            redo: () => {
                state.drawnStudents = [];
                state.remainingStudents = [...state.students];
                state.currentDrawIndex = 0;
                state.platformLeft.student = null; state.platformRight.student = null;
                this.updateSeatDisplay(state.platformLeft); this.updateSeatDisplay(state.platformRight);
                state.seats.forEach(seat => { seat.student = null; this.updateSeatDisplay(seat); });
                this.updateStats(); this.updateProbabilityPanel(); this.updateEmptyState(); this.renderPool();
            }
        });
        state.drawnStudents = [];
        state.remainingStudents = [...state.students];
        state.currentDrawIndex = 0;
        state.platformLeft.student = null; state.platformRight.student = null;
        this.updateSeatDisplay(state.platformLeft); this.updateSeatDisplay(state.platformRight);
        state.seats.forEach(seat => { seat.student = null; this.updateSeatDisplay(seat); });
        this.clearSelection();
        this.updateStats(); this.updateProbabilityPanel(); this.updateEmptyState(); this.renderPool();
        document.getElementById('stopAutoDraw').style.display = 'none';
        document.getElementById('autoDraw').style.display = 'inline-flex';
        Toast.success('抽取已重置');
        addLog('🔄', '抽取已重置');
    },

    // ==================== Auto Draw (Built-in, not plugin) ====================
    startAutoDraw() {
        if (this._autoDrawRunning) return;
        this._autoDrawRunning = true;
        document.getElementById('autoDraw').style.display = 'none';
        document.getElementById('stopAutoDraw').style.display = 'inline-flex';
        const interval = state.settings.autoDrawInterval || 800;
        this._autoDrawInterval = setInterval(() => {
            if (state.remainingStudents.length === 0) { this.stopAutoDraw(); Toast.success('所有学生已抽取完毕'); return; }
            this.doDrawNext();
        }, interval);
        addLog('⚡', '开始自动抽取');
    },

    stopAutoDraw() {
        this._autoDrawRunning = false;
        if (this._autoDrawInterval) { clearInterval(this._autoDrawInterval); this._autoDrawInterval = null; }
        document.getElementById('stopAutoDraw').style.display = 'none';
        document.getElementById('autoDraw').style.display = 'inline-flex';
    },

    doDrawNext() {
        if (state.remainingStudents.length === 0) { Toast.warning('所有学生已抽取完毕'); return null; }
        // Save history before draw
        Algorithm.pushHistory();
        // [FIX #5] Snapshot for undo
        const snapRemaining = [...state.remainingStudents];
        const snapDrawn = [...state.drawnStudents];
        const seatSnapshots = {};
        [...state.seats, state.platformLeft, state.platformRight].forEach(s => {
            if (s.student) seatSnapshots[s.type === 'normal' ? `s${s.number}` : s.type] = JSON.parse(JSON.stringify(s.student)); // [AUDIT-4] Deep clone
        });
        const student = Algorithm.drawStudent();
        if (!student) return null;
        const seat = this.fillSeat(student);
        if (seat) {
            state.drawnStudents.push(student);
            const drawnName = student.name;
            const seatLbl = this.seatLabel(seat);
            // Push undo action
            UndoManager.push({
                desc: `抽取 ${drawnName} → ${seatLbl}`,
                undo: () => {
                    // Restore state
                    state.remainingStudents = snapRemaining;
                    state.drawnStudents = snapDrawn;
                    // Clear the seat
                    if (seat.student) { seat.student = null; }
                    // Restore all seat students from snapshot
                    [...state.seats, state.platformLeft, state.platformRight].forEach(s => {
                        const key = s.type === 'normal' ? `s${s.number}` : s.type;
                        if (seatSnapshots[key]) s.student = seatSnapshots[key];
                        else if (s === seat) s.student = null;
                    });
                    // Restore currentDrawIndex
                    if (state.currentDrawIndex > 0) state.currentDrawIndex--;
                    this.updateSeatDisplay(seat);
                    state.seats.forEach(ss => this.updateSeatDisplay(ss));
                    this.updateSeatDisplay(state.platformLeft);
                    this.updateSeatDisplay(state.platformRight);
                    this.updateStats(); this.updateProbabilityPanel(); this.renderPool();
                },
                redo: () => {
                    // Re-assign
                    const sIdx = state.remainingStudents.findIndex(s => s.id === student.id);
                    if (sIdx >= 0) state.remainingStudents.splice(sIdx, 1);
                    seat.student = student;
                    if (!state.drawnStudents.some(d => d.id === student.id)) state.drawnStudents.push(student);
                    this.updateSeatDisplay(seat);
                    this.updateStats(); this.updateProbabilityPanel(); this.renderPool();
                }
            });
            this.updateStats(); this.updateProbabilityPanel(); this.renderPool();
            return seat;
        }
        return null;
    },

    // ==================== Heatmap (Multi-type) ====================
    getHeatmapColor(score, alpha = 1) {
        const s = clamp(score, 0, 100);
        const hue = (s / 100) * 120;
        return `hsla(${hue}, 80%, 50%, ${alpha})`;
    },

    getHeatmapScore(student) {
        if (!student) return null;
        switch (state.heatmapType) {
            case 'composite': return CompositeEval.getScore(student);
            case 'average': return CompositeEval.getAvgScore(student);
            case 'subject': {
                const subj = document.getElementById('heatmapSubjectSelect')?.value;
                return subj ? CompositeEval.getSubjectScore(student, subj) : null;
            }
            default: return student.score;
        }
    },

    renderHeatmap() {
        // [FEATURE #23] Batch heatmap updates with requestAnimationFrame
        const updates = [];
        state.seats.forEach(seat => {
            const overlay = seat.element.querySelector('.heatmap-overlay');
            if (!overlay) return;
            if (seat.student) {
                const score = this.getHeatmapScore(seat.student);
                if (score !== null && score !== undefined) {
                    updates.push({ overlay, bg: this.getHeatmapColor(score, 0.35) });
                } else {
                    updates.push({ overlay, bg: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(120,120,128,0.12) 3px, rgba(120,120,128,0.12) 6px)' });
                }
            } else {
                updates.push({ overlay, bg: 'transparent' });
            }
        });
        [state.platformLeft, state.platformRight].forEach(seat => {
            const el = document.getElementById(seat.type === 'platform-left' ? 'platformLeft' : 'platformRight');
            if (!el) return;
            let overlay = el.querySelector('.heatmap-overlay');
            if (!overlay) { overlay = document.createElement('div'); overlay.className = 'heatmap-overlay'; el.appendChild(overlay); }
            if (seat.student) {
                const score = this.getHeatmapScore(seat.student);
                if (score !== null && score !== undefined) {
                    updates.push({ overlay, bg: this.getHeatmapColor(score, 0.35) });
                } else {
                    updates.push({ overlay, bg: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(120,120,128,0.12) 3px, rgba(120,120,128,0.12) 6px)' });
                }
            } else {
                updates.push({ overlay, bg: 'transparent' });
            }
        });
        // Apply all updates in a single rAF batch
        requestAnimationFrame(() => {
            updates.forEach(({ overlay, bg }) => { overlay.style.background = bg; });
        });
    },

    clearHeatmap() {
        state.seats.forEach(seat => {
            const overlay = seat.element.querySelector('.heatmap-overlay');
            if (overlay) overlay.style.background = 'transparent';
            seat.element.classList.remove('no-score');
        });
        [state.platformLeft, state.platformRight].forEach(seat => {
            const el = document.getElementById(seat.type === 'platform-left' ? 'platformLeft' : 'platformRight');
            if (!el) return;
            const overlay = el.querySelector('.heatmap-overlay');
            if (overlay) overlay.style.background = 'transparent';
        });
    },

    // ==================== Pin Student ====================
    togglePin(seat) {
        if (!seat.student) return;
        seat.student.pinned = !seat.student.pinned;
        seat.element.classList.toggle('pinned', seat.student.pinned);
        Toast.success(`${seat.student.name} 已${seat.student.pinned ? '固定' : '取消固定'}`);
        addLog(seat.student.pinned ? '📌' : '📍', `${seat.student.name} ${seat.student.pinned ? '固定' : '取消固定'}`);
    },

    // ==================== Student Info Popup ====================
    showStudentInfo(seat) {
        if (!seat.student) return;
        const s = seat.student;
        const modal = document.getElementById('studentDetailModal');
        document.getElementById('studentDetailName').textContent = `${s.name} 的详细信息`;

        let html = '';

        // Basic info section
        html += `<div class="detail-section"><div class="detail-section-title">👤 基本信息</div><div class="detail-grid">`;
        html += `<div class="detail-item"><span class="detail-item-label">姓名</span><span class="detail-item-value">${escapeHtml(s.name)}</span></div>`;
        html += `<div class="detail-item"><span class="detail-item-label">性别</span><span class="detail-item-value">${s.gender === 'male' ? '♂ 男' : '♀ 女'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-item-label">午休</span><span class="detail-item-value">${s.lunch ? '💤 是' : '否'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-item-label">座位</span><span class="detail-item-value">${this.seatLabel(seat)}</span></div>`;
        if (s.personality) html += `<div class="detail-item"><span class="detail-item-label">性格</span><span class="detail-item-value">${escapeHtml(s.personality)}</span></div>`;
        if (s.position) html += `<div class="detail-item"><span class="detail-item-label">职务</span><span class="detail-item-value">${escapeHtml(s.position)}</span></div>`;
        if (s.hobbies && s.hobbies.length > 0) html += `<div class="detail-item" style="grid-column:1/-1;"><span class="detail-item-label">爱好</span><span class="detail-item-value">${s.hobbies.join(' / ')}</span></div>`;
        if (s.pinned) html += `<div class="detail-item"><span class="detail-item-label">状态</span><span class="detail-item-value">📌 已固定</span></div>`;
        html += `</div></div>`;

        // Scores section
        const scores = s.scores || {};
        const scoreEntries = Object.entries(scores).filter(([k, v]) => v !== null && v !== undefined);
        if (scoreEntries.length > 0) {
            html += `<div class="detail-section"><div class="detail-section-title">📊 各科成绩</div>`;
            scoreEntries.forEach(([subj, score]) => {
                const color = score >= 90 ? 'var(--success)' : score >= 80 ? 'var(--primary)' : score >= 70 ? 'var(--warning)' : score >= 60 ? '#FF9500' : 'var(--danger)';
                html += `<div class="detail-score-bar"><span class="detail-score-label">${subj}</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${score}%;background:${color};">${score}</div></div></div>`;
            });
            html += `</div>`;
        }

        // Composite evaluation section
        const compositeScore = CompositeEval.getScore(s);
        const avgScore = CompositeEval.getAvgScore(s);
        html += `<div class="detail-section"><div class="detail-section-title">🏆 综合评价</div>`;
        html += `<div class="detail-grid">`;
        html += `<div class="detail-item"><span class="detail-item-label">综合评分</span><span class="detail-item-value" style="color:var(--primary);font-size:16px;">${compositeScore}</span></div>`;
        html += `<div class="detail-item"><span class="detail-item-label">平均成绩</span><span class="detail-item-value">${avgScore ?? 'N/A'}</span></div>`;
        html += `</div>`;
        // Dimension breakdown
        const w = state.settings.weights;
        html += `<div style="margin-top:10px;">`;
        if (w.academic > 0 && avgScore !== null) html += `<div class="detail-score-bar"><span class="detail-score-label">学业</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${avgScore}%;background:var(--primary);">${avgScore}</div></div></div>`;
        if (w.personality > 0 && s.personality) { const ps = s.personality === '中性' ? 80 : s.personality === '外向' ? 70 : 65; html += `<div class="detail-score-bar"><span class="detail-score-label">性格</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${ps}%;background:var(--success);">${ps}</div></div></div>`; }
        if (w.hobby > 0 && s.hobbies?.length > 0) { const hs = Math.min(100, 50 + s.hobbies.length * 10); html += `<div class="detail-score-bar"><span class="detail-score-label">爱好</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${hs}%;background:var(--warning);">${hs}</div></div></div>`; }
        if (w.position > 0 && s.position) { const posScores = { '班长': 95, '副班长': 90, '学习委员': 90, '体育委员': 85, '文艺委员': 85, '劳动委员': 80, '小组长': 75, '课代表': 80 }; const poss = posScores[s.position] || 60; html += `<div class="detail-score-bar"><span class="detail-score-label">职务</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${poss}%;background:var(--info);">${poss}</div></div></div>`; }
        html += `</div></div>`;

        document.getElementById('studentDetailContent').innerHTML = html;
        modal.classList.add('active');

        // Close handlers
        document.getElementById('closeStudentDetail').onclick = () => modal.classList.remove('active');
        document.getElementById('closeStudentDetailBtn').onclick = () => modal.classList.remove('active');
        document.getElementById('locateStudentBtn').style.display = '';
        document.getElementById('locateStudentBtn').onclick = () => {
            modal.classList.remove('active');
            seat.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            seat.element.classList.add('selected');
            setTimeout(() => seat.element.classList.remove('selected'), 2000);
        };
        // [FIX #8] Edit button handler
        document.getElementById('editStudentBtn').style.display = '';
        document.getElementById('editStudentBtn').onclick = () => {
            const content = document.getElementById('studentDetailContent');
            const editHtml = `<div class="detail-section"><div class="detail-section-title">✏️ 编辑信息</div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">姓名</label><input class="form-input" id="editName" value="${s.name}"></div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">性别</label><select class="form-input" id="editGender"><option value="male" ${s.gender==='male'?'selected':''}>♂ 男</option><option value="female" ${s.gender==='female'?'selected':''}>♀ 女</option></select></div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">午休</label><select class="form-input" id="editLunch"><option value="true" ${s.lunch?'selected':''}>是</option><option value="false" ${!s.lunch?'selected':''}>否</option></select></div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">性格</label><input class="form-input" id="editPersonality" value="${s.personality||''}"></div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">职务</label><input class="form-input" id="editPosition" value="${s.position||''}"></div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">爱好 (逗号分隔)</label><input class="form-input" id="editHobbies" value="${(s.hobbies||[]).join(',')}"></div>
                <button class="btn btn-primary" id="saveEditBtn" style="margin-top:8px;">💾 保存</button>
            </div>`;
            content.innerHTML = editHtml;
            document.getElementById('editStudentBtn').style.display = 'none';
            document.getElementById('saveEditBtn').onclick = () => {
                s.name = document.getElementById('editName').value.trim() || s.name;
                s.gender = document.getElementById('editGender').value;
                s.lunch = document.getElementById('editLunch').value === 'true';
                s.personality = document.getElementById('editPersonality').value.trim() || null;
                s.position = document.getElementById('editPosition').value.trim() || null;
                const hobbiesStr = document.getElementById('editHobbies').value.trim();
                s.hobbies = hobbiesStr ? hobbiesStr.split(',').map(h => h.trim()).filter(h => h) : [];
                this.updateSeatDisplay(seat);
                this.updateStats();
                this.renderPool();
                modal.classList.remove('active');
                Toast.success('学生信息已更新');
            };
        };
    },

    // ==================== Door Position ====================
    applyDoorPosition() {
        const front = document.getElementById('frontDoor');
        const back = document.getElementById('backDoor');
        const isPodium = document.getElementById('classroom').classList.contains('podium-view');
        const frontDisplay = front.style.display;
        const backDisplay = back.style.display;
        // Reset position styles (preserve display)
        front.style.cssText = '';
        back.style.cssText = '';
        front.style.display = frontDisplay;
        back.style.display = backDisplay;
        // [FIX #3] Reset perspective classes
        front.classList.remove('podium-far', 'podium-near');
        back.classList.remove('podium-far', 'podium-near');

        if (isPodium) {
            // [FIX #3] Podium view: original front door is "far" (top of view), back door is "near" (bottom)
            switch (state.doorPosition) {
                case 'right':
                    front.textContent = '后门';
                    front.classList.add('podium-far');
                    front.style.top = '48px'; front.style.left = '12px';
                    back.textContent = '前门';
                    back.classList.add('podium-near');
                    back.style.bottom = '48px'; back.style.left = '12px';
                    break;
                case 'left':
                    front.textContent = '后门';
                    front.classList.add('podium-far');
                    front.style.top = '48px'; front.style.right = '12px';
                    back.textContent = '前门';
                    back.classList.add('podium-near');
                    back.style.bottom = '48px'; back.style.right = '12px';
                    break;
                case 'front-right-back-left':
                    front.textContent = '后门';
                    front.classList.add('podium-far');
                    front.style.top = '48px'; front.style.left = '12px';
                    back.textContent = '前门';
                    back.classList.add('podium-near');
                    back.style.bottom = '48px'; back.style.right = '12px';
                    break;
                case 'front-left-back-right':
                    front.textContent = '后门';
                    front.classList.add('podium-far');
                    front.style.top = '48px'; front.style.right = '12px';
                    back.textContent = '前门';
                    back.classList.add('podium-near');
                    back.style.bottom = '48px'; back.style.left = '12px';
                    break;
            }
        } else {
            front.textContent = '前门';
            back.textContent = '后门';
            switch (state.doorPosition) {
                case 'right':
                    front.style.top = '48px'; front.style.right = '12px';
                    back.style.bottom = '48px'; back.style.right = '12px';
                    break;
                case 'left':
                    front.style.top = '48px'; front.style.left = '12px';
                    back.style.bottom = '48px'; back.style.left = '12px';
                    break;
                case 'front-right-back-left':
                    front.style.top = '48px'; front.style.right = '12px';
                    back.style.bottom = '48px'; back.style.left = '12px';
                    break;
                case 'front-left-back-right':
                    front.style.top = '48px'; front.style.left = '12px';
                    back.style.bottom = '48px'; back.style.right = '12px';
                    break;
            }
        }
    },

    // ==================== Perspective Toggle ====================
    togglePerspective() {
        const cl = document.getElementById('classroom');
        cl.classList.toggle('podium-view');
        const btn = document.getElementById('togglePerspective');
        this.applyDoorPosition();
        if (cl.classList.contains('podium-view')) {
            btn.textContent = '📐 平面视图';
            Toast.info('已切换到讲台视角');
        } else {
            btn.textContent = '🎓 讲台视角';
            Toast.info('已切换到平面视图');
        }
    },

    // ==================== Screenshot Preview ====================
    _previewCanvas: null,
    showPreviewModal() {
        document.getElementById('previewModal').classList.add('active');
        document.getElementById('previewFrame').innerHTML = '<p style="color:var(--text-tertiary);">点击"生成预览"查看效果</p>';
        this._previewCanvas = null;
    },
    generatePreview() {
        const frame = document.getElementById('previewFrame');
        frame.innerHTML = '<p style="color:var(--text-tertiary);">正在生成预览...</p>';
        const scale = parseInt(document.getElementById('previewScale').value) || 2;
        const includeDoors = document.getElementById('previewIncludeDoors').checked;
        const includePlatform = document.getElementById('previewIncludePlatform').checked;
        const includeTitle = document.getElementById('previewIncludeTitle').checked;
        const watermark = document.getElementById('previewWatermark').value.trim();
        const includeDate = document.getElementById('previewIncludeDate').checked;
        const bgColor = state.settings.screenshotTransparentBg ? null : state.settings.screenshotBgColor;
        const classroom = document.getElementById('classroom');
        // [FIX #6] Use onclone callback to position doors in cloned DOM instead of moving real DOM
        setTimeout(() => {
            html2canvas(classroom, {
                backgroundColor: bgColor, scale: scale, useCORS: true, allowTaint: true,
                logging: false, scrollX: 0, scrollY: 0,
                onclone: (clonedDoc) => {
                    const clonedClassroom = clonedDoc.getElementById('classroom');
                    if (!clonedClassroom) return;
                    // Hide UI elements in clone
                    const qi = clonedDoc.getElementById('quickInfo');
                    if (qi) qi.style.display = 'none';
                    const legend = clonedDoc.getElementById('seatLegend');
                    if (legend) legend.style.display = 'none';
                    const podium = clonedDoc.querySelector('.podium-toggle');
                    if (podium) podium.style.display = 'none';
                    const hmLegend = clonedDoc.getElementById('heatmapLegend');
                    if (hmLegend) hmLegend.style.display = 'none';
                    // Handle platform seats
                    if (!includePlatform) {
                        const pL = clonedDoc.getElementById('platformLeft'), pR = clonedDoc.getElementById('platformRight');
                        if (pL) pL.style.display = 'none';
                        if (pR) pR.style.display = 'none';
                    }
                    // Handle doors - position absolutely in cloned classroom
                    if (includeDoors) {
                        const frontDoor = clonedDoc.getElementById('frontDoor');
                        const backDoor = clonedDoc.getElementById('backDoor');
                        if (frontDoor) {
                            frontDoor.style.display = 'block';
                            frontDoor.style.position = 'absolute';
                            clonedClassroom.appendChild(frontDoor);
                        }
                        if (backDoor) {
                            backDoor.style.display = 'block';
                            backDoor.style.position = 'absolute';
                            clonedClassroom.appendChild(backDoor);
                        }
                    }
                }
            }).then(canvas => {
                // Add watermark
                if (watermark) {
                    const ctx = canvas.getContext('2d');
                    ctx.save();
                    ctx.globalAlpha = 0.12;
                    ctx.font = `${Math.floor(canvas.width / 20)}px ${getComputedStyle(document.body).getPropertyValue('--font-sans')}`;
                    ctx.fillStyle = '#000';
                    ctx.textAlign = 'center';
                    ctx.translate(canvas.width / 2, canvas.height / 2);
                    ctx.rotate(-Math.PI / 6);
                    ctx.fillText(watermark, 0, 0);
                    ctx.restore();
                }
                // Add date
                if (includeDate) {
                    const ctx = canvas.getContext('2d');
                    ctx.save();
                    ctx.globalAlpha = 0.5;
                    ctx.font = `${Math.floor(canvas.width / 60)}px sans-serif`;
                    ctx.fillStyle = '#666';
                    ctx.textAlign = 'right';
                    const now = new Date();
                    ctx.fillText(`${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`, canvas.width - 20, canvas.height - 15);
                    ctx.restore();
                }
                this._previewCanvas = canvas;
                frame.innerHTML = '';
                const img = document.createElement('img');
                img.src = canvas.toDataURL();
                img.style.maxWidth = '100%';
                img.style.borderRadius = '8px';
                frame.appendChild(img);
                // [FIX #6] No DOM restore needed - onclone handles cloned tree
            }).catch(err => {
                frame.innerHTML = '<p style="color:var(--danger);">预览生成失败</p>';
                console.error(err);
            });
        }, 100);
    },
    downloadPreview() {
        if (!this._previewCanvas) { Toast.warning('请先生成预览'); return; }
        const format = document.getElementById('previewFormat').value;
        const quality = parseFloat(document.getElementById('previewQuality').value);
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const ext = format === 'jpeg' ? 'jpg' : 'png';
        const dataUrl = this._previewCanvas.toDataURL(mimeType, quality);
        const link = document.createElement('a');
        link.download = `座位表_${this.getTimestamp()}.${ext}`;
        link.href = dataUrl;
        link.click();
        Toast.success(`截图已导出 (${format.toUpperCase()})`);
        addLog('📸', `导出截图 (${format.toUpperCase()})`);
        document.getElementById('previewModal').classList.remove('active');
    },

    // ==================== Print ====================
    printSeats() {
        document.getElementById('printDate').textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        // Calculate stats for print header
        const drawn = state.drawnStudents;
        const total = drawn.length;
        const male = drawn.filter(s => s.gender === state.settings.maleMapping).length;
        const female = drawn.filter(s => s.gender === state.settings.femaleMapping).length;
        const lunch = drawn.filter(s => s.lunch).length;
        document.getElementById('printStats').textContent = `总人数：${total}　男生：${male}　女生：${female}　午休：${lunch}`;
        window.print();
    },

    // [FEATURE] 家长会视图 - A4打印优化
    printParentView() {
        // Create a temporary print-optimized view
        const printWindow = window.open('', '_blank');
        if (!printWindow) { Toast.error('请允许弹出窗口以打印'); return; }

        const drawn = state.drawnStudents;
        const total = drawn.length;
        const male = drawn.filter(s => s.gender === state.settings.maleMapping).length;
        const female = drawn.filter(s => s.gender === state.settings.femaleMapping).length;

        let tableHtml = '<table style="width:100%;border-collapse:collapse;margin:20px 0;">';
        tableHtml += '<tr style="background:#f5f5f5;">';
        if (state.settings.exportIncludeSeatNumber) tableHtml += '<th style="border:1px solid #ddd;padding:8px;text-align:center;">座位号</th>';
        tableHtml += '<th style="border:1px solid #ddd;padding:8px;text-align:center;">姓名</th>';
        if (state.settings.exportIncludeGender) tableHtml += '<th style="border:1px solid #ddd;padding:8px;text-align:center;">性别</th>';
        tableHtml += '</tr>';

        const allSeats = [...state.drawOrder].sort((a, b) => a.number - b.number);
        allSeats.forEach(seat => {
            if (!seat.student) return;
            const s = seat.student;
            const genderBorder = s.gender === 'male' ? 'border-left:3px solid #007AFF;' : 'border-left:3px solid #FF2D55;';
            tableHtml += `<tr>`;
            if (state.settings.exportIncludeSeatNumber) tableHtml += `<td style="border:1px solid #ddd;padding:8px;text-align:center;${genderBorder}">${seat.number}</td>`;
            tableHtml += `<td style="border:1px solid #ddd;padding:8px;text-align:center;font-weight:600;${genderBorder}">${s.name}</td>`;
            if (state.settings.exportIncludeGender) tableHtml += `<td style="border:1px solid #ddd;padding:8px;text-align:center;">${s.gender === 'male' ? '♂' : '♀'}</td>`;
            tableHtml += '</tr>';
        });
        tableHtml += '</table>';

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>家长会座位表</title>
<style>
    @page { size: A4; margin: 15mm; }
    body { font-family: -apple-system, 'PingFang SC', sans-serif; padding: 20px; color: #333; }
    h1 { text-align: center; font-size: 22px; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #666; font-size: 13px; margin-bottom: 20px; }
    .stats { text-align: center; color: #888; font-size: 12px; margin-bottom: 16px; }
    @media print { body { padding: 0; } }
</style></head><body>
<h1>📋 教室座位表</h1>
<div class="subtitle">${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
<div class="stats">总人数：${total}　男生：${male}　女生：${female}</div>
${tableHtml}
<div style="text-align:center;color:#aaa;font-size:11px;margin-top:20px;">— 此表由教室座位智能编排系统生成 —</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

        printWindow.document.write(html);
        printWindow.document.close();
        Toast.success('家长会视图已生成，正在准备打印');
    },

    // ==================== Theme Switching ====================
    applyTheme(themeName) {
        document.body.classList.remove('theme-ocean', 'theme-forest', 'theme-sunset');
        if (themeName) document.body.classList.add(themeName);
        document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === themeName));
        state.settings.theme = themeName;
    },
    applyAccentColor(color) {
        document.documentElement.style.setProperty('--primary', color);
        document.querySelectorAll('.accent-dot').forEach(d => d.classList.toggle('active', d.dataset.color === color));
        state.settings.accentColor = color;
    },

    // ==================== Quick Info Bar ====================
    updateQuickInfo() {
        document.getElementById('qiLayout').textContent = `${state.rows}×${state.cols}`;
        document.getElementById('qiTotal').textContent = state.students.length;
        document.getElementById('qiDrawn').textContent = state.drawnStudents.length;
        document.getElementById('qiRemaining').textContent = state.remainingStudents.length;

        const totalMales = state.students.filter(s => s.gender === 'male').length;
        const totalFemales = state.students.filter(s => s.gender === 'female').length;
        const remMales = state.remainingStudents.filter(s => s.gender === 'male').length;
        const remFemales = state.remainingStudents.filter(s => s.gender === 'female').length;
        const lunchTotal = state.students.filter(s => s.lunch).length;

        document.getElementById('qiMaleRem').textContent = remMales;
        document.getElementById('qiMaleTotal').textContent = totalMales;
        document.getElementById('qiFemaleRem').textContent = remFemales;
        document.getElementById('qiFemaleTotal').textContent = totalFemales;
        document.getElementById('qiLunch').textContent = lunchTotal;

        // Apply visibility from settings
        this.applyQuickInfoVisibility();
    },

    applyQuickInfoVisibility() {
        const vis = state.settings.quickInfoItems || {};
        const defaults = { layout:true, total:true, drawn:true, remaining:true, male:true, female:true, lunch:true };
        document.querySelectorAll('#quickInfo .qi-item').forEach(el => {
            const key = el.dataset.qi;
            if (key && vis[key] === false) el.classList.add('hidden');
            else if (key) el.classList.remove('hidden');
        });
    },

    // ==================== Subject Management ====================
    renderSubjectTabs() {
        const container = document.getElementById('subjectTabs');
        container.innerHTML = state.subjects.map(s =>
            `<span class="subject-tab" data-subject="${s}">${s} <span style="cursor:pointer;opacity:0.5;" data-remove="${s}">×</span></span>`
        ).join('');
        container.querySelectorAll('.subject-tab').forEach(tab => {
            tab.querySelector('[data-remove]')?.addEventListener('click', e => {
                e.stopPropagation();
                const subj = e.target.dataset.remove;
                state.subjects = state.subjects.filter(s => s !== subj);
                this.renderSubjectTabs();
                this.updateHeatmapSubjectSelect();
            });
        });
    },
    updateHeatmapSubjectSelect() {
        const sel = document.getElementById('heatmapSubjectSelect');
        sel.innerHTML = state.subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    },
    updateHeatmapSubjectVisibility() {
        document.getElementById('heatmapSubjectWrap').style.display = state.heatmapType === 'subject' ? 'inline' : 'none';
    },

    // ==================== Seat Animation ====================
    animateSeatsIn() {
        const seats = document.querySelectorAll('.seat');
        seats.forEach((seat, i) => {
            seat.classList.add('animate-in');
            seat.style.animationDelay = `${Math.min(i * 15, 600)}ms`;
            setTimeout(() => { seat.classList.remove('animate-in'); seat.style.animationDelay = ''; }, 800 + Math.min(i * 15, 600));
        });
    },

    // ==================== Arrow Key Navigation ====================
    _navSeat: null,
    navigateSeats(direction) {
        if (state.seats.length === 0) return;
        if (!this._navSeat) {
            this._navSeat = state.seats[0];
        } else {
            const cur = this._navSeat;
            const row = cur.row, col = cur.col;
            let target = null;
            switch (direction) {
                case 'ArrowUp':
                    for (let r = row - 1; r >= 0; r--) { const s = state.seats[r * state.cols + col]; if (s && !s.disabled) { target = s; break; } }
                    break;
                case 'ArrowDown':
                    for (let r = row + 1; r < state.rows; r++) { const s = state.seats[r * state.cols + col]; if (s && !s.disabled) { target = s; break; } }
                    break;
                case 'ArrowLeft':
                    for (let c = col - 1; c >= 0; c--) { const s = state.seats[row * state.cols + c]; if (s && !s.disabled) { target = s; break; } }
                    break;
                case 'ArrowRight':
                    for (let c = col + 1; c < state.cols; c++) { const s = state.seats[row * state.cols + c]; if (s && !s.disabled) { target = s; break; } }
                    break;
            }
            if (target) this._navSeat = target;
        }
        if (this._navSeat) {
            this.clearSelection();
            state.selectedSeat = this._navSeat;
            this._navSeat.element.classList.add('selected');
            this._navSeat.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    // ==================== Student Pool ====================
    renderPool() {
        const list = document.getElementById('poolList');
        let students = [...state.remainingStudents];
        // Filter
        if (state.poolFilter === 'male') students = students.filter(s => s.gender === 'male');
        else if (state.poolFilter === 'female') students = students.filter(s => s.gender === 'female');
        else if (state.poolFilter === 'lunch') students = students.filter(s => s.lunch);
        else if (state.poolFilter === 'no-lunch') students = students.filter(s => !s.lunch);
        // [FIX #4] Search using unified matchStudent
        if (state.poolSearch) {
            students = students.filter(s => matchStudent(s, state.poolSearch.toLowerCase()));
        }
        if (students.length === 0) { list.innerHTML = '<div class="pool-empty">无匹配学生</div>'; return; }
        // [FEATURE #23] Virtual scrolling / pagination for large pools
        const POOL_PAGE = 80;
        const displayStudents = students.slice(0, POOL_PAGE);
        list.innerHTML = displayStudents.map(s => {
            const meta = [];
            meta.push(s.gender === 'male' ? '♂' : '♀');
            if (s.lunch) meta.push('💤');
            if (s.score !== null && s.score !== undefined) meta.push(`📊${s.score}`);
            return `<div class="pool-item" draggable="true" data-student-id="${s.id}">
                <span class="pool-item-name">${escapeHtml(s.name)}</span>
                <span class="pool-item-meta">${meta.join(' ')}</span>
            </div>`;
        }).join('');
        // [FEATURE #23] Load more button for large pools
        if (students.length > POOL_PAGE) {
            list.innerHTML += `<div class="pool-empty" style="cursor:pointer;" id="poolLoadMore">显示 ${POOL_PAGE}/${students.length} — 点击加载更多</div>`;
        }
        // Drag from pool + Click-to-place
        list.querySelectorAll('.pool-item').forEach(item => {
            item.addEventListener('dragstart', e => {
                const id = parseInt(item.dataset.studentId);
                e.dataTransfer.setData('text/pool-student', JSON.stringify({ id }));
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('click', e => {
                e.stopPropagation();
                const id = parseInt(item.dataset.studentId);
                if (state.selectedPoolStudent === id) {
                    // Deselect
                    state.selectedPoolStudent = null;
                    item.classList.remove('pool-selected');
                    document.getElementById('poolClickHint')?.classList.remove('visible');
                    document.querySelectorAll('.seat').forEach(s => s.classList.remove('pool-target'));
                } else {
                    // Select this student
                    state.selectedPoolStudent = id;
                    list.querySelectorAll('.pool-item').forEach(pi => pi.classList.remove('pool-selected'));
                    item.classList.add('pool-selected');
                    document.getElementById('poolClickHint')?.classList.add('visible');
                    document.querySelectorAll('.seat:not(.disabled)').forEach(s => {
                        if (!state.seats.find(ss => ss.element === s)?.student) s.classList.add('pool-target');
                    });
                    Toast.info('请点击空座位落座，或按 ESC 取消');
                }
            });
        });
        // [FIX #5] Load more click handler
        const loadMoreBtn = document.getElementById('poolLoadMore');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                const remainingHtml = students.slice(POOL_PAGE).map(s => {
                    const meta = [s.gender === 'male' ? '♂' : '♀'];
                    if (s.lunch) meta.push('💤');
                    if (s.score !== null && s.score !== undefined) meta.push(`📊${s.score}`);
                    return `<div class="pool-item" draggable="true" data-student-id="${s.id}">
                        <span class="pool-item-name">${escapeHtml(s.name)}</span>
                        <span class="pool-item-meta">${meta.join(' ')}</span>
                    </div>`;
                }).join('');
                loadMoreBtn.insertAdjacentHTML('beforebegin', remainingHtml);
                loadMoreBtn.remove();
                list.querySelectorAll('.pool-item').forEach(item => {
                    if (item._bound) return;
                    item._bound = true;
                    item.addEventListener('dragstart', e => {
                        const id = parseInt(item.dataset.studentId);
                        e.dataTransfer.setData('text/pool-student', JSON.stringify({ id }));
                        e.dataTransfer.effectAllowed = 'move';
                    });
                    item.addEventListener('click', e => {
                        e.stopPropagation();
                        const id = parseInt(item.dataset.studentId);
                        if (state.selectedPoolStudent === id) {
                            state.selectedPoolStudent = null;
                            item.classList.remove('pool-selected');
                            document.getElementById('poolClickHint')?.classList.remove('visible');
                            document.querySelectorAll('.seat').forEach(s => s.classList.remove('pool-target'));
                        } else {
                            state.selectedPoolStudent = id;
                            list.querySelectorAll('.pool-item').forEach(pi => pi.classList.remove('pool-selected'));
                            item.classList.add('pool-selected');
                            document.getElementById('poolClickHint')?.classList.add('visible');
                            document.querySelectorAll('.seat:not(.disabled)').forEach(s => {
                                if (!state.seats.find(ss => ss.element === s)?.student) s.classList.add('pool-target');
                            });
                            Toast.info('请点击空座位落座，或按 ESC 取消');
                        }
                    });
                });
            });
        }
    },
    showStats() {
        const content = document.getElementById('statsContent');
        const drawn = state.drawnStudents;
        const total = state.students.length;
        if (total === 0) { content.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:20px;">暂无数据</p>'; document.getElementById('statsModal').classList.add('active'); return; }

        const males = drawn.filter(s => s.gender === 'male').length;
        const females = drawn.filter(s => s.gender === 'female').length;
        const lunchCount = drawn.filter(s => s.lunch).length;
        const scores = drawn.filter(s => s.score !== null && s.score !== undefined).map(s => s.score);
        const avgScore = scores.length > 0 ? (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1) : 'N/A';
        const maxScore = scores.length > 0 ? Math.max(...scores) : 'N/A';
        const minScore = scores.length > 0 ? Math.min(...scores) : 'N/A';

        // Score distribution
        const ranges = [[90,100,'优秀'],[80,89,'良好'],[70,79,'中等'],[60,69,'及格'],[0,59,'不及格']];
        const dist = ranges.map(([lo,label]) => ({ label, count: scores.filter(s => s >= lo && s <= (lo === 0 ? 59 : lo + (lo === 90 ? 10 : 9) )).length }));
        // Fix ranges properly
        const distFixed = [
            { label: '优秀 (90-100)', count: scores.filter(s => s >= 90).length },
            { label: '良好 (80-89)', count: scores.filter(s => s >= 80 && s < 90).length },
            { label: '中等 (70-79)', count: scores.filter(s => s >= 70 && s < 80).length },
            { label: '及格 (60-69)', count: scores.filter(s => s >= 60 && s < 70).length },
            { label: '不及格 (<60)', count: scores.filter(s => s < 60).length },
        ];
        const maxDist = Math.max(...distFixed.map(d => d.count), 1);

        // Front vs back row scores
        const frontScores = [], backScores = [];
        state.seats.forEach(s => {
            if (s.student && s.student.score !== null && s.student.score !== undefined) {
                if (s.row < Math.floor(state.rows / 2)) frontScores.push(s.student.score);
                else backScores.push(s.student.score);
            }
        });
        const frontAvg = frontScores.length > 0 ? (frontScores.reduce((a,b)=>a+b,0)/frontScores.length).toFixed(1) : 'N/A';
        const backAvg = backScores.length > 0 ? (backScores.reduce((a,b)=>a+b,0)/backScores.length).toFixed(1) : 'N/A';

        content.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${drawn.length}</div><div class="stat-label">已抽取</div></div>
                <div class="stat-card"><div class="stat-value">${total - drawn.length}</div><div class="stat-label">剩余</div></div>
                <div class="stat-card"><div class="stat-value">${males}:${females}</div><div class="stat-label">男女比</div></div>
                <div class="stat-card"><div class="stat-value">${lunchCount}</div><div class="stat-label">午休人数</div></div>
                <div class="stat-card"><div class="stat-value">${avgScore}</div><div class="stat-label">平均分</div></div>
                <div class="stat-card"><div class="stat-value">${scores.length > 0 ? maxScore + '/' + minScore : 'N/A'}</div><div class="stat-label">最高/最低</div></div>
            </div>
            ${scores.length > 0 ? `
            <div class="stats-chart">
                <div class="stats-chart-title">📊 成绩分布</div>
                ${distFixed.map(d => `
                    <div class="stats-bar">
                        <span class="stats-bar-label">${d.label}</span>
                        <div class="stats-bar-track">
                            <div class="stats-bar-fill" style="width:${(d.count/maxDist*100)}%;background:${d.count > 0 ? 'var(--primary)' : 'var(--bg-tertiary)'};">
                                ${d.count > 0 ? d.count : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="stats-chart">
                <div class="stats-chart-title">📍 前后排成绩对比</div>
                <div class="stats-bar">
                    <span class="stats-bar-label">前排均分</span>
                    <div class="stats-bar-track">
                        <div class="stats-bar-fill" style="width:${frontAvg !== 'N/A' ? frontAvg : 0}%;background:var(--success);">${frontAvg}</div>
                    </div>
                </div>
                <div class="stats-bar">
                    <span class="stats-bar-label">后排均分</span>
                    <div class="stats-bar-track">
                        <div class="stats-bar-fill" style="width:${backAvg !== 'N/A' ? backAvg : 0}%;background:var(--warning);">${backAvg}</div>
                    </div>
                </div>
            </div>` : '<p style="color:var(--text-tertiary);text-align:center;">未导入成绩数据，跳过成绩统计</p>'}
        `;
        document.getElementById('statsModal').classList.add('active');
    },

    // ==================== Smart Seat Recommendation (Multi-dimensional) ====================
    _recommendations: [],
    _customAlgorithms: {},
    _customAlgorithm: null,
    generateRecommendations() {
        this._recommendations = [];
        const allSeats = [...state.seats, state.platformLeft, state.platformRight].filter(s => s.student);
        if (allSeats.length < 2) { Toast.warning('需要至少2名已安排的学生'); return; }

        // Calculate current total peer influence score
        const currentScore = this.calcTotalInfluence(allSeats);

        // Try swapping each pair and find the best improvement
        // [FEATURE #23] Limit pairs to evaluate for performance (max 1000)
        const candidates = [];
        const maxPairs = 1000;
        let pairCount = 0;
        outer:
        for (let i = 0; i < allSeats.length; i++) {
            for (let j = i + 1; j < allSeats.length; j++) {
                if (++pairCount > maxPairs) break outer;
                const s1 = allSeats[i], s2 = allSeats[j];
                // Skip if either is pinned
                if (s1.student.pinned || s2.student.pinned) continue;

                // Simulate swap
                const temp = s1.student; s1.student = s2.student; s2.student = temp;
                const newScore = this.calcTotalInfluence(allSeats);
                const improvement = newScore - currentScore;
                // Undo swap
                s2.student = s1.student; s1.student = temp;

                if (improvement > 0) {
                    const reasons = [];
                    // Generate reasons using explainPairing without redundant simulation
                    const orig1 = s1.student, orig2 = s2.student;
                    const neighbors1 = this.getNeighbors(s1).filter(n => n.student && n.student.id !== orig1.id && n.student.id !== orig2.id);
                    const neighbors2 = this.getNeighbors(s2).filter(n => n.student && n.student.id !== orig1.id && n.student.id !== orig2.id);
                    // After swap: s1 gets orig2, s2 gets orig1
                    neighbors1.forEach(n => {
                        const r = CompositeEval.explainPairing(orig2, n.student, 'adjacent');
                        if (r && !reasons.includes(r)) reasons.push(r);
                    });
                    neighbors2.forEach(n => {
                        const r = CompositeEval.explainPairing(orig1, n.student, 'adjacent');
                        if (r && !reasons.includes(r)) reasons.push(r);
                    });
                    // Also explain the swapped pair's direct interaction
                    const directReason = CompositeEval.explainPairing(orig1, orig2, 'swap');
                    if (directReason && !reasons.includes(directReason)) reasons.push(directReason);

                    let priority = 'low';
                    if (improvement > 30) priority = 'high';
                    else if (improvement > 15) priority = 'medium';

                    candidates.push({
                        seat1: s1, seat2: s2,
                        student1: orig1, student2: orig2,
                        priority, improvement,
                        reason: reasons.length > 0 ? reasons.join('\n') : `良性影响分提升 ${improvement} 分`,
                        applied: false
                    });
                }
            }
        }

        // Sort by improvement, take top 5
        candidates.sort((a, b) => b.improvement - a.improvement);
        this._recommendations = candidates.slice(0, 5);

        // [FEATURE] 学霸帮扶链自动推荐
        this._tutoringChains = this.buildTutoringChain();
    },

    /**
     * [FEATURE] 学霸帮扶链 - 识别成绩前20%和后20%的学生，推荐同列相邻配对
     */
    buildTutoringChain() {
        const chains = [];
        const allSeated = [...state.seats, state.platformLeft, state.platformRight].filter(s => s.student);
        if (allSeated.length < 5) return chains;

        // Get students with scores
        const scored = allSeated
            .filter(s => s.student.score !== null && s.student.score !== undefined)
            .map(s => ({ seat: s, student: s.student, avg: CompositeEval.getAvgScore(s.student) || s.student.score }))
            .filter(s => s.avg !== null);

        if (scored.length < 5) return chains;

        // Sort by score
        scored.sort((a, b) => b.avg - a.avg);
        const topCount = Math.max(1, Math.floor(scored.length * 0.2));
        const bottomCount = Math.max(1, Math.floor(scored.length * 0.2));

        const topStudents = scored.slice(0, topCount);
        const bottomStudents = scored.slice(-bottomCount);

        // Find same-column adjacent pairs
        topStudents.forEach(top => {
            bottomStudents.forEach(bottom => {
                if (top.seat.type !== 'normal' || bottom.seat.type !== 'normal') return;
                // Check same column and adjacent rows
                if (top.seat.col === bottom.seat.col && Math.abs(top.seat.row - bottom.seat.row) === 1) {
                    const scoreDiff = Math.abs(top.avg - bottom.avg);
                    chains.push({
                        tutor: top.student,
                        tutee: bottom.student,
                        tutorSeat: top.seat,
                        tuteeSeat: bottom.seat,
                        scoreDiff: scoreDiff,
                        reason: `${top.student.name}(${top.avg}分) 与 ${bottom.student.name}(${bottom.avg}分) 同列相邻，可帮扶提升`,
                        type: 'tutoring'
                    });
                }
            });
        });

        // If no same-column pairs found, suggest swaps to create them
        if (chains.length === 0 && topStudents.length > 0 && bottomStudents.length > 0) {
            // Find closest pair by column distance
            let bestPair = null;
            let bestDist = Infinity;
            topStudents.forEach(top => {
                bottomStudents.forEach(bottom => {
                    if (top.seat.type !== 'normal' || bottom.seat.type !== 'normal') return;
                    const colDist = Math.abs(top.seat.col - bottom.seat.col);
                    const rowDist = Math.abs(top.seat.row - bottom.seat.row);
                    const dist = colDist + rowDist;
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestPair = { top, bottom };
                    }
                });
            });

            if (bestPair && bestDist > 1) {
                const scoreDiff = Math.abs(bestPair.top.avg - bestPair.bottom.avg);
                chains.push({
                    tutor: bestPair.top.student,
                    tutee: bestPair.bottom.student,
                    tutorSeat: bestPair.top.seat,
                    tuteeSeat: bestPair.bottom.seat,
                    scoreDiff: scoreDiff,
                    reason: `建议将 ${bestPair.top.student.name}(${bestPair.top.avg}分) 移至 ${bestPair.bottom.student.name}(${bestPair.bottom.avg}分) 附近进行帮扶`,
                    type: 'tutoring-suggest'
                });
            }
        }

        return chains.slice(0, 3); // Max 3 tutoring chains
    },

    /**
     * Calculate total peer influence across all adjacent seat pairs
     */
    calcTotalInfluence(seats) {
        // Use custom algorithm if available, otherwise use enhanced built-in
        if (this._customAlgorithm && typeof this._customAlgorithm.peerInfluence === 'function') {
            return this._calcWithCustomAlgo(seats);
        }
        let total = 0;
        const checked = new Set();
        seats.forEach(s => {
            if (!s.student) return;
            this.getNeighbors(s).forEach(n => {
                if (!n.student) return;
                const key = [Math.min(s.student.id, n.student.id), Math.max(s.student.id, n.student.id)].join('-');
                if (checked.has(key)) return;
                checked.add(key);
                total += this.enhancedPeerInfluence(s.student, n.student, s, n);
            });
        });
        // Add row-level balance bonus
        total += this.calcRowBalance(seats);
        // Add lunch clustering penalty
        total += this.calcLunchPenalty(seats);
        return total;
    },

    _calcWithCustomAlgo(seats) {
        let total = 0;
        const checked = new Set();
        const context = { seats, settings: state.settings, rows: state.rows, cols: state.cols, blacklist: state.blacklist, whitelist: state.whitelist };
        seats.forEach(s => {
            if (!s.student) return;
            this.getNeighbors(s).forEach(n => {
                if (!n.student) return;
                const key = [Math.min(s.student.id, n.student.id), Math.max(s.student.id, n.student.id)].join('-');
                if (checked.has(key)) return;
                checked.add(key);
                total += this._customAlgorithm.peerInfluence(s.student, n.student, context);
            });
        });
        return total;
    },

    enhancedPeerInfluence(s1, s2, seat1, seat2) {
        let score = CompositeEval.peerInfluence(s1, s2);

        // Bonus: row-level academic balance
        const avg1 = CompositeEval.getAvgScore(s1), avg2 = CompositeEval.getAvgScore(s2);
        if (avg1 !== null && avg2 !== null) {
            const diff = Math.abs(avg1 - avg2);
            if (diff >= 20 && diff <= 35) score += 5; // Good academic spread
        }

        // Penalty: too many lunch students adjacent
        if (s1.lunch && s2.lunch) {
            const n1 = this.getNeighbors(seat1).filter(n => n.student?.lunch).length;
            const n2 = this.getNeighbors(seat2).filter(n => n.student?.lunch).length;
            if (n1 >= 3 || n2 >= 3) score -= 10; // Too clustered
        }

        // Bonus: position diversity in same row
        if (seat1.row === seat2.row && s1.position && s2.position && s1.position !== s2.position) {
            score += 5;
        }

        return score;
    },

    calcRowBalance(seats) {
        let bonus = 0;
        for (let r = 0; r < state.rows; r++) {
            const rowStudents = [];
            for (let c = 0; c < state.cols; c++) {
                const s = state.seats[r * state.cols + c];
                if (s?.student) {
                    const avg = CompositeEval.getAvgScore(s.student);
                    if (avg !== null) rowStudents.push(avg);
                }
            }
            if (rowStudents.length >= 2) {
                const mean = rowStudents.reduce((a, b) => a + b, 0) / rowStudents.length;
                const variance = rowStudents.reduce((a, b) => a + (b - mean) ** 2, 0) / rowStudents.length;
                if (variance > 200) bonus += 10; // Good spread of high/low in row
            }
        }
        return bonus;
    },

    calcLunchPenalty(seats) {
        let penalty = 0;
        seats.forEach(s => {
            if (!s.student?.lunch) return;
            const lunchNeighbors = this.getNeighbors(s).filter(n => n.student?.lunch).length;
            if (lunchNeighbors >= 4) penalty -= 15; // Heavy lunch clustering
            else if (lunchNeighbors >= 3) penalty -= 8;
        });
        return penalty;
    },

    /**
     * Get neighboring seats (up, down, left, right, diagonal)
     */
    getNeighbors(seat) {
        if (seat.type !== 'normal') return [];
        const neighbors = [];
        const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
        dirs.forEach(([dr, dc]) => {
            const r = seat.row + dr, c = seat.col + dc;
            if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
                neighbors.push(state.seats[r * state.cols + c]);
            }
        });
        return neighbors;
    },

    showRecommendations() {
        const panel = document.getElementById('recommendPanel');
        const content = document.getElementById('recommendContent');
        // Show panel immediately with loading state
        content.innerHTML = '<div class="recommend-empty">🔄 正在分析座位安排...</div>';
        panel.classList.add('visible');
        Toast.info('正在分析座位安排...');
        // Use setTimeout to allow UI to update before heavy computation
        setTimeout(() => {
            try {
                this.generateRecommendations();
            } catch (e) {
                console.error('智能推荐生成失败:', e);
                Toast.error('智能推荐生成失败：' + (e.message || '未知错误'));
                content.innerHTML = '<div class="recommend-empty">❌ 分析失败，请查看控制台</div>';
                return;
            }
            const hasSwapRecs = this._recommendations.length > 0;
            const hasTutoring = (this._tutoringChains || []).length > 0;
            if (!hasSwapRecs && !hasTutoring) {
                content.innerHTML = '<div class="recommend-empty">🎉 当前座位安排已较合理，暂无推荐调整</div>';
                Toast.info('当前座位安排已较合理');
                return;
            }
            this.renderRecommendations();
            const total = this._recommendations.length + (this._tutoringChains || []).length;
            Toast.success(`找到 ${total} 条优化建议`);
        }, 50);
    },

    renderRecommendations() {
        const content = document.getElementById('recommendContent');
        const priorityLabels = { high: '强烈建议', medium: '建议调整', low: '可选优化' };
        const hasSwapRecs = this._recommendations.length > 0;
        const hasTutoring = (this._tutoringChains || []).length > 0;

        if (!hasSwapRecs && !hasTutoring) {
            content.innerHTML = '<div class="recommend-empty">🎉 当前座位安排已较合理，暂无推荐调整</div>';
            return;
        }

        let html = '';

        // Regular swap recommendations
        if (hasSwapRecs) {
            html += this._recommendations.map((rec, i) => `
            <div class="recommend-card" data-idx="${i}" data-seat1-row="${rec.seat1.row}" data-seat1-col="${rec.seat1.col}" data-seat2-row="${rec.seat2.row}" data-seat2-col="${rec.seat2.col}" style="${rec.applied ? 'opacity:0.5;' : ''}">
                <div class="recommend-card-header">
                    <span class="recommend-card-title">推荐 #${i + 1}</span>
                    <span class="recommend-card-badge ${rec.priority}">${priorityLabels[rec.priority]} · 良性影响+${rec.improvement}</span>
                </div>
                <div class="recommend-reason">${rec.reason.replace(/\n/g, '<br>')}</div>
                <div class="recommend-swap">
                    <span class="seat-chip">${escapeHtml(rec.student1.name)} → ${this.seatLabel(rec.seat1)}</span>
                    <span class="arrow">⇄</span>
                    <span class="seat-chip">${escapeHtml(rec.student2.name)} → ${this.seatLabel(rec.seat2)}</span>
                </div>
                <div class="recommend-actions">
                    ${rec.applied ? '<span style="color:var(--success);font-size:12px;">✓ 已采纳</span>' : `
                    <button class="btn btn-ghost btn-sm" data-action="skip" data-idx="${i}">跳过</button>
                    <button class="btn btn-primary btn-sm" data-action="accept" data-idx="${i}">采纳</button>
                    `}
                </div>
            </div>
        `).join('');
        }

        // [FEATURE] 学霸帮扶链推荐
        if (hasTutoring) {
            html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--glass-border);"><div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">📚 学霸帮扶链</div></div>';
            html += this._tutoringChains.map((chain, i) => `
            <div class="recommend-card" style="border-left:3px solid var(--info);">
                <div class="recommend-card-header">
                    <span class="recommend-card-title">帮扶 #${i + 1}</span>
                    <span class="recommend-card-badge medium">成绩差 ${chain.scoreDiff} 分</span>
                </div>
                <div class="recommend-reason">${chain.reason}</div>
                <div class="recommend-swap">
                    <span class="seat-chip" style="background:rgba(175,82,222,0.1);">🎓 ${chain.tutor.name}(${CompositeEval.getAvgScore(chain.tutor) || chain.tutor.score}分)</span>
                    <span class="arrow">→</span>
                    <span class="seat-chip" style="background:rgba(255,149,0,0.1);">📖 ${chain.tutee.name}(${CompositeEval.getAvgScore(chain.tutee) || chain.tutee.score}分)</span>
                </div>
            </div>
        `).join('');
        }

        content.innerHTML = html;
        // Hover to highlight seats
        content.querySelectorAll('.recommend-card:not([style*="opacity"])').forEach(card => {
            card.addEventListener('mouseenter', () => {
                const idx = parseInt(card.dataset.idx);
                const rec = this._recommendations[idx];
                if (!rec || rec.applied) return;
                this.clearRecommendHighlights();
                this.highlightSeat(rec.seat1);
                this.highlightSeat(rec.seat2);
                card.classList.add('hovering');
            });
            card.addEventListener('mouseleave', () => {
                this.clearRecommendHighlights();
                card.classList.remove('hovering');
            });
        });
        content.querySelectorAll('[data-action="accept"]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.acceptRecommendation(parseInt(btn.dataset.idx)); });
        });
        content.querySelectorAll('[data-action="skip"]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.skipRecommendation(parseInt(btn.dataset.idx)); });
        });
    },

    highlightSeat(seat) {
        const el = seat.type === 'normal' ? seat.element : document.getElementById(seat.type === 'platform-left' ? 'platformLeft' : 'platformRight');
        if (el) el.classList.add('recommend-highlight');
    },
    clearRecommendHighlights() {
        document.querySelectorAll('.recommend-highlight').forEach(el => el.classList.remove('recommend-highlight'));
    },

    acceptRecommendation(idx) {
        const rec = this._recommendations[idx];
        if (!rec || rec.applied) return;
        this.clearRecommendHighlights();
        this.doSwap(rec.seat1, rec.seat2);
        rec.applied = true;
        Toast.success(`已采纳：${rec.student1.name} ↔ ${rec.student2.name}`);
        addLog('🧠', `智能推荐：${rec.student1.name} ↔ ${rec.student2.name}`);
        this.renderRecommendations();
    },

    skipRecommendation(idx) {
        const rec = this._recommendations[idx];
        if (!rec) return;
        rec.applied = true; // Mark as handled (skipped)
        this.renderRecommendations();
    },

    applyAllRecommendations() {
        let applied = 0;
        this._recommendations.forEach((rec, i) => {
            if (!rec.applied) {
                this.doSwap(rec.seat1, rec.seat2);
                rec.applied = true;
                applied++;
                addLog('🧠', `智能推荐：${rec.student1.name} ↔ ${rec.student2.name}`);
            }
        });
        this.renderRecommendations();
        if (applied > 0) Toast.success(`已采纳 ${applied} 条推荐`);
        else Toast.info('所有推荐已处理');
    },

    // ==================== Custom Algorithm Management ====================
    renderCustomAlgoList() {
        const container = document.getElementById('customAlgoList');
        const display = document.getElementById('currentAlgoDisplay');
        if (!container) return;
        const algos = this._customAlgorithms || {};
        const algoNames = Object.keys(algos);
        if (algoNames.length === 0) {
            container.innerHTML = '<span style="color:var(--text-tertiary);">暂无自定义算法</span>';
            if (display) display.textContent = '内置算法 (CompositeEval)';
            return;
        }
        container.innerHTML = algoNames.map(name => {
            const algo = algos[name];
            const isActive = this._customAlgorithm?.name === name;
            return `<div class="algo-import-card ${isActive ? 'algo-import-active' : ''}" data-algo-name="${name}">
                <div><div class="algo-import-name">${escapeHtml(algo.name)} <span style="font-size:10px;color:var(--text-tertiary);">v${escapeHtml(algo.version || '1.0')}</span></div><div class="algo-import-desc">${escapeHtml(algo.description || '')}</div></div>
                <div style="display:flex;gap:4px;align-items:center;">
                    ${isActive ? '<span class="detail-badge positive">使用中</span>' : `<button class="btn btn-ghost btn-sm" data-activate-algo="${name}">激活</button>`}
                    <button class="btn btn-danger btn-icon btn-sm" data-remove-algo="${name}" style="width:24px;height:24px;min-width:24px;font-size:10px;">✕</button>
                </div>
            </div>`;
        }).join('');
        container.querySelectorAll('[data-activate-algo]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._customAlgorithm = algos[btn.dataset.activateAlgo];
                Toast.success(`已切换到算法: ${btn.dataset.activateAlgo}`);
                this.renderCustomAlgoList();
            });
        });
        container.querySelectorAll('[data-remove-algo]').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.removeAlgo;
                delete algos[name];
                if (this._customAlgorithm?.name === name) this._customAlgorithm = null;
                this.renderCustomAlgoList();
                Toast.success(`已移除算法: ${name}`);
            });
        });
        if (display) display.textContent = this._customAlgorithm ? `自定义: ${this._customAlgorithm.name}` : '内置算法 (CompositeEval)';
    },

    _downloadAlgoTemplate() {
        const tpl = `// 座位编排系统 - 自定义推荐算法模板
// 导入方式：智能推荐面板 → 🧬 自定义算法 → 导入算法文件

const CustomAlgorithm = {
    name: "我的自定义算法",
    version: "1.0.0",
    description: "自定义座位推荐算法",

    /**
     * 计算两名学生的良性影响分 (核心方法)
     * @param {Object} s1 - 学生对象 { name, gender, lunch, scores, personality, hobbies, position }
     * @param {Object} s2 - 学生对象
     * @param {Object} context - { seats, settings, rows, cols }
     * @returns {number} 分数越高表示越应该坐在一起
     */
    peerInfluence(s1, s2, context) {
        let score = 0;

        // 示例：学业互补
        const avg1 = Object.values(s1.scores || {}).reduce((a,b) => a+b, 0) / Math.max(1, Object.keys(s1.scores || {}).length);
        const avg2 = Object.values(s2.scores || {}).reduce((a,b) => a+b, 0) / Math.max(1, Object.keys(s2.scores || {}).length);
        const diff = Math.abs(avg1 - avg2);
        if (diff > 15 && diff < 40) score += 20;
        else if (diff <= 15) score += 10;

        // 示例：性格互补
        if (s1.personality === '外向' && s2.personality === '内向') score += 15;
        else if (s1.personality === '内向' && s2.personality === '外向') score += 15;

        // 在此添加你的自定义逻辑...
        return score;
    },

    /**
     * 生成互换推荐 (可选，不实现则使用内置逻辑)
     * @param {Array} seatedStudents - [{student, seat}]
     * @param {Object} context
     * @returns {Array} [{seat1, seat2, reason, priority}]
     */
    generateRecommendations(seatedStudents, context) {
        return [];
    },

    /**
     * 计算学生综合评分 (可选，用于热力图)
     * @param {Object} student
     * @returns {number} 0-100
     */
    getScore(student) {
        return 50;
    }
};

AlgorithmRegistry.register(CustomAlgorithm);
`;
        const blob = new Blob([tpl], { type: 'text/javascript;charset=utf-8' });
        const link = document.createElement('a');
        link.download = '自定义推荐算法模板.js';
        link.href = URL.createObjectURL(blob); link.click();
        Toast.success('算法模板已下载');
    },

    // ==================== [FEATURE] Monte Carlo Simulation v2 ====================
    // --- Simulation Worker (inline Blob URL) ---
    _createSimWorker() {
        const workerCode = `
            'use strict';
            let _state = null;
            let _cancelled = false;

            self.onmessage = function(e) {
                const msg = e.data;
                if (msg.type === 'init') {
                    _state = msg.state;
                    _cancelled = false;
                } else if (msg.type === 'cancel') {
                    _cancelled = true;
                } else if (msg.type === 'run') {
                    _cancelled = false;
                    runBatch(msg.startIdx, msg.count, msg.seed);
                }
            };

            // Seeded PRNG (xoshiro128**)
            function makeRNG(seed) {
                let s = [seed, seed ^ 0x5DEECE66D, seed ^ 0xBB20B4600, seed ^ 0xD4B6D800];
                if (s[0] === 0) s[0] = 1;
                return function() {
                    const result = (s[1] * 5) | 0;
                    const t = s[1] << 9;
                    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
                    s[2] ^= t;
                    s[3] = (s[3] << 11) | (s[3] >>> 21);
                    return (result >>> 0) / 4294967296;
                };
            }

            function runBatch(startIdx, count, seed) {
                const st = _state;
                if (!st || !st.students || !st.seats) {
                    self.postMessage({ type: 'error', message: 'Invalid state' });
                    return;
                }
                const students = st.students;
                const seats = st.seats;
                const rows = st.rows, cols = st.cols;
                const platformLeft = st.platformLeft;
                const platformRight = st.platformRight;
                const drawOrder = st.drawOrder;
                const blacklist = st.blacklist || [];
                const whitelist = st.whitelist || [];
                const settings = st.settings || {};
                const includePlatform = st.includePlatform !== false;
                const rng = makeRNG(seed + startIdx);

                const seatFreq = {};
                seats.forEach((s, i) => { seatFreq[i] = {}; });
                if (includePlatform) {
                    seatFreq['pl'] = {};
                    seatFreq['pr'] = {};
                }
                const pairFreq = {};

                for (let sim = 0; sim < count; sim++) {
                    if (_cancelled) {
                        self.postMessage({ type: 'cancelled', processed: sim });
                        return;
                    }
                    // Reset for this sim
                    const remaining = students.map(s => ({ ...s }));
                    const drawn = [];
                    const simSeats = seats.map(s => ({ ...s, student: null }));
                    let pL = { ...platformLeft, student: null };
                    let pR = { ...platformRight, student: null };
                    let drawIdx = 0;

                    // Build draw order
                    const simDrawOrder = [];
                    if (includePlatform && !pR.disabled) simDrawOrder.push({ seat: pR, type: 'pr' });
                    if (includePlatform && !pL.disabled) simDrawOrder.push({ seat: pL, type: 'pl' });
                    simSeats.forEach((s, i) => { if (!s.disabled) simDrawOrder.push({ seat: s, type: 'normal', idx: i }); });

                    while (remaining.length > 0 && drawIdx < simDrawOrder.length) {
                        const entry = simDrawOrder[drawIdx];
                        const target = entry.seat;

                        // Calculate probabilities
                        const probs = {};
                        remaining.forEach(s => { probs[s.id] = 1; });

                        // Apply blacklist
                        if (settings.antiCluster) {
                            const drawnSeats = [];
                            simSeats.forEach((s, i) => { if (s.student) drawnSeats.push({ student: s.student, row: s.row, col: s.col, idx: i }); });
                            if (pL.student) drawnSeats.push({ student: pL.student, row: pL.row, col: pL.col, idx: 'pl' });
                            if (pR.student) drawnSeats.push({ student: pR.student, row: pR.row, col: pR.col, idx: 'pr' });

                            blacklist.forEach(group => {
                                const cleanGroup = group.map(g => g.replace(/^\\*/, '').replace(/^[（(]/, '').replace(/[）)]$/, ''));
                                const drawnInGroup = cleanGroup.filter(name => drawnSeats.some(s => s.student.name === name));
                                if (drawnInGroup.length === 0) return;
                                const anchor = drawnInGroup[0];
                                const anchorSeat = drawnSeats.find(s => s.student.name === anchor);
                                if (!anchorSeat) return;
                                remaining.forEach(student => {
                                    if (!cleanGroup.includes(student.name)) return;
                                    const dist = Math.abs(anchorSeat.row - target.row) + Math.abs(anchorSeat.col - target.col);
                                    if (dist <= (settings.blacklistRadius || 2)) {
                                        probs[student.id] *= Math.max(0.001, 1 - (settings.blacklistPenalty || 95) / 100);
                                    }
                                });
                            });

                            // Apply whitelist
                            whitelist.forEach(group => {
                                const cleanGroup = group.map(g => g.replace(/^\\*/, '').replace(/^[（(]/, '').replace(/[）)]$/, ''));
                                const drawnInGroup = cleanGroup.filter(name => drawnSeats.some(s => s.student.name === name));
                                if (drawnInGroup.length === 0) return;
                                remaining.forEach(student => {
                                    if (!cleanGroup.includes(student.name)) return;
                                    let bestBonus = 0;
                                    drawnInGroup.forEach(dn => {
                                        const ds = drawnSeats.find(s => s.student.name === dn);
                                        if (!ds) return;
                                        const rowDiff = Math.abs(ds.row - target.row);
                                        const colDiff = Math.abs(ds.col - target.col);
                                        let bonus = 0;
                                        if (rowDiff === 0 && colDiff === 1) bonus = (settings.whitelistDeskBonus || 200) / 100;
                                        else if (rowDiff === 1 && colDiff === 0) bonus = (settings.whitelistFrontBackBonus || 120) / 100;
                                        else if (rowDiff === 1 && colDiff === 1) bonus = (settings.whitelistDiagonalBonus || 60) / 100;
                                        else if (Math.abs(ds.row - target.row) + Math.abs(ds.col - target.col) <= 5) bonus = (settings.whitelistFallbackBonus || 150) / 100;
                                        bestBonus = Math.max(bestBonus, bonus);
                                    });
                                    if (bestBonus > 0) probs[student.id] *= Math.pow(1 + bestBonus, 3);
                                });
                            });
                        }

                        // Clamp and normalize
                        let total = 0;
                        remaining.forEach(s => { probs[s.id] = Math.max(probs[s.id], 0.001); total += probs[s.id]; });
                        remaining.forEach(s => { probs[s.id] /= total; });

                        // Weighted random pick
                        let r = rng();
                        let cumulative = 0;
                        let picked = remaining[remaining.length - 1];
                        for (let i = 0; i < remaining.length; i++) {
                            cumulative += probs[remaining[i].id];
                            if (r <= cumulative) { picked = remaining[i]; break; }
                        }

                        // Place student
                        target.student = picked;
                        const rIdx = remaining.findIndex(s => s.id === picked.id);
                        if (rIdx >= 0) remaining.splice(rIdx, 1);
                        drawn.push(picked);
                        drawIdx++;

                        // Record frequency
                        if (entry.type === 'normal') {
                            seatFreq[entry.idx][picked.id] = (seatFreq[entry.idx][picked.id] || 0) + 1;
                        } else {
                            seatFreq[entry.type][picked.id] = (seatFreq[entry.type][picked.id] || 0) + 1;
                        }
                    }

                    // Record adjacent pairs
                    for (let i = 0; i < simSeats.length; i++) {
                        const s = simSeats[i];
                        if (!s.student) continue;
                        const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
                        for (const [dr, dc] of dirs) {
                            const nr = s.row + dr, nc = s.col + dc;
                            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                                const n = simSeats[nr * cols + nc];
                                if (n && n.student) {
                                    const key = Math.min(s.student.id, n.student.id) + '-' + Math.max(s.student.id, n.student.id);
                                    pairFreq[key] = (pairFreq[key] || 0) + 1;
                                }
                            }
                        }
                    }
                    // Platform neighbors
                    if (includePlatform) {
                        [{ seat: pL, type: 'pl' }, { seat: pR, type: 'pr' }].forEach(p => {
                            if (!p.seat.student) return;
                            simSeats.forEach(s => {
                                if (!s.student) return;
                                if (Math.abs(s.row - p.seat.row) <= 1 && Math.abs(s.col - p.seat.col) <= 1) {
                                    const key = Math.min(p.seat.student.id, s.student.id) + '-' + Math.max(p.seat.student.id, s.student.id);
                                    pairFreq[key] = (pairFreq[key] || 0) + 1;
                                }
                            });
                        });
                    }
                }

                self.postMessage({
                    type: 'batch_done',
                    seatFreq: seatFreq,
                    pairFreq: pairFreq,
                    processed: count
                });
            }
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        return new Worker(URL.createObjectURL(blob));
    },

    // --- Progress Panel ---
    _simProgressPanel: null,
    _simCancelled: false,
    _simWorker: null,

    _createProgressPanel() {
        // Remove existing panel if any
        if (this._simProgressPanel) { this._simProgressPanel.remove(); this._simProgressPanel = null; }

        const panel = document.createElement('div');
        panel.className = 'sim-progress-panel';
        panel.innerHTML = `
            <div class="spp-header">
                <span class="spp-title">🧪 蒙特卡洛预演</span>
                <button class="spp-close" id="sppClose">✕</button>
            </div>
            <div class="spp-body">
                <div class="spp-ring-container">
                    <svg class="spp-ring" viewBox="0 0 80 80">
                        <circle class="spp-ring-bg" cx="40" cy="40" r="34" />
                        <circle class="spp-ring-fg" id="sppRingFg" cx="40" cy="40" r="34" />
                    </svg>
                    <span class="spp-ring-text" id="sppRingText">0%</span>
                </div>
                <div class="spp-info">
                    <div class="spp-row"><span>进度</span><span id="sppProgress">0 / 0</span></div>
                    <div class="spp-row"><span>已用时间</span><span id="sppElapsed">0s</span></div>
                    <div class="spp-row"><span>预计剩余</span><span id="sppETA">计算中...</span></div>
                </div>
                <div class="spp-alerts" id="sppAlerts"></div>
                <button class="btn btn-danger btn-sm spp-cancel" id="sppCancel">⏹ 取消模拟</button>
            </div>
        `;
        document.body.appendChild(panel);
        this._simProgressPanel = panel;

        // Make draggable
        makeDraggable(panel);

        // Close button
        panel.querySelector('#sppClose').addEventListener('click', () => {
            if (this._simWorker) { this._simCancelled = true; this._simWorker.postMessage({ type: 'cancel' }); }
            panel.remove();
            this._simProgressPanel = null;
        });
        panel.querySelector('#sppCancel').addEventListener('click', () => {
            this._simCancelled = true;
            if (this._simWorker) this._simWorker.postMessage({ type: 'cancel' });
            document.getElementById('sppCancel').textContent = '⏹ 正在取消...';
            document.getElementById('sppCancel').disabled = true;
        });

        return panel;
    },

    _updateProgress(completed, total, startTime) {
        const pct = Math.round(completed / total * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = completed / elapsed;
        const remaining = total - completed;
        const eta = rate > 0 ? Math.ceil(remaining / rate) : 0;

        const ring = document.getElementById('sppRingFg');
        if (ring) {
            const circumference = 2 * Math.PI * 34;
            ring.style.strokeDasharray = circumference;
            ring.style.strokeDashoffset = circumference * (1 - completed / total);
        }
        const ringText = document.getElementById('sppRingText');
        if (ringText) ringText.textContent = pct + '%';
        const progEl = document.getElementById('sppProgress');
        if (progEl) progEl.textContent = `${completed} / ${total}`;
        const elapsedEl = document.getElementById('sppElapsed');
        if (elapsedEl) elapsedEl.textContent = elapsed < 60 ? Math.round(elapsed) + 's' : Math.floor(elapsed / 60) + 'm ' + Math.round(elapsed % 60) + 's';
        const etaEl = document.getElementById('sppETA');
        if (etaEl) {
            if (completed >= total) etaEl.textContent = '完成！';
            else if (eta < 60) etaEl.textContent = eta + 's';
            else etaEl.textContent = Math.floor(eta / 60) + 'm ' + (eta % 60) + 's';
        }
    },

    _updateAlerts(pairFreq, numSim) {
        const alertsEl = document.getElementById('sppAlerts');
        if (!alertsEl) return;
        // Find top 3 most frequent adjacent pairs
        const pairs = Object.entries(pairFreq)
            .map(([key, count]) => {
                const [id1, id2] = key.split('-').map(Number);
                const s1 = state.students.find(s => s.id === id1);
                const s2 = state.students.find(s => s.id === id2);
                return { s1, s2, count, pct: Math.round(count / numSim * 100) };
            })
            .filter(p => p.s1 && p.s2)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        if (pairs.length === 0) { alertsEl.innerHTML = ''; return; }

        alertsEl.innerHTML = '<div class="spp-alert-title">⚡ 高频相邻配对</div>' +
            pairs.map(p => `<div class="spp-alert-item">${escapeHtml(p.s1.name)} ↔ ${escapeHtml(p.s2.name)} <span class="spp-alert-pct">${p.pct}%</span></div>`).join('');
    },

    // --- Configuration Panel ---
    _showSimConfig() {
        return new Promise((resolve) => {
            const modal = document.getElementById('statsModal');
            const content = document.getElementById('statsContent');
            const platformSeats = [state.platformLeft, state.platformRight].filter(s => !s.disabled && state['show' + (s.type === 'platform-left' ? 'PlatformLeft' : 'PlatformRight')]).length;
            const normalSeats = state.seats.filter(s => !s.disabled).length;
            const totalSeats = normalSeats + platformSeats;
            const studentCount = state.students.length;
            const isLarge = studentCount > 100 || totalSeats > 200;
            const defaultSims = isLarge ? 200 : 1000;

            content.innerHTML = `
                <div class="sim-config">
                    <div class="sim-config-section">
                        <h4>📊 模拟参数</h4>
                        <div class="form-group" style="margin-bottom:12px;">
                            <label class="form-label">模拟次数</label>
                            <div class="btn-group" style="margin-bottom:6px;">
                                <button class="btn btn-secondary btn-sm sim-count-btn" data-count="100">100</button>
                                <button class="btn btn-secondary btn-sm sim-count-btn" data-count="500">500</button>
                                <button class="btn btn-secondary btn-sm sim-count-btn${defaultSims===1000?' active':''}" data-count="1000">1000</button>
                                <button class="btn btn-secondary btn-sm sim-count-btn" data-count="5000">5000</button>
                            </div>
                            <input type="number" class="form-input" id="simCountInput" value="${defaultSims}" min="10" max="50000" placeholder="自定义次数">
                            ${isLarge ? '<div class="form-hint" style="color:var(--warning);">⚠️ 检测到大规模数据 (' + studentCount + '人/' + totalSeats + '座)，已自动降低默认次数。</div>' : ''}
                        </div>
                        <div class="form-group" style="margin-bottom:12px;">
                            <label class="form-label">随机种子 (可选，留空则随机)</label>
                            <input type="number" class="form-input" id="simSeedInput" value="" placeholder="如 42 用于重现结果">
                        </div>
                        <div class="form-checkbox">
                            <input type="checkbox" id="simIncludePlatform" checked>
                            <label for="simIncludePlatform">包含讲台座位 (${platformSeats}个)</label>
                        </div>
                    </div>
                    <div class="sim-config-section">
                        <h4>ℹ️ 当前布局</h4>
                        <div class="sim-config-info">
                            <span>学生: ${studentCount}人</span>
                            <span>普通座位: ${normalSeats}个</span>
                            <span>讲台座位: ${platformSeats}个</span>
                            <span>黑名单规则: ${state.blacklist.length}组</span>
                            <span>白名单规则: ${state.whitelist.length}组</span>
                        </div>
                    </div>
                </div>
            `;

            // Quick count buttons
            content.querySelectorAll('.sim-count-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    content.querySelectorAll('.sim-count-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById('simCountInput').value = btn.dataset.count;
                });
            });

            modal.classList.add('active');

            // Override the modal's existing footer buttons or add new ones
            const footer = modal.querySelector('.modal-footer');
            const oldFooterHTML = footer ? footer.innerHTML : '';
            if (footer) {
                footer.innerHTML = `<button class="btn btn-secondary" id="simConfigCancel">取消</button><button class="btn btn-primary" id="simConfigStart">🚀 开始预演</button>`;
                document.getElementById('simConfigCancel').addEventListener('click', () => {
                    modal.classList.remove('active');
                    if (footer) footer.innerHTML = oldFooterHTML;
                    resolve(null);
                });
                document.getElementById('simConfigStart').addEventListener('click', () => {
                    const count = parseInt(document.getElementById('simCountInput').value) || defaultSims;
                    const seed = parseInt(document.getElementById('simSeedInput').value) || Math.floor(Math.random() * 1000000);
                    const includePlatform = document.getElementById('simIncludePlatform').checked;
                    modal.classList.remove('active');
                    if (footer) footer.innerHTML = oldFooterHTML;
                    resolve({ count: Math.min(Math.max(count, 10), 50000), seed, includePlatform });
                });
            } else {
                resolve({ count: defaultSims, seed: Math.floor(Math.random() * 1000000), includePlatform: true });
            }
        });
    },

    // --- Main Simulation Runner ---
    async runMonteCarloSimulation(numSimulations, options = {}) {
        // Show config panel if no explicit count
        if (!numSimulations) {
            const config = await this._showSimConfig();
            if (!config) return;
            numSimulations = config.count;
            options = config;
        }

        const totalSims = numSimulations;
        const seed = options.seed || Math.floor(Math.random() * 1000000);
        const includePlatform = options.includePlatform !== false;

        // Create progress panel
        this._simCancelled = false;
        this._createProgressPanel();

        // Serialize state for worker
        const serializedState = {
            students: state.students.map(s => ({ id: s.id, name: s.name, gender: s.gender, lunch: s.lunch })),
            seats: state.seats.map(s => ({ row: s.row, col: s.col, disabled: s.disabled, number: s.number })),
            rows: state.rows,
            cols: state.cols,
            platformLeft: { row: state.platformLeft.row, col: state.platformLeft.col, disabled: state.platformLeft.disabled },
            platformRight: { row: state.platformRight.row, col: state.platformRight.col, disabled: state.platformRight.disabled },
            drawOrder: state.drawOrder.map(s => ({ row: s.row, col: s.col, type: s.type, disabled: s.disabled })),
            blacklist: state.blacklist,
            whitelist: state.whitelist,
            settings: { ...state.settings },
            includePlatform: includePlatform
        };

        // Create worker
        try {
            this._simWorker = this._createSimWorker();
        } catch (err) {
            Toast.error('无法创建模拟 Worker: ' + err.message);
            if (this._simProgressPanel) { this._simProgressPanel.remove(); this._simProgressPanel = null; }
            return;
        }

        const worker = this._simWorker;
        const startTime = Date.now();
        const mergedSeatFreq = {};
        const mergedPairFreq = {};
        let completed = 0;

        // Chunk config
        const CHUNK_SIZE = Math.max(10, Math.min(50, Math.ceil(totalSims / 20)));
        const chunks = [];
        for (let i = 0; i < totalSims; i += CHUNK_SIZE) {
            chunks.push({ startIdx: i, count: Math.min(CHUNK_SIZE, totalSims - i) });
        }
        let chunkIdx = 0;

        return new Promise((resolve) => {
            worker.onmessage = (e) => {
                const msg = e.data;
                if (msg.type === 'batch_done') {
                    // Merge results
                    Object.entries(msg.seatFreq).forEach(([idx, freq]) => {
                        if (!mergedSeatFreq[idx]) mergedSeatFreq[idx] = {};
                        Object.entries(freq).forEach(([sid, count]) => {
                            mergedSeatFreq[idx][sid] = (mergedSeatFreq[idx][sid] || 0) + count;
                        });
                    });
                    Object.entries(msg.pairFreq).forEach(([key, count]) => {
                        mergedPairFreq[key] = (mergedPairFreq[key] || 0) + count;
                    });
                    completed += msg.processed;

                    // Update progress
                    this._updateProgress(completed, totalSims, startTime);
                    this._updateAlerts(mergedPairFreq, completed);

                    // Send next chunk or finish
                    chunkIdx++;
                    if (chunkIdx < chunks.length && !this._simCancelled) {
                        const chunk = chunks[chunkIdx];
                        worker.postMessage({ type: 'run', startIdx: chunk.startIdx, count: chunk.count, seed: seed });
                    } else {
                        // Done
                        worker.terminate();
                        this._simWorker = null;
                        this._onSimulationComplete(mergedSeatFreq, mergedPairFreq, completed, startTime, resolve);
                    }
                } else if (msg.type === 'cancelled') {
                    completed += msg.processed;
                    worker.terminate();
                    this._simWorker = null;
                    Toast.info(`模拟已取消，已完成 ${completed} 次`);
                    if (completed > 0) {
                        this._onSimulationComplete(mergedSeatFreq, mergedPairFreq, completed, startTime, resolve);
                    } else {
                        if (this._simProgressPanel) { this._simProgressPanel.remove(); this._simProgressPanel = null; }
                        resolve(null);
                    }
                } else if (msg.type === 'error') {
                    worker.terminate();
                    this._simWorker = null;
                    Toast.error('模拟 Worker 错误: ' + msg.message);
                    if (this._simProgressPanel) { this._simProgressPanel.remove(); this._simProgressPanel = null; }
                    resolve(null);
                }
            };

            worker.onerror = (err) => {
                worker.terminate();
                this._simWorker = null;
                Toast.error('模拟 Worker 崩溃: ' + (err.message || '未知错误'));
                if (completed > 0) {
                    Toast.warning('已保留部分结果 (' + completed + ' 次)');
                    this._onSimulationComplete(mergedSeatFreq, mergedPairFreq, completed, startTime, resolve);
                } else {
                    if (this._simProgressPanel) { this._simProgressPanel.remove(); this._simProgressPanel = null; }
                    resolve(null);
                }
            };

            // Init and start first chunk
            worker.postMessage({ type: 'init', state: serializedState });
            const firstChunk = chunks[0];
            worker.postMessage({ type: 'run', startIdx: firstChunk.startIdx, count: firstChunk.count, seed: seed });
        });
    },

    _onSimulationComplete(seatFreq, pairFreq, numSim, startTime, resolve) {
        // Close progress panel
        if (this._simProgressPanel) {
            const cancelBtn = document.getElementById('sppCancel');
            if (cancelBtn) { cancelBtn.textContent = '✅ 完成'; cancelBtn.disabled = true; }
            setTimeout(() => {
                if (this._simProgressPanel) { this._simProgressPanel.remove(); this._simProgressPanel = null; }
            }, 2000);
        }

        // Process pair data
        const allPairs = [];
        const studentIds = new Set(state.students.map(s => s.id));
        Object.entries(pairFreq).forEach(([key, count]) => {
            const [id1, id2] = key.split('-').map(Number);
            const s1 = state.students.find(s => s.id === id1);
            const s2 = state.students.find(s => s.id === id2);
            if (s1 && s2) {
                allPairs.push({ s1, s2, count, probability: count / numSim });
            }
        });
        allPairs.sort((a, b) => b.count - a.count);

        // Compute seat entropy
        const seatEntropy = {};
        Object.entries(seatFreq).forEach(([idx, freq]) => {
            const total = Object.values(freq).reduce((a, b) => a + b, 0);
            if (total === 0) { seatEntropy[idx] = 0; return; }
            let entropy = 0;
            Object.values(freq).forEach(c => {
                const p = c / total;
                if (p > 0) entropy -= p * Math.log2(p);
            });
            seatEntropy[idx] = entropy;
        });

        // Gini coefficient for seat concentration
        const maxPercents = {};
        Object.entries(seatFreq).forEach(([idx, freq]) => {
            const total = Object.values(freq).reduce((a, b) => a + b, 0);
            if (total === 0) return;
            maxPercents[idx] = Math.max(...Object.values(freq)) / total;
        });
        const maxPctValues = Object.values(maxPercents);
        const gini = maxPctValues.length > 0 ? this._calcGini(maxPctValues) : 0;

        // Generate suggestions
        const suggestions = this._generateSuggestions(allPairs, numSim);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Show dashboard
        this._showMonteCarloDashboard(seatFreq, seatEntropy, allPairs, numSim, elapsed, gini, suggestions);
        Toast.success(`预演完成！${numSim} 次模拟，耗时 ${elapsed}s`);
        resolve && resolve({ seatFreq, pairFreq: allPairs, numSim, seatEntropy, gini, suggestions });
    },

    _calcGini(values) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        const mean = sorted.reduce((a, b) => a + b, 0) / n;
        if (mean === 0) return 0;
        let sumDiff = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                sumDiff += Math.abs(sorted[i] - sorted[j]);
            }
        }
        return sumDiff / (2 * n * n * mean);
    },

    _generateSuggestions(pairs, numSim) {
        const suggestions = [];
        // High-frequency adjacent pairs that might need blacklist
        const highFreqPairs = pairs.filter(p => p.probability > 0.3).slice(0, 5);
        highFreqPairs.forEach(p => {
            const inBlacklist = state.blacklist.some(group => {
                const names = group.map(g => g.replace(/^\*/, '').replace(/^[（(]/, '').replace(/[）)]$/, ''));
                return names.includes(p.s1.name) && names.includes(p.s2.name);
            });
            if (!inBlacklist) {
                suggestions.push({
                    type: 'blacklist',
                    priority: p.probability > 0.5 ? 'high' : 'medium',
                    text: `${p.s1.name} 和 ${p.s2.name} 在 ${Math.round(p.probability * 100)}% 的模拟中相邻`,
                    action: `建议将 ${p.s1.name} ${p.s2.name} 加入黑名单`,
                    group: [p.s1.name, p.s2.name]
                });
            }
        });

        // Unlikely pairs that might benefit from whitelist
        const lowFreqPairs = pairs.filter(p => p.probability < 0.02 && p.probability > 0).slice(-3);
        lowFreqPairs.forEach(p => {
            const inWhitelist = state.whitelist.some(group => {
                const names = group.map(g => g.replace(/^\*/, '').replace(/^[（(]/, '').replace(/[）)]$/, ''));
                return names.includes(p.s1.name) && names.includes(p.s2.name);
            });
            if (!inWhitelist) {
                suggestions.push({
                    type: 'whitelist',
                    priority: 'low',
                    text: `${p.s1.name} 和 ${p.s2.name} 仅在 ${Math.round(p.probability * 100)}% 的模拟中相邻`,
                    action: `若希望同座，可加入白名单`,
                    group: [p.s1.name, p.s2.name]
                });
            }
        });

        return suggestions;
    },

    // --- Dashboard ---
    _showMonteCarloDashboard(seatFreq, seatEntropy, allPairs, numSim, elapsed, gini, suggestions) {
        const modal = document.getElementById('statsModal');
        const content = document.getElementById('statsContent');

        // Top metrics
        const mostLikely = allPairs[0];
        const leastLikely = allPairs.filter(p => p.count > 0).slice(-1)[0] || allPairs[allPairs.length - 1];

        // Tab structure
        let html = `
            <div class="mc-dashboard">
                <div class="mc-metrics">
                    <div class="mc-metric-card"><div class="mc-metric-value">${numSim}</div><div class="mc-metric-label">模拟次数</div></div>
                    <div class="mc-metric-card"><div class="mc-metric-value">${elapsed}s</div><div class="mc-metric-label">耗时</div></div>
                    <div class="mc-metric-card"><div class="mc-metric-value">${mostLikely ? Math.round(mostLikely.probability * 100) + '%' : '-'}</div><div class="mc-metric-label">最高相邻率</div></div>
                    <div class="mc-metric-card"><div class="mc-metric-value">${(gini * 100).toFixed(1)}%</div><div class="mc-metric-label">集中度(Gini)</div></div>
                </div>
                <div class="mc-tabs">
                    <button class="mc-tab active" data-tab="heatmap">🗺️ 座位热力图</button>
                    <button class="mc-tab" data-tab="matrix">📊 关联矩阵</button>
                    <button class="mc-tab" data-tab="pairs">🔗 配对分析</button>
                    <button class="mc-tab" data-tab="suggest">💡 智能建议</button>
                </div>
                <div class="mc-tab-content" id="mcTabHeatmap">${this._buildHeatmapTab(seatFreq, seatEntropy, numSim)}</div>
                <div class="mc-tab-content" id="mcTabMatrix" style="display:none;">${this._buildMatrixTab(seatFreq, numSim)}</div>
                <div class="mc-tab-content" id="mcTabPairs" style="display:none;">${this._buildPairsTab(allPairs, numSim)}</div>
                <div class="mc-tab-content" id="mcTabSuggest" style="display:none;">${this._buildSuggestTab(suggestions)}</div>
            </div>
        `;

        content.innerHTML = html;
        modal.classList.add('active');

        // Tab switching
        content.querySelectorAll('.mc-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                content.querySelectorAll('.mc-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                content.querySelectorAll('.mc-tab-content').forEach(c => c.style.display = 'none');
                const tabName = tab.dataset.tab;
                const targetId = 'mcTab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
                const target = document.getElementById(targetId);
                if (target) target.style.display = '';
            });
        });

        // Matrix cell click highlight
        content.addEventListener('click', e => {
            const cell = e.target.closest('.mc-matrix-cell');
            if (cell) {
                content.querySelectorAll('.mc-matrix-cell.highlight').forEach(c => c.classList.remove('highlight'));
                cell.classList.add('highlight');
            }
        });

        // Apply suggestion buttons
        content.querySelectorAll('.mc-suggest-apply').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.dataset.group;
                const type = btn.dataset.type;
                if (type === 'blacklist') {
                    const textarea = document.getElementById('blacklist');
                    if (textarea) {
                        const current = textarea.value.trim();
                        textarea.value = current ? current + '\n' + group : group;
                        textarea.dispatchEvent(new Event('input'));
                        Toast.success('已添加到黑名单');
                    }
                } else if (type === 'whitelist') {
                    const textarea = document.getElementById('whitelist');
                    if (textarea) {
                        const current = textarea.value.trim();
                        textarea.value = current ? current + '\n' + group : group;
                        textarea.dispatchEvent(new Event('input'));
                        Toast.success('已添加到白名单');
                    }
                }
            });
        });

        // Pairs sort handler
        const pairsSortSelect = document.getElementById('mcPairsSort');
        const pairsListEl = document.getElementById('mcPairsList');
        if (pairsSortSelect && pairsListEl) {
            const renderPairsSorted = (pairs, order) => {
                const sorted = [...pairs];
                if (order === 'asc') sorted.sort((a, b) => a.probability - b.probability);
                else sorted.sort((a, b) => b.probability - a.probability);
                pairsListEl.innerHTML = sorted.slice(0, 50).map(p => {
                    const pct = Math.round(p.probability * 100);
                    const barColor = pct > 50 ? 'var(--danger)' : pct > 20 ? 'var(--warning)' : 'var(--success)';
                    return `<div class="mc-pair-item">
                        <span class="mc-pair-names">${escapeHtml(p.s1.name)} ↔ ${escapeHtml(p.s2.name)}</span>
                        <div class="mc-pair-bar-track"><div class="mc-pair-bar-fill" style="width:${Math.max(pct, 2)}%;background:${barColor};"></div></div>
                        <span class="mc-pair-pct">${pct}% (${p.count}次)</span>
                    </div>`;
                }).join('');
            };
            pairsSortSelect.addEventListener('change', () => {
                renderPairsSorted(allPairs, pairsSortSelect.value);
            });
        }
    },

    _buildHeatmapTab(seatFreq, seatEntropy, numSim) {
        let html = '<div class="mc-heatmap">';
        html += '<div class="mc-heatmap-legend"><span class="mc-hl-item"><span class="mc-hl-dot" style="background:#34C759;"></span>低熵(确定)</span><span class="mc-hl-item"><span class="mc-hl-dot" style="background:#8E8E93;"></span>高熵(多样)</span></div>';
        html += '<div class="mc-heatmap-grid" style="display:grid;grid-template-columns:repeat(' + state.cols + ',1fr);gap:4px;">';

        for (let row = 0; row < state.rows; row++) {
            for (let col = 0; col < state.cols; col++) {
                const idx = row * state.cols + col;
                const seat = state.seats[idx];
                if (seat.disabled) {
                    html += '<div class="mc-heatmap-cell disabled"></div>';
                    continue;
                }
                const freq = seatFreq[idx] || {};
                const total = Object.values(freq).reduce((a, b) => a + b, 0);
                const entropy = seatEntropy[idx] || 0;
                const maxEntropy = Math.log2(Math.max(state.students.length, 2));
                const normEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

                // Color: low entropy = green, high entropy = gray
                const r = Math.round(52 + (142 - 52) * normEntropy);
                const g = Math.round(199 + (142 - 199) * normEntropy);
                const b = Math.round(89 + (147 - 89) * normEntropy);
                const bgColor = `rgb(${r},${g},${b})`;

                // Top student for this seat
                const topEntry = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
                const topStudent = topEntry ? state.students.find(s => s.id === parseInt(topEntry[0])) : null;
                const topPct = topEntry && total > 0 ? Math.round(topEntry[1] / total * 100) : 0;

                html += `<div class="mc-heatmap-cell" style="background:${bgColor};color:${normEntropy > 0.5 ? '#fff' : '#fff'};" title="座位${seat.number}\n熵值: ${entropy.toFixed(2)}\n${topStudent ? topStudent.name + ' ' + topPct + '%' : '无数据'}">
                    <div class="mc-hc-num">${seat.number}</div>
                    <div class="mc-hc-name">${topStudent ? escapeHtml(topStudent.name) : '-'}</div>
                    <div class="mc-hc-pct">${topPct}%</div>
                </div>`;
            }
        }
        html += '</div></div>';
        return html;
    },

    _buildMatrixTab(seatFreq, numSim) {
        // Show top students (rows) x top seats (columns) matrix
        const students = state.students.slice(0, 30); // Limit for display
        const seats = state.seats.filter(s => !s.disabled).slice(0, 20);

        let html = '<div class="mc-matrix-wrapper">';
        html += '<div class="mc-matrix-scroll">';
        html += '<table class="mc-matrix-table"><thead><tr><th class="mc-matrix-corner">学生\\座位</th>';
        seats.forEach(s => { html += `<th class="mc-matrix-header">${s.number}</th>`; });
        html += '</tr></thead><tbody>';

        students.forEach(student => {
            html += `<tr><td class="mc-matrix-row-header">${escapeHtml(student.name)}</td>`;
            seats.forEach(seat => {
                const freq = seatFreq[state.seats.indexOf(seat)] || {};
                const count = freq[student.id] || 0;
                const pct = numSim > 0 ? count / numSim : 0;
                const opacity = Math.min(pct * 3, 1); // Scale for visibility
                const bg = pct > 0.01 ? `rgba(0,122,255,${opacity})` : 'transparent';
                html += `<td class="mc-matrix-cell" style="background:${bg};" title="${student.name} → ${seat.number}号: ${(pct * 100).toFixed(1)}%">${pct > 0.01 ? (pct * 100).toFixed(0) + '%' : ''}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        if (state.students.length > 30) html += `<div class="form-hint" style="margin-top:8px;">显示前 30 名学生 / ${state.students.length} 人</div>`;
        if (state.seats.filter(s => !s.disabled).length > 20) html += `<div class="form-hint">显示前 20 个座位 / ${state.seats.filter(s => !s.disabled).length} 个</div>`;
        html += '</div>';
        return html;
    },

    _buildPairsTab(allPairs, numSim) {
        let html = '<div class="mc-pairs">';
        html += '<div class="mc-pairs-controls">';
        html += '<select id="mcPairsSort" class="form-input" style="width:auto;height:32px;font-size:12px;">';
        html += '<option value="desc">相邻率 从高到低</option>';
        html += '<option value="asc">相邻率 从低到高</option>';
        html += '</select>';
        html += `<span class="form-hint" style="margin-left:8px;">共 ${allPairs.length} 个配对</span>`;
        html += '</div>';
        html += '<div class="mc-pairs-list" id="mcPairsList">';

        const renderPairs = (pairs) => {
            return pairs.map(p => {
                const pct = Math.round(p.probability * 100);
                const barColor = pct > 50 ? 'var(--danger)' : pct > 20 ? 'var(--warning)' : 'var(--success)';
                return `<div class="mc-pair-item">
                    <span class="mc-pair-names">${escapeHtml(p.s1.name)} ↔ ${escapeHtml(p.s2.name)}</span>
                    <div class="mc-pair-bar-track"><div class="mc-pair-bar-fill" style="width:${Math.max(pct, 2)}%;background:${barColor};"></div></div>
                    <span class="mc-pair-pct">${pct}% (${p.count}次)</span>
                </div>`;
            }).join('');
        };

        html += renderPairs(allPairs.slice(0, 50));
        html += '</div>';
        if (allPairs.length > 50) html += `<div class="form-hint" style="margin-top:8px;">显示前 50 个配对 / ${allPairs.length} 个</div>`;
        html += '</div>';
        return html;
    },

    _buildSuggestTab(suggestions) {
        if (suggestions.length === 0) {
            return '<div class="mc-suggest-empty">🎉 当前布局表现良好，暂无调整建议。</div>';
        }
        let html = '<div class="mc-suggestions">';
        suggestions.forEach((s, i) => {
            const icon = s.type === 'blacklist' ? '🚫' : '🔗';
            const badgeClass = s.priority === 'high' ? 'high' : s.priority === 'medium' ? 'medium' : 'low';
            const badgeText = s.priority === 'high' ? '高' : s.priority === 'medium' ? '中' : '低';
            html += `<div class="mc-suggest-item">
                <div class="mc-suggest-header">
                    <span class="mc-suggest-icon">${icon}</span>
                    <span class="mc-suggest-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="mc-suggest-text">${escapeHtml(s.text)}</div>
                <div class="mc-suggest-action">${escapeHtml(s.action)}</div>
                <button class="btn btn-primary btn-sm mc-suggest-apply" data-type="${s.type}" data-group="${escapeHtml(s.group.join(' '))}">应用</button>
            </div>`;
        });
        html += '</div>';
        return html;
    },

    // ==================== Pool Search Dropdown ====================
    renderPoolSearchDropdown(query) {
        const dropdown = document.getElementById('poolSearchDropdown');
        if (!dropdown) return;
        if (!query) { dropdown.classList.remove('open'); dropdown.style.top = ''; dropdown.style.left = ''; dropdown.style.width = ''; return; }

        // [FIX] Position dropdown with fixed coords to escape overflow:hidden
        const input = document.getElementById('poolSearch');
        if (input) {
            const rect = input.getBoundingClientRect();
            dropdown.style.top = (rect.bottom + 4) + 'px';
            dropdown.style.left = rect.left + 'px';
            dropdown.style.width = rect.width + 'px';
        }

        // [FIX #4] Use unified matchStudent
        const q = query.toLowerCase();
        const students = state.remainingStudents.filter(s => matchStudent(s, q)).slice(0, 10);

        if (students.length === 0) { dropdown.classList.remove('open'); return; }

        dropdown.innerHTML = students.map(s => {
            const meta = [];
            meta.push(s.gender === 'male' ? '♂' : '♀');
            if (s.lunch) meta.push('💤');
            const avg = CompositeEval.getAvgScore(s);
            if (avg !== null) meta.push(`📊${avg}`);
            if (s.personality) meta.push(s.personality);
            if (s.position) meta.push(s.position);
            return `<div class="smart-search-item" data-student-id="${s.id}"><span>${escapeHtml(s.name)}</span><span class="match-hint">${meta.join(' ')}</span></div>`;
        }).join('');

        dropdown.classList.add('open');
        dropdown.querySelectorAll('.smart-search-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.studentId);
                const student = state.remainingStudents.find(s => s.id === id);
                if (student) this.showStudentDetailFromPool(student);
                dropdown.classList.remove('open');
                document.getElementById('poolSearch').value = '';
            });
        });
    },

    showStudentDetailFromPool(student) {
        const modal = document.getElementById('studentDetailModal');
        document.getElementById('studentDetailName').textContent = `${student.name} 的详细信息`;

        let html = '';
        html += `<div class="detail-section"><div class="detail-section-title">👤 基本信息</div><div class="detail-grid">`;
        html += `<div class="detail-item"><span class="detail-item-label">姓名</span><span class="detail-item-value">${escapeHtml(student.name)}</span></div>`;
        html += `<div class="detail-item"><span class="detail-item-label">性别</span><span class="detail-item-value">${student.gender === 'male' ? '♂ 男' : '♀ 女'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-item-label">午休</span><span class="detail-item-value">${student.lunch ? '💤 是' : '否'}</span></div>`;
        html += `<div class="detail-item"><span class="detail-item-label">状态</span><span class="detail-item-value">⏳ 待抽取</span></div>`;
        if (student.personality) html += `<div class="detail-item"><span class="detail-item-label">性格</span><span class="detail-item-value">${escapeHtml(student.personality)}</span></div>`;
        if (student.position) html += `<div class="detail-item"><span class="detail-item-label">职务</span><span class="detail-item-value">${escapeHtml(student.position)}</span></div>`;
        if (student.hobbies?.length > 0) html += `<div class="detail-item" style="grid-column:1/-1;"><span class="detail-item-label">爱好</span><span class="detail-item-value">${student.hobbies.join(' / ')}</span></div>`;
        html += `</div></div>`;

        const scores = student.scores || {};
        const scoreEntries = Object.entries(scores).filter(([k, v]) => v !== null && v !== undefined);
        if (scoreEntries.length > 0) {
            html += `<div class="detail-section"><div class="detail-section-title">📊 各科成绩</div>`;
            scoreEntries.forEach(([subj, score]) => {
                const color = score >= 90 ? 'var(--success)' : score >= 80 ? 'var(--primary)' : score >= 70 ? 'var(--warning)' : score >= 60 ? '#FF9500' : 'var(--danger)';
                html += `<div class="detail-score-bar"><span class="detail-score-label">${subj}</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${score}%;background:${color};">${score}</div></div></div>`;
            });
            html += `</div>`;
        }

        const compositeScore = CompositeEval.getScore(student);
        const avgScore = CompositeEval.getAvgScore(student);
        html += `<div class="detail-section"><div class="detail-section-title">🏆 综合评价</div>`;
        html += `<div class="detail-grid">`;
        html += `<div class="detail-item"><span class="detail-item-label">综合评分</span><span class="detail-item-value" style="color:var(--primary);font-size:16px;">${compositeScore}</span></div>`;
        html += `<div class="detail-item"><span class="detail-item-label">平均成绩</span><span class="detail-item-value">${avgScore ?? 'N/A'}</span></div>`;
        html += `</div></div>`;

        document.getElementById('studentDetailContent').innerHTML = html;
        modal.classList.add('active');
        document.getElementById('closeStudentDetail').onclick = () => modal.classList.remove('active');
        document.getElementById('closeStudentDetailBtn').onclick = () => modal.classList.remove('active');
        document.getElementById('locateStudentBtn').style.display = 'none';
        document.getElementById('locateStudentBtn').onclick = () => modal.classList.remove('active');
        // [FIX #8] Edit button handler for pool students
        document.getElementById('editStudentBtn').style.display = '';
        document.getElementById('editStudentBtn').onclick = () => {
            const content = document.getElementById('studentDetailContent');
            const editHtml = `<div class="detail-section"><div class="detail-section-title">✏️ 编辑信息</div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">姓名</label><input class="form-input" id="editName" value="${student.name}"></div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">性别</label><select class="form-input" id="editGender"><option value="male" ${student.gender==='male'?'selected':''}>♂ 男</option><option value="female" ${student.gender==='female'?'selected':''}>♀ 女</option></select></div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">午休</label><select class="form-input" id="editLunch"><option value="true" ${student.lunch?'selected':''}>是</option><option value="false" ${!student.lunch?'selected':''}>否</option></select></div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">性格</label><input class="form-input" id="editPersonality" value="${student.personality||''}"></div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">职务</label><input class="form-input" id="editPosition" value="${student.position||''}"></div>
                <div class="form-group" style="margin-bottom:8px;"><label class="form-label">爱好 (逗号分隔)</label><input class="form-input" id="editHobbies" value="${(student.hobbies||[]).join(',')}"></div>
                <button class="btn btn-primary" id="saveEditBtn" style="margin-top:8px;">💾 保存</button>
            </div>`;
            content.innerHTML = editHtml;
            document.getElementById('editStudentBtn').style.display = 'none';
            document.getElementById('saveEditBtn').onclick = () => {
                student.name = document.getElementById('editName').value.trim() || student.name;
                student.gender = document.getElementById('editGender').value;
                student.lunch = document.getElementById('editLunch').value === 'true';
                student.personality = document.getElementById('editPersonality').value.trim() || null;
                student.position = document.getElementById('editPosition').value.trim() || null;
                const hobbiesStr = document.getElementById('editHobbies').value.trim();
                student.hobbies = hobbiesStr ? hobbiesStr.split(',').map(h => h.trim()).filter(h => h) : [];
                this.renderPool();
                modal.classList.remove('active');
                Toast.success('学生信息已更新');
            };
        };
    },

    // ==================== Full Student Search ====================
    _fullSearchFilter: 'all',
    performFullStudentSearch(query, filter) {
        const results = document.getElementById('fullSearchResults');
        if (!results) return;

        const allStudents = state.students;
        if (!query && filter === 'all') {
            results.innerHTML = '<div class="pool-empty">输入关键词搜索全部学生</div>';
            return;
        }

        // [FEATURE #8] Parse advanced query syntax
        const parsed = parseQuery(query || '');
        const textQ = parsed.text;
        const filters = parsed.filters;

        let filtered = allStudents;

        // Apply status filter
        if (filter === 'seated') {
            filtered = filtered.filter(s => state.drawnStudents.some(d => d.id === s.id));
        } else if (filter === 'pending') {
            filtered = filtered.filter(s => state.remainingStudents.some(r => r.id === s.id));
        } else if (filter === 'pinned') {
            filtered = filtered.filter(s => s.pinned);
        } else if (filter === 'male') {
            filtered = filtered.filter(s => s.gender === 'male');
        } else if (filter === 'female') {
            filtered = filtered.filter(s => s.gender === 'female');
        }

        // [FIX #4] Apply search query using matchStudent
        if (textQ) {
            filtered = filtered.filter(s => matchStudent(s, textQ));
        }

        // [FEATURE #8] Apply parsed filters
        if (filters.gender) {
            const g = filters.gender === '男' || filters.gender === 'male' ? 'male' : 'female';
            filtered = filtered.filter(s => s.gender === g);
        }
        if (filters.lunch) {
            const want = filters.lunch === '是' || filters.lunch === 'yes' || filters.lunch === '1';
            filtered = filtered.filter(s => s.lunch === want);
        }
        if (filters.personality) {
            filtered = filtered.filter(s => s.personality === filters.personality);
        }
        if (filters.position) {
            filtered = filtered.filter(s => s.position && s.position.includes(filters.position));
        }
        if (filters.scoreAbove) {
            const min = parseInt(filters.scoreAbove);
            filtered = filtered.filter(s => { const avg = CompositeEval.getAvgScore(s); return avg !== null && avg > min; });
        }
        if (filters.scoreBelow) {
            const max = parseInt(filters.scoreBelow);
            filtered = filtered.filter(s => { const avg = CompositeEval.getAvgScore(s); return avg !== null && avg < max; });
        }

        if (filtered.length === 0) {
            results.innerHTML = '<div class="pool-empty">未找到匹配的学生</div>';
            return;
        }

        // [FEATURE #23] Virtual scrolling / load more for large result sets
        const PAGE_SIZE = 30;
        const limited = filtered.slice(0, PAGE_SIZE);

        results.innerHTML = limited.map(s => {
            const isSeated = state.drawnStudents.some(d => d.id === s.id);
            const seat = isSeated ? [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === s.id) : null;
            const statusBadge = isSeated
                ? `<span class="fsi-badge seated">🪑 ${seat ? this.seatLabel(seat) : '已排座'}</span>`
                : '<span class="fsi-badge pending">⏳ 待抽取</span>';

            const meta = [];
            meta.push(s.gender === 'male' ? '♂' : '♀');
            if (s.lunch) meta.push('💤');
            if (s.personality) meta.push(escapeHtml(s.personality));
            if (s.position) meta.push(escapeHtml(s.position));

            const avg = CompositeEval.getAvgScore(s);
            const scoreStr = avg !== null ? `📊${avg}` : '';

            return `<div class="full-search-item" data-student-id="${s.id}" data-seated="${isSeated}">
                <div class="fsi-left">
                    <div>
                        <div class="fsi-name">${escapeHtml(s.name)}${s.pinned ? ' 📌' : ''}</div>
                        <div class="fsi-meta">
                            ${meta.map(m => `<span class="fsi-badge">${m}</span>`).join('')}
                            ${scoreStr ? `<span class="fsi-badge">${scoreStr}</span>` : ''}
                        </div>
                    </div>
                </div>
                ${statusBadge}
            </div>`;
        }).join('');

        if (filtered.length > PAGE_SIZE) {
            const loadMore = document.createElement('div');
            loadMore.className = 'pool-empty';
            loadMore.style.cursor = 'pointer';
            loadMore.textContent = `显示前 ${PAGE_SIZE} 条，共 ${filtered.length} 条结果 — 点击加载更多`;
            loadMore.addEventListener('click', () => {
                const nextBatch = filtered.slice(PAGE_SIZE, PAGE_SIZE * 2);
                nextBatch.forEach(s => {
                    const isSeated = state.drawnStudents.some(d => d.id === s.id);
                    const seat = isSeated ? [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === s.id) : null;
                    const statusBadge = isSeated ? `<span class="fsi-badge seated">🪑 ${seat ? this.seatLabel(seat) : '已排座'}</span>` : '<span class="fsi-badge pending">⏳ 待抽取</span>';
                    const meta = [s.gender === 'male' ? '♂' : '♀'];
                    if (s.lunch) meta.push('💤');
                    if (s.personality) meta.push(escapeHtml(s.personality));
                    if (s.position) meta.push(escapeHtml(s.position));
                    const avg = CompositeEval.getAvgScore(s);
                    const scoreStr = avg !== null ? `📊${avg}` : '';
                    const item = document.createElement('div');
                    item.className = 'full-search-item';
                    item.dataset.studentId = s.id;
                    item.dataset.seated = isSeated ? 'true' : 'false';
                    item.innerHTML = `<div class="fsi-left"><div><div class="fsi-name">${escapeHtml(s.name)}${s.pinned ? ' 📌' : ''}</div><div class="fsi-meta">${meta.map(m => `<span class="fsi-badge">${m}</span>`).join('')}${scoreStr ? `<span class="fsi-badge">${scoreStr}</span>` : ''}</div></div></div>${statusBadge}`;
                    results.insertBefore(item, loadMore);
                    item.addEventListener('click', () => {
                        if (isSeated) { const st = [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === s.id); if (st) this.showStudentInfo(st); }
                        else this.showStudentDetailFromPool(s);
                    });
                });
                loadMore.remove();
            });
            results.appendChild(loadMore);
        }

        // Bind click handlers
        results.querySelectorAll('.full-search-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.studentId);
                const student = allStudents.find(s => s.id === id);
                if (!student) return;
                const isSeated = item.dataset.seated === 'true';
                if (isSeated) {
                    const seat = [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === id);
                    if (seat) this.showStudentInfo(seat);
                } else {
                    this.showStudentDetailFromPool(student);
                }
            });
            // [FEATURE] Double-click to locate seat or place student
            item.addEventListener('dblclick', () => {
                const id = parseInt(item.dataset.studentId);
                const student = allStudents.find(s => s.id === id);
                if (!student) return;
                const isSeated = item.dataset.seated === 'true';
                if (isSeated) {
                    // Scroll to and highlight the seat
                    const seat = [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === id);
                    if (seat && seat.element) {
                        seat.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        seat.element.classList.add('selected');
                        setTimeout(() => seat.element.classList.remove('selected'), 2000);
                        Toast.info(`${student.name} 的座位已定位`);
                    }
                } else {
                    // Try to place student in selected empty seat
                    if (state.selectedPoolStudent !== null) {
                        // Already in pool-select mode, just confirm
                        Toast.info('请点击空座位落座');
                    } else {
                        // Auto-select this student and highlight empty seats
                        state.selectedPoolStudent = student.id;
                        document.querySelectorAll('.seat:not(.disabled)').forEach(s => {
                            if (!state.seats.find(ss => ss.element === s)?.student) s.classList.add('pool-target');
                        });
                        document.getElementById('poolClickHint')?.classList.add('visible');
                        Toast.info(`${student.name} 已选中，请点击空座位落座`);
                    }
                }
            });
        });
    },

    // ==================== Export with timestamp ====================
    getTimestamp() {
        const d = new Date();
        return `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}_${d.getHours().toString().padStart(2,'0')}${d.getMinutes().toString().padStart(2,'0')}`;
    },

    // ==================== Help Modal Tab Switching ====================
    openHelpTab(tabName) {
        document.getElementById('helpModal').classList.add('active');
        document.querySelectorAll('#helpTabBar .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
        document.querySelectorAll('#helpModal .tab-content').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tabName));
        if (tabName === 'algorithm') CompositeEval.renderExplanation();
    },

    // ==================== Apply Settings ====================
    applyGlobalSettings() {
        const s = state.settings;
        document.getElementById('screenshotBgColor').value = s.screenshotBgColor;
        document.getElementById('screenshotBgColorText').value = s.screenshotBgColor;
        document.getElementById('screenshotTransparentBg').checked = s.screenshotTransparentBg;
        document.getElementById('lunchUnderlineColor').value = s.lunchUnderlineColor;
        document.getElementById('lunchUnderlineColorText').value = s.lunchUnderlineColor;
        document.getElementById('seatFontSize').value = s.seatFontSize;
        document.getElementById('drawAnimationDuration').value = s.drawAnimationDuration;
        document.getElementById('exportIncludeGender').checked = s.exportIncludeGender;
        document.getElementById('exportIncludeLunch').checked = s.exportIncludeLunch;
        document.getElementById('exportIncludeSeatNumber').checked = s.exportIncludeSeatNumber;
        document.getElementById('enableDragDrop').checked = s.enableDragDrop;
        document.getElementById('enableClickSwap').checked = s.enableClickSwap;
        document.getElementById('showProbabilityByDefault').checked = s.showProbabilityByDefault;
        // Sync inline auto-draw interval
        const inlineInput = document.getElementById('autoDrawIntervalInline');
        if (inlineInput) inlineInput.value = s.autoDrawInterval || 800;
        const pluginIntervalInput = document.getElementById('autoDrawIntervalPlugin');
        if (pluginIntervalInput) pluginIntervalInput.value = s.autoDrawInterval || 800;
        document.getElementById('blacklistPenalty').value = s.blacklistPenalty;
        document.getElementById('blacklistRadius').value = s.blacklistRadius;
        document.getElementById('whitelistDeskBonus').value = s.whitelistDeskBonus;
        document.getElementById('whitelistFrontBackBonus').value = s.whitelistFrontBackBonus;
        document.getElementById('whitelistDiagonalBonus').value = s.whitelistDiagonalBonus;
        document.getElementById('whitelistFallbackBonus').value = s.whitelistFallbackBonus;
        // Sync quick info bar visibility
        const qi = s.quickInfoItems || {};
        if (document.getElementById('qiShowLayout')) document.getElementById('qiShowLayout').checked = qi.layout !== false;
        if (document.getElementById('qiShowTotal')) document.getElementById('qiShowTotal').checked = qi.total !== false;
        if (document.getElementById('qiShowDrawn')) document.getElementById('qiShowDrawn').checked = qi.drawn !== false;
        if (document.getElementById('qiShowRemaining')) document.getElementById('qiShowRemaining').checked = qi.remaining !== false;
        if (document.getElementById('qiShowMale')) document.getElementById('qiShowMale').checked = qi.male !== false;
        if (document.getElementById('qiShowFemale')) document.getElementById('qiShowFemale').checked = qi.female !== false;
        if (document.getElementById('qiShowLunch')) document.getElementById('qiShowLunch').checked = qi.lunch !== false;
        this.applyQuickInfoVisibility();
    },

    setButtonLoading(id, loading) {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (loading) { btn.dataset.origText = btn.innerHTML; btn.innerHTML = '<span class="loading-spinner"></span>'; btn.disabled = true; }
        else { btn.innerHTML = btn.dataset.origText || btn.innerHTML; btn.disabled = false; }
    },

    // ==================== Events ====================
    bindEvents() {
        // Theme
        document.getElementById('themeToggle').addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const d = document.body.classList.contains('dark');
            document.getElementById('themeToggle').textContent = d ? '☀️' : '🌙';
            Toast.success(`${d ? '深色' : '浅色'}模式`);
        });
        // Sidebar tabs
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('pane-' + tab.dataset.tab)?.classList.add('active');
            });
        });
        // Panel collapse (using grid-template-rows trick)
        document.querySelectorAll('.panel-header').forEach(header => {
            header.addEventListener('click', () => header.parentElement.classList.toggle('collapsed'));
        });
        // Probability panel - single toggle via button only
        document.getElementById('probToggleBtn').addEventListener('click', () => document.getElementById('probabilityContent').classList.toggle('prob-collapsed'));
        // Close panels
        document.getElementById('closeProbability').addEventListener('click', () => document.getElementById('probabilityPanel').style.display = 'none');
        // Undo/Redo buttons
        document.getElementById('undoBtn').addEventListener('click', () => UndoManager.undo());
        document.getElementById('redoBtn').addEventListener('click', () => UndoManager.redo());
        // Context menu: seat
        document.getElementById('seatContextMenu').addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (!action) return;
            const menu = document.getElementById('seatContextMenu');
            const seat = menu.dataset.seatType === 'normal' ? state.seats[parseInt(menu.dataset.seatIndex)] : (menu.dataset.seatType === 'platform-left' ? state.platformLeft : state.platformRight);
            if (!seat) return;
            switch (action) {
                case 'swap': state.swapMode = true; state.selectedSeat = seat; seat.element.classList.add('selected'); Toast.info('请点击另一个座位完成互换'); break;
                case 'moveToPool': case 'clearSeat': this.clearSeat(seat); break;
                case 'toggleLunch': this.toggleLunch(seat); break;
                case 'disableSeat': this.disableSeat(seat); break;
                case 'enableSeat': this.enableSeat(seat); break;
                case 'togglePin': this.togglePin(seat); break;
                case 'viewInfo': this.showStudentInfo(seat); break;
            }
            menu.style.display = 'none';
        });
        // Context menu: column
        document.getElementById('columnContextMenu').addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (!action) return;
            const col = parseInt(document.getElementById('columnContextMenu').dataset.col);
            if (action === 'disableColumn') this.disableColumn(col);
            else if (action === 'enableColumn') this.enableColumn(col);
            document.getElementById('columnContextMenu').style.display = 'none';
        });
        // Layout templates
        document.querySelectorAll('[data-tpl]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [r, c] = btn.dataset.tpl.split(',').map(Number);
                document.getElementById('rows').value = r;
                document.getElementById('cols').value = c;
            });
        });
        // Apply layout
        document.getElementById('applyLayout').addEventListener('click', () => {
            const rows = parseInt(document.getElementById('rows').value);
            const cols = parseInt(document.getElementById('cols').value);
            const errEl = document.getElementById('layoutError');
            if (!rows || rows < 1 || rows > 20 || !cols || cols < 1 || cols > 20) {
                errEl.classList.add('visible');
                document.getElementById(rows < 1 || rows > 20 ? 'rows' : 'cols').classList.add('error');
                Toast.error('排数和列数必须在 1-20 之间');
                return;
            }
            errEl.classList.remove('visible');
            document.getElementById('rows').classList.remove('error');
            document.getElementById('cols').classList.remove('error');
            state.rows = rows; state.cols = cols;
            state.settings.numberingMode = document.getElementById('numberingMode').value;
            state.showPlatformLeft = document.getElementById('showPlatformLeft').checked;
            state.showPlatformRight = document.getElementById('showPlatformRight').checked;
            state.platformLeft.disabled = !state.showPlatformLeft;
            state.platformRight.disabled = !state.showPlatformRight;
            state.showDoors = document.getElementById('showDoors').checked;
            state.doorPosition = document.getElementById('doorPosition').value;
            this.applyDoorPosition();
            this.renderClassroom();
            this.resetDraw();
            addLog('🏫', `布局设置为 ${rows}×${cols}`);
            Toast.success('布局已应用');
        });
        // Fill example
        document.getElementById('fillExample').addEventListener('click', () => {
            const names = [
                '张三,男,1,85,92,78,88,76,90,82,85,88,外向,篮球/绘画,班长',
                '李四,女,0,92,88,95,90,85,88,92,90,95,内向,阅读/音乐,学习委员',
                '王五,男,0,78,65,72,80,68,75,70,72,78,中性,篮球,体育委员',
                '赵六,女,1,88,91,85,82,90,86,88,85,82,外向,绘画/舞蹈,文艺委员',
                '孙七,男,0,65,58,70,60,55,62,58,65,60,内向,阅读,',
                '周八,女,1,91,95,88,92,90,85,88,91,92,外向,音乐/篮球,课代表',
                '吴九,男,0,73,80,68,75,82,70,78,73,75,中性,运动,小组长',
                '郑十,女,0,82,76,90,85,78,88,82,80,85,内向,阅读/绘画,',
                '钱十一,男,1,95,98,92,96,94,90,95,98,96,外向,篮球/编程,班长',
                '冯十二,女,0,68,72,65,70,65,68,72,68,70,中性,音乐,',
                '陈十三,男,0,77,83,75,80,78,82,75,77,80,内向,阅读/运动,劳动委员',
                '褚十四,女,1,84,79,88,82,85,80,78,84,82,外向,舞蹈/绘画,',
                '卫十五,男,0,90,87,85,88,92,86,90,87,88,中性,编程/篮球,',
                '蒋十六,女,0,72,68,76,75,70,72,68,72,75,内向,音乐/阅读,'
            ];
            document.getElementById('studentsText').value = names.join('\n');
            Toast.info('已填入 14 名示例学生（含9科成绩、性格、爱好、职务）');
        });
        // Import text
        document.getElementById('importText').addEventListener('click', () => {
            const text = document.getElementById('studentsText').value.trim();
            if (!text) { Toast.warning('请输入学生名单'); return; }
            const oldStudents = [...state.students];
            state.students = [];
            let errors = 0;
            const subjects = state.subjects;
            text.split('\n').forEach((line, i) => {
                const parts = line.split(',').map(s => s.trim());
                if (parts[0]) {
                    // Parse multi-subject scores
                    const scores = {};
                    subjects.forEach((subj, si) => {
                        const val = parts[3 + si];
                        if (val !== undefined && val !== '') {
                            const num = parseFloat(val);
                            if (!isNaN(num)) {
                                scores[subj] = clamp(num, 0, 100);
                                if (num < 0 || num > 100) errors++;
                            }
                        }
                    });
                    // Legacy single score = average of all subjects
                    const scoreVals = Object.values(scores);
                    const avgScore = scoreVals.length > 0 ? Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length) : null;

                    // Parse personality, hobbies, position
                    const pIdx = 3 + subjects.length;
                    const personality = parts[pIdx] || null;
                    const hobbiesStr = parts[pIdx + 1] || '';
                    const hobbies = hobbiesStr ? hobbiesStr.split('/').map(h => h.trim()).filter(Boolean) : [];
                    const position = parts[pIdx + 2] || null;

                    state.students.push({
                        id: i, name: parts[0],
                        gender: parts[1] === state.settings.maleMapping ? 'male' : 'female',
                        lunch: String(parts[2]).trim() === '1',
                        score: avgScore,
                        scores: scores,
                        personality: state.personalityTypes.includes(personality) ? personality : null,
                        hobbies: hobbies,
                        position: state.classPositions.includes(position) ? position : null,
                        pinned: false
                    });
                }
            });
            if (errors > 0) Toast.warning(`有 ${errors} 个成绩值超出 0-100 范围，已自动修正`);
            this.resetDraw();
            addLog('📝', `文本导入 ${state.students.length} 名学生`);
            Toast.success(`导入 ${state.students.length} 名学生`);
        });
        // Clear students
        document.getElementById('clearStudents').addEventListener('click', () => {
            if (!confirm('确定清空所有学生名单？')) return;
            state.students = [];
            document.getElementById('studentsText').value = '';
            this.resetDraw();
            Toast.success('学生名单已清空');
            addLog('🗑️', '清空学生名单');
        });
        // Excel import
        document.getElementById('importExcel').addEventListener('click', () => document.getElementById('excelFile').click());
        document.getElementById('excelFile').addEventListener('change', e => {
            const file = e.target.files[0]; if (!file) return;
            this.setButtonLoading('importExcel', true);
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = new Uint8Array(ev.target.result);
                    const wb = XLSX.read(data, { type: 'array' });
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    state.students = [];
                    let errors = 0;
                    const subjects = state.subjects;
                    const header = json[0] || [];
                    // Try to match column headers to subjects
                    const subjectColMap = {};
                    subjects.forEach(subj => {
                        const idx = header.findIndex(h => String(h).trim() === subj);
                        if (idx >= 0) subjectColMap[subj] = idx;
                    });
                    const hasHeaderMatch = Object.keys(subjectColMap).length > 0;

                    json.slice(1).forEach((row, i) => {
                        if (row[0]) {
                            // Parse scores
                            const scores = {};
                            if (hasHeaderMatch) {
                                // Use header-mapped columns
                                Object.entries(subjectColMap).forEach(([subj, colIdx]) => {
                                    const val = row[colIdx];
                                    if (val !== undefined && val !== '') {
                                        const num = parseFloat(val);
                                        if (!isNaN(num)) { scores[subj] = clamp(num, 0, 100); if (num < 0 || num > 100) errors++; }
                                    }
                                });
                            } else {
                                // Fallback: columns 3 onwards are scores in order
                                subjects.forEach((subj, si) => {
                                    const val = row[3 + si];
                                    if (val !== undefined && val !== '') {
                                        const num = parseFloat(val);
                                        if (!isNaN(num)) { scores[subj] = clamp(num, 0, 100); if (num < 0 || num > 100) errors++; }
                                    }
                                });
                            }
                            const scoreVals = Object.values(scores);
                            const avgScore = scoreVals.length > 0 ? Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length) : null;

                            // Parse extended fields
                            const pIdx = hasHeaderMatch ? header.findIndex(h => String(h).trim() === '性格') : 3 + subjects.length;
                            const hIdx = hasHeaderMatch ? header.findIndex(h => String(h).trim() === '爱好') : pIdx + 1;
                            const posIdx = hasHeaderMatch ? header.findIndex(h => String(h).trim() === '职务') : hIdx + 1;
                            const personality = pIdx >= 0 ? String(row[pIdx] || '').trim() : null;
                            const hobbiesStr = hIdx >= 0 ? String(row[hIdx] || '').trim() : '';
                            const hobbies = hobbiesStr ? hobbiesStr.split('/').map(h => h.trim()).filter(Boolean) : [];
                            const position = posIdx >= 0 ? String(row[posIdx] || '').trim() : null;

                            state.students.push({
                                id: i, name: String(row[0] || '').trim(),
                                gender: String(row[1]).trim() === state.settings.maleMapping ? 'male' : 'female',
                                lunch: row[2] == 1 || String(row[2]).trim() === '1',
                                score: avgScore,
                                scores: scores,
                                personality: state.personalityTypes.includes(personality) ? personality : null,
                                hobbies: hobbies,
                                position: state.classPositions.includes(position) ? position : null,
                                pinned: false
                            });
                        }
                    });
                    if (errors > 0) Toast.warning(`有 ${errors} 个成绩值超出范围，已自动修正`);
                    this.resetDraw();
                    addLog('📂', `Excel导入 ${state.students.length} 名学生`);
                    Toast.success(`导入 ${state.students.length} 名学生`);
                } catch (err) { Toast.error('导入失败'); console.error(err); }
                finally { this.setButtonLoading('importExcel', false); e.target.value = ''; }
            };
            reader.readAsArrayBuffer(file);
        });
        // Student pool filter/search
        document.querySelectorAll('.pool-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pool-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.poolFilter = btn.dataset.filter;
                this.renderPool();
            });
        });
        document.getElementById('poolSearch').addEventListener('input', debounce(e => {
            state.poolSearch = e.target.value.trim();
            this.renderPool();
            this.renderPoolSearchDropdown(e.target.value.trim());
        }, 200));
        document.getElementById('poolSearch').addEventListener('focus', e => {
            if (e.target.value.trim()) this.renderPoolSearchDropdown(e.target.value.trim());
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('.pool-search')) {
                document.getElementById('poolSearchDropdown')?.classList.remove('open');
            }
        });
        // Full student search
        document.getElementById('fullStudentSearch')?.addEventListener('input', debounce(e => {
            this.performFullStudentSearch(e.target.value.trim(), this._fullSearchFilter);
        }, 200));
        document.getElementById('fullStudentSearch')?.addEventListener('focus', e => {
            if (e.target.value.trim()) this.performFullStudentSearch(e.target.value.trim(), this._fullSearchFilter);
        });
        document.querySelectorAll('#fullSearchFilters .pool-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#fullSearchFilters .pool-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._fullSearchFilter = btn.dataset.filter;
                const query = document.getElementById('fullStudentSearch')?.value?.trim() || '';
                this.performFullStudentSearch(query, this._fullSearchFilter);
            });
        });
        // Blacklist/Whitelist import
        const setupListImport = (btnId, fileId, listKey, textareaId) => {
            document.getElementById(btnId).addEventListener('click', () => document.getElementById(fileId).click());
            document.getElementById(fileId).addEventListener('change', e => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                    try {
                        const data = new Uint8Array(ev.target.result);
                        const wb = XLSX.read(data, { type: 'array' });
                        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
                        state[listKey] = [];
                        json.forEach(row => {
                            const group = row.filter(c => c && c.toString().trim()).map(c => c.toString().trim());
                            if (group.length >= 2) state[listKey].push(group);
                        });
                        document.getElementById(textareaId).value = state[listKey].map(g => g.join(' ')).join('\n');
                        Toast.success(`导入 ${state[listKey].length} 组`);
                    } catch (err) { Toast.error('导入失败'); }
                    finally { e.target.value = ''; }
                };
                reader.readAsText(file);
            });
        };
        setupListImport('importBlacklist', 'blacklistFile', 'blacklist', 'blacklist');
        setupListImport('importWhitelist', 'whitelistFile', 'whitelist', 'whitelist');
        document.getElementById('clearBlacklist').addEventListener('click', () => { state.blacklist = []; document.getElementById('blacklist').value = ''; Toast.success('已清空'); });
        document.getElementById('clearWhitelist').addEventListener('click', () => { state.whitelist = []; document.getElementById('whitelist').value = ''; Toast.success('已清空'); });
        // Draw
        document.getElementById('drawNext').addEventListener('click', () => {
            const seat = this.doDrawNext();
            if (seat) Toast.success(`${state.drawnStudents[state.drawnStudents.length - 1].name} → ${this.seatLabel(seat)}`);
        });
        document.getElementById('autoDraw').addEventListener('click', () => this.startAutoDraw());
        document.getElementById('stopAutoDraw').addEventListener('click', () => this.stopAutoDraw());
        document.getElementById('resetDraw').addEventListener('click', () => { if (confirm('确定重置抽取？')) this.resetDraw(); });
        // View dropdown menu
        document.getElementById('viewMenuBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const dd = document.getElementById('viewDropdown');
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        });
        // Heatmap
        document.getElementById('toggleHeatmap').addEventListener('click', () => {
            document.getElementById('viewDropdown').style.display = 'none';
            state.heatmapVisible = !state.heatmapVisible;
            const legend = document.getElementById('heatmapLegend');
            if (state.heatmapVisible) {
                this.renderHeatmap(); legend.style.display = 'flex';
                document.getElementById('toggleHeatmap').textContent = '🔥 关闭热力图';
                this.updateHeatmapSubjectVisibility();
            } else {
                this.clearHeatmap(); legend.style.display = 'none';
                document.getElementById('toggleHeatmap').textContent = '🔥 热力图';
            }
        });
        document.getElementById('closeHeatmap').addEventListener('click', () => { state.heatmapVisible = false; this.clearHeatmap(); document.getElementById('heatmapLegend').style.display = 'none'; document.getElementById('toggleHeatmap').textContent = '🔥 热力图'; });
        // Heatmap type selector
        document.getElementById('heatmapTypeSelector').addEventListener('click', e => {
            const btn = e.target.closest('.heatmap-type-btn');
            if (!btn) return;
            document.querySelectorAll('.heatmap-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.heatmapType = btn.dataset.type;
            this.updateHeatmapSubjectVisibility();
            if (state.heatmapVisible) this.renderHeatmap();
        });
        // Heatmap subject select
        document.getElementById('heatmapSubjectSelect').addEventListener('change', () => {
            if (state.heatmapVisible) this.renderHeatmap();
        });
        // Stats
        document.getElementById('viewStats').addEventListener('click', () => { document.getElementById('viewDropdown').style.display = 'none'; this.showStats(); });
        document.getElementById('closeStatsModal').addEventListener('click', () => document.getElementById('statsModal').classList.remove('active'));
        document.getElementById('closeStatsBtn').addEventListener('click', () => document.getElementById('statsModal').classList.remove('active'));
        // Batch mode
        document.getElementById('batchCancel').addEventListener('click', () => this.exitBatchMode());
        document.getElementById('batchClear').addEventListener('click', () => {
            state.batchSeats.forEach(s => this.clearSeat(s));
            this.exitBatchMode();
        });
        document.getElementById('batchDisable').addEventListener('click', () => {
            state.batchSeats.forEach(s => this.disableSeat(s));
            this.exitBatchMode();
        });
        document.getElementById('batchLunch').addEventListener('click', () => {
            state.batchSeats.forEach(s => this.toggleLunch(s));
            this.exitBatchMode();
        });
        // Export seats
        document.getElementById('exportSeats').addEventListener('click', () => {
            document.getElementById('exportDropdown').style.display = 'none';
            // [AUDIT-2] Export empty state check
            const hasSeated = state.seats.some(s => s.student) || state.platformLeft.student || state.platformRight.student;
            if (!hasSeated && state.remainingStudents.length === 0) {
                Toast.warning('没有学生数据可导出');
                return;
            }
            const wb = XLSX.utils.book_new();
            const header = [];
            if (state.settings.exportIncludeSeatNumber) header.push('座位号');
            header.push('姓名');
            if (state.settings.exportIncludeGender) header.push('性别');
            if (state.settings.exportIncludeLunch) header.push('是否午休');
            // [FEATURE #18] Full data export option
            const fullData = document.getElementById('exportFullData')?.checked;
            if (fullData) {
                state.subjects.forEach(s => header.push(s));
                header.push('平均成绩', '综合评分', '性格', '爱好', '职务', '状态');
            } else {
                header.push('成绩');
            }
            const data = [header];
            const allSeats = [...state.drawOrder].sort((a, b) => a.number - b.number);
            allSeats.forEach(seat => {
                if (!seat.student) return;
                const row = [];
                if (state.settings.exportIncludeSeatNumber) {
                    row.push(seat.type === 'platform-left' ? '讲台左' : seat.type === 'platform-right' ? '讲台右' : seat.number);
                }
                row.push(seat.student.name);
                if (state.settings.exportIncludeGender) row.push(seat.student.gender === 'male' ? '男' : '女');
                if (state.settings.exportIncludeLunch) row.push(seat.student.lunch ? '是' : '否');
                if (fullData) {
                    state.subjects.forEach(subj => row.push(seat.student.scores?.[subj] ?? ''));
                    row.push(seat.student.score ?? '');
                    row.push(CompositeEval.getScore(seat.student));
                    row.push(seat.student.personality || '');
                    row.push((seat.student.hobbies || []).join('/'));
                    row.push(seat.student.position || '');
                    row.push(seat.student.pinned ? '📌 已固定' : '已排座');
                } else {
                    row.push(seat.student.score ?? '');
                }
                data.push(row);
            });
            // [FEATURE #18] Also export remaining students if full data
            if (fullData) {
                state.remainingStudents.forEach(s => {
                    const row = ['', s.name, s.gender === 'male' ? '男' : '女', s.lunch ? '是' : '否'];
                    state.subjects.forEach(subj => row.push(s.scores?.[subj] ?? ''));
                    row.push(s.score ?? '', CompositeEval.getScore(s), s.personality || '', (s.hobbies || []).join('/'), s.position || '', '⏳ 待抽取');
                    data.push(row);
                });
            }
            let exportData = { data };
            Object.keys(state.plugins).forEach(pn => {
                const result = PluginManager.call(pn, 'beforeExport', exportData);
                if (result) exportData = result;
            });
            const ws = XLSX.utils.aoa_to_sheet(exportData.data);
            XLSX.utils.book_append_sheet(wb, ws, '座位表');
            XLSX.writeFile(wb, `座位表_${this.getTimestamp()}.xlsx`);
            Toast.success(fullData ? '完整数据已导出' : '座位表已导出');
            addLog('📤', fullData ? '导出完整数据 Excel' : '导出座位表 Excel');
        });
        // Export screenshot - now uses preview modal (handled above)
        // document.getElementById('exportScreenshot') event is bound in the new preview section above
        // Settings modal
        document.getElementById('globalSettingsBtn').addEventListener('click', () => {
            this.updateStats(); // Refresh stats when opening
            document.getElementById('settingsModal').classList.add('active');
        });
        document.getElementById('closeSettingsModal').addEventListener('click', () => document.getElementById('settingsModal').classList.remove('active'));
        // Settings tab switching
        document.getElementById('settingsTabBar').addEventListener('click', e => {
            const btn = e.target.closest('.tab-btn'); if (!btn) return;
            document.querySelectorAll('#settingsTabBar .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('#settingsModal .tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById('stab-' + btn.dataset.stab)?.classList.add('active');
        });
        document.getElementById('clearCacheBtn').addEventListener('click', () => { document.getElementById('settingsModal').classList.remove('active'); document.getElementById('clearCacheModal').classList.add('active'); });
        document.getElementById('closeClearCacheModal').addEventListener('click', () => document.getElementById('clearCacheModal').classList.remove('active'));
        document.getElementById('cancelClearCache').addEventListener('click', () => document.getElementById('clearCacheModal').classList.remove('active'));
        document.getElementById('confirmClearCache').addEventListener('click', () => {
            if (!confirm('确定要清除选中的数据吗？此操作不可恢复！')) return;
            if (document.getElementById('clearAllData').checked) { localStorage.removeItem('seatArrangerConfig'); location.reload(); }
            else {
                if (document.getElementById('clearHistory').checked) state.history = [];
                if (document.getElementById('clearPlugins').checked) { state.plugins = {}; PluginManager.renderPluginsList(); }
                saveConfig(); Toast.success('缓存已清除');
            }
            document.getElementById('clearCacheModal').classList.remove('active');
        });
        // Color sync
        ['screenshotBgColor','lunchUnderlineColor'].forEach(prefix => {
            const color = document.getElementById(prefix);
            const text = document.getElementById(prefix + 'Text');
            color.addEventListener('input', () => text.value = color.value);
            text.addEventListener('input', () => { try { color.value = text.value; } catch(e) {} });
        });
        // Save settings
        document.getElementById('saveSettings').addEventListener('click', () => {
            const s = state.settings;
            s.screenshotBgColor = document.getElementById('screenshotBgColor').value;
            s.screenshotTransparentBg = document.getElementById('screenshotTransparentBg').checked;
            s.lunchUnderlineColor = document.getElementById('lunchUnderlineColor').value;
            s.seatFontSize = parseInt(document.getElementById('seatFontSize').value) || 13;
            s.drawAnimationDuration = parseInt(document.getElementById('drawAnimationDuration').value) || 400;
            s.exportIncludeGender = document.getElementById('exportIncludeGender').checked;
            s.exportIncludeLunch = document.getElementById('exportIncludeLunch').checked;
            s.exportIncludeSeatNumber = document.getElementById('exportIncludeSeatNumber').checked;
            s.enableDragDrop = document.getElementById('enableDragDrop').checked;
            s.enableClickSwap = document.getElementById('enableClickSwap').checked;
            s.showProbabilityByDefault = document.getElementById('showProbabilityByDefault').checked;
            s.autoDrawInterval = parseInt(document.getElementById('autoDrawIntervalInline').value) || parseInt(document.getElementById('autoDrawIntervalPlugin')?.value) || 800;
            s.blacklistPenalty = clamp(parseInt(document.getElementById('blacklistPenalty').value) || 95, 0, 100);
            s.blacklistRadius = clamp(parseInt(document.getElementById('blacklistRadius').value) || 2, 1, 10);
            s.whitelistDeskBonus = clamp(parseInt(document.getElementById('whitelistDeskBonus').value) || 200, 0, 999);
            s.whitelistFrontBackBonus = clamp(parseInt(document.getElementById('whitelistFrontBackBonus').value) || 120, 0, 999);
            s.whitelistDiagonalBonus = clamp(parseInt(document.getElementById('whitelistDiagonalBonus').value) || 60, 0, 999);
            s.whitelistFallbackBonus = clamp(parseInt(document.getElementById('whitelistFallbackBonus').value) || 150, 0, 999);
            // Quick info bar visibility
            s.quickInfoItems = {
                layout: document.getElementById('qiShowLayout')?.checked !== false,
                total: document.getElementById('qiShowTotal')?.checked !== false,
                drawn: document.getElementById('qiShowDrawn')?.checked !== false,
                remaining: document.getElementById('qiShowRemaining')?.checked !== false,
                male: document.getElementById('qiShowMale')?.checked !== false,
                female: document.getElementById('qiShowFemale')?.checked !== false,
                lunch: document.getElementById('qiShowLunch')?.checked !== false,
            };
            if (s.theme) this.applyTheme(s.theme);
            if (s.accentColor) this.applyAccentColor(s.accentColor);
            this.applyGlobalSettings();
            state.seats.forEach(seat => this.updateSeatDisplay(seat));
            this.updateSeatDisplay(state.platformLeft); this.updateSeatDisplay(state.platformRight);
            this.updateProbabilityPanel();
            document.getElementById('settingsModal').classList.remove('active');
            Toast.success('设置已保存');
            saveConfig();
        });
        // Reset settings
        document.getElementById('resetSettings').addEventListener('click', () => {
            if (!confirm('确定恢复默认设置？')) return;
            state.settings = {
                numberingMode:'horizontal-snake', maleMapping:'男', femaleMapping:'女',
                blacklistPenalty:95, blacklistRadius:2, whitelistDeskBonus:200, whitelistFrontBackBonus:120,
                whitelistDiagonalBonus:60, whitelistFallbackBonus:150, drawMode:'predictable',
                genderBalance:true, antiCluster:true, lunchUnderlineColor:'#007AFF', seatFontSize:13,
                drawAnimationDuration:400, screenshotBgColor:'#ffffff', screenshotTransparentBg:false,
                exportIncludeGender:true, exportIncludeLunch:true, exportIncludeSeatNumber:true,
                enableDragDrop:true, enableClickSwap:true, showStatsByDefault:true, showProbabilityByDefault:true,
                autoDrawInterval:800, theme:'', accentColor:'#007AFF',
                quickInfoItems: { layout:true, total:true, drawn:true, remaining:true, male:true, female:true, lunch:true },
                weights: { academic: 60, personality: 15, hobby: 10, position: 10, gender: 5 }
            };
            this.applyGlobalSettings(); this.renderClassroom(); this.resetDraw();
            document.getElementById('settingsModal').classList.remove('active');
            Toast.success('已恢复默认设置');
        });
        // Plugin settings
        document.getElementById('closePluginSettingsModal').addEventListener('click', () => document.getElementById('pluginSettingsModal').classList.remove('active'));
        document.getElementById('savePluginSettings').addEventListener('click', () => {
            if (currentEditingPlugin && state.plugins[currentEditingPlugin]?.saveSettings) state.plugins[currentEditingPlugin].saveSettings();
            document.getElementById('pluginSettingsModal').classList.remove('active');
            Toast.success('插件设置已保存');
        });
        // Import plugin
        document.getElementById('importPlugin').addEventListener('click', () => document.getElementById('pluginFile').click());
        document.getElementById('pluginFile').addEventListener('change', e => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const code = ev.target.result;
                try {
                    // Security scan
                    const report = SecuritySandbox.scan(code);
                    if (report.riskLevel === 'critical') {
                        Toast.error('插件安全检测未通过：包含高危代码，已阻止导入');
                        addLog('🛡️', `安全拦截: ${file.name} (危险级别: ${report.riskLevel})`);
                        e.target.value = '';
                        return;
                    }
                    // Load with sandbox
                    const safePluginManager = { register: (n, p) => {
                        p.securityStatus = report.safe ? 'ok' : 'risk';
                        p.securityReport = report;
                        if (report.blockedAPIs?.length > 0) {
                            p.status = 'warn';
                            p.securityStatus = 'risk';
                        }
                        PluginManager.register(n, p);
                    }};
                    const safeConsole = { log: console.log, error: console.error, warn: console.warn };
                    const fn = new Function('PluginManager', 'console', 'state', code);
                    fn(safePluginManager, safeConsole, null);

                    if (report.riskLevel !== 'safe') {
                        Toast.warning(`插件已导入，但检测到潜在风险（${report.warnings?.join(', ') || '详见安全面板'}）`);
                        addLog('⚠️', `风险插件导入: ${file.name}`);
                    } else {
                        Toast.success('插件导入成功');
                    }
                    SecuritySandbox.renderReport();
                    ModuleRegistry.renderList();
                } catch (err) { console.error('插件导入失败', err); Toast.error('插件导入失败: ' + err.message); }
                finally { e.target.value = ''; }
            };
            reader.readAsText(file);
        });
        // Help modal
        document.getElementById('helpBtn').addEventListener('click', () => document.getElementById('helpModal').classList.add('active'));
        document.getElementById('closeHelpModal').addEventListener('click', () => document.getElementById('helpModal').classList.remove('active'));
        document.getElementById('closeHelpBtn').addEventListener('click', () => document.getElementById('helpModal').classList.remove('active'));
        document.getElementById('helpTabBar').addEventListener('click', e => {
            const btn = e.target.closest('.tab-btn'); if (!btn) return;
            document.querySelectorAll('#helpTabBar .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('#helpModal .tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
        });
        // Export/Import config
        const exportConfigBtn = document.getElementById('exportConfig');
        if (exportConfigBtn) exportConfigBtn.addEventListener('click', () => {
            const config = {
                rows: state.rows, cols: state.cols,
                platformLeft: { disabled: state.platformLeft.disabled, student: state.platformLeft.student },
                platformRight: { disabled: state.platformRight.disabled, student: state.platformRight.student },
                showDoors: state.showDoors, doorPosition: state.doorPosition, showPlatformLeft: state.showPlatformLeft, showPlatformRight: state.showPlatformRight,
                students: state.students, blacklist: state.blacklist, whitelist: state.whitelist,
                settings: state.settings,
                seats: state.seats.map(s => ({ number: s.number, row: s.row, col: s.col, disabled: s.disabled, student: s.student })),
                history: state.history, plugins: state.plugins
            };
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.download = `座位配置_${this.getTimestamp()}.json`;
            link.href = URL.createObjectURL(blob); link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            Toast.success('配置包已导出'); addLog('📤', '导出配置包');
        });
        const importConfigBtn = document.getElementById('importConfig');
        const configFileInput = document.getElementById('configFile');
        if (importConfigBtn && configFileInput) {
            importConfigBtn.addEventListener('click', () => configFileInput.click());
            configFileInput.addEventListener('change', e => {
            const file = e.target.files[0]; if (!file) return;
            this.setButtonLoading('importConfig', true);
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const config = JSON.parse(ev.target.result);
                    // [FIX] Safe restore with seat count validation
                    if (config.rows) state.rows = config.rows;
                    if (config.cols) state.cols = config.cols;
                    if (config.showDoors !== undefined) state.showDoors = config.showDoors;
                    if (config.doorPosition !== undefined) state.doorPosition = config.doorPosition;
                    if (config.showPlatformLeft !== undefined) state.showPlatformLeft = config.showPlatformLeft;
                    if (config.showPlatformRight !== undefined) state.showPlatformRight = config.showPlatformRight;
                    if (config.platformLeft) { state.platformLeft.disabled = config.platformLeft.disabled; state.platformLeft.student = config.platformLeft.student; }
                    if (config.platformRight) { state.platformRight.disabled = config.platformRight.disabled; state.platformRight.student = config.platformRight.student; }
                    if (config.students) state.students = config.students;
                    if (config.blacklist) state.blacklist = config.blacklist;
                    if (config.whitelist) state.whitelist = config.whitelist;
                    if (config.history) state.history = config.history;
                    if (config.settings) {
                        // [FIX #20] Version compatibility: fill missing fields with defaults
                        const defaults = {
                            numberingMode:'horizontal-snake', maleMapping:'男', femaleMapping:'女',
                            blacklistPenalty:95, blacklistRadius:2, whitelistDeskBonus:200, whitelistFrontBackBonus:120,
                            whitelistDiagonalBonus:60, whitelistFallbackBonus:150, drawMode:'predictable',
                            genderBalance:true, antiCluster:true, lunchUnderlineColor:'#007AFF', seatFontSize:13,
                            drawAnimationDuration:400, screenshotBgColor:'#ffffff', screenshotTransparentBg:false,
                            exportIncludeGender:true, exportIncludeLunch:true, exportIncludeSeatNumber:true,
                            enableDragDrop:true, enableClickSwap:true, showStatsByDefault:true, showProbabilityByDefault:true,
                            autoDrawInterval:800, theme:'', accentColor:'#007AFF',
                            quickInfoItems: { layout:true, total:true, drawn:true, remaining:true, male:true, female:true, lunch:true },
                            weights: { academic: 60, personality: 15, hobby: 10, position: 10, gender: 5 }
                        };
                        state.settings = { ...defaults, ...config.settings };
                        // Ensure nested objects are merged properly
                        if (config.settings.quickInfoItems) state.settings.quickInfoItems = { ...defaults.quickInfoItems, ...config.settings.quickInfoItems };
                        if (config.settings.weights) state.settings.weights = { ...defaults.weights, ...config.settings.weights };
                    }
                    if (config.plugins) {
                        // [FIX] Re-init plugins on import
                        Object.entries(config.plugins).forEach(([name, plugin]) => {
                            if (!state.plugins[name]) {
                                state.plugins[name] = plugin;
                                if (plugin.init) try { plugin.init(); } catch(e) {}
                            }
                        });
                        PluginManager.renderPluginsList();
                    }
                    document.getElementById('rows').value = state.rows;
                    document.getElementById('cols').value = state.cols;
                    document.getElementById('numberingMode').value = state.settings.numberingMode;
                    document.getElementById('showPlatformLeft').checked = state.showPlatformLeft;
                    document.getElementById('showPlatformRight').checked = state.showPlatformRight;
                    document.getElementById('showDoors').checked = state.showDoors;
                    document.getElementById('doorPosition').value = state.doorPosition || 'right';
                    document.getElementById('blacklist').value = state.blacklist.map(g => g.join(' ')).join('\n');
                    document.getElementById('whitelist').value = state.whitelist.map(g => g.join(' ')).join('\n');
                    this.applyGlobalSettings();
                    this.renderClassroom();
                    // Restore disabled/student - [FIX] validate seat count
                    if (config.seats) {
                        const savedCount = config.seats.length;
                        const currentCount = state.seats.length;
                        if (savedCount !== currentCount) Toast.warning(`座位数不匹配(保存:${savedCount} 当前:${currentCount})，部分座位数据可能丢失`);
                        config.seats.forEach((saved, i) => {
                            if (state.seats[i]) {
                                state.seats[i].disabled = saved.disabled;
                                state.seats[i].student = saved.student;
                                this.updateSeatDisplay(state.seats[i]);
                            }
                        });
                        this.checkAisles(); this.generateDrawOrder();
                    }
                    // Restore draw state
                    state.drawnStudents = []; state.remainingStudents = []; state.currentDrawIndex = 0;
                    [...state.seats, state.platformLeft, state.platformRight].forEach(s => { if (s.student) state.drawnStudents.push(s.student); });
                    state.students.forEach(s => { if (!state.drawnStudents.some(d => d.id === s.id)) state.remainingStudents.push(s); });
                    while (state.currentDrawIndex < state.drawOrder.length) {
                        const s = state.drawOrder[state.currentDrawIndex];
                        if (!s.student && !s.disabled) break;
                        state.currentDrawIndex++;
                    }
                    this.updateStats(); this.updateProbabilityPanel(); this.renderPool();
                    addLog('📥', '导入配置包'); Toast.success('配置导入成功');
                } catch (err) { Toast.error('导入失败: ' + err.message); console.error(err); }
                finally { this.setButtonLoading('importConfig', false); e.target.value = ''; }
            };
            reader.readAsText(file);
        });
        }
        // Export/Import log
        const exportLogBtn = document.getElementById('exportLog');
        if (exportLogBtn) exportLogBtn.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(state.history, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.download = `历史日志_${this.getTimestamp()}.json`;
            link.href = URL.createObjectURL(blob); link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            Toast.success('历史日志已导出');
        });
        const importLogBtn = document.getElementById('importLog');
        const logFileInput = document.getElementById('logFile');
        if (importLogBtn && logFileInput) {
            importLogBtn.addEventListener('click', () => logFileInput.click());
            logFileInput.addEventListener('change', e => {
                const file = e.target.files[0]; if (!file) return;
                this.setButtonLoading('importLog', true);
                const reader = new FileReader();
                reader.onload = ev => {
                    try { state.history = JSON.parse(ev.target.result); Toast.success('历史日志导入成功'); }
                    catch (err) { Toast.error('导入失败'); }
                    finally { this.setButtonLoading('importLog', false); e.target.value = ''; }
                };
                reader.readAsText(file);
            });
        }
        // Clear log
        document.getElementById('clearLog').addEventListener('click', () => { opLogs.length = 0; renderLogList(); Toast.success('日志已清空'); });
        // Blacklist/Whitelist text input
        const saveBlacklist = debounce(() => {
            state.blacklist = document.getElementById('blacklist').value.trim().split('\n')
                .filter(l => l.trim() && !l.trim().startsWith('#'))
                .map(l => l.trim().split(/\s+/).map(n => {
                    // [FIX #7] Parse anchor markers: *name or (name) or （name）
                    n = n.trim();
                    // Keep marker for algorithm to parse
                    return n;
                }));
        }, 500);
        const saveWhitelist = debounce(() => {
            state.whitelist = document.getElementById('whitelist').value.trim().split('\n')
                .filter(l => l.trim() && !l.trim().startsWith('#'))
                .map(l => l.trim().split(/\s+/).map(n => n.trim()));
        }, 500);
        document.getElementById('blacklist').addEventListener('input', saveBlacklist);
        document.getElementById('whitelist').addEventListener('input', saveWhitelist);
        // Draw settings
        document.getElementById('drawMode').addEventListener('change', () => { state.settings.drawMode = document.getElementById('drawMode').value; this.updateProbabilityPanel(); });
        document.getElementById('genderBalance').addEventListener('change', () => { state.settings.genderBalance = document.getElementById('genderBalance').checked; });
        document.getElementById('antiCluster').addEventListener('change', () => { state.settings.antiCluster = document.getElementById('antiCluster').checked; });
        document.getElementById('maleMapping').addEventListener('change', () => { state.settings.maleMapping = document.getElementById('maleMapping').value; });
        document.getElementById('femaleMapping').addEventListener('change', () => { state.settings.femaleMapping = document.getElementById('femaleMapping').value; });
        // [FEATURE #22] Keyboard shortcuts extracted to bindKeyboardShortcuts
        this.bindKeyboardShortcuts();
        // Click empty to deselect
        document.addEventListener('click', e => {
            if (!e.target.closest('.seat,.platform-side-seat,.context-menu,.batch-toolbar,.student-info-popup')) this.clearSelection();
        });
        // Modal overlay click to close
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
        });
        // Perspective toggle
        document.getElementById('togglePerspective').addEventListener('click', () => this.togglePerspective());
        // Export dropdown menu
        document.getElementById('exportMenuBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const dd = document.getElementById('exportDropdown');
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        });
        document.addEventListener('click', () => { document.getElementById('exportDropdown').style.display = 'none'; document.getElementById('viewDropdown').style.display = 'none'; document.getElementById('recommendDropdown').style.display = 'none'; });
        // Screenshot preview
        document.getElementById('exportScreenshot').addEventListener('click', () => {
            document.getElementById('exportDropdown').style.display = 'none';
            this.showPreviewModal();
        });
        document.getElementById('closePreviewModal').addEventListener('click', () => document.getElementById('previewModal').classList.remove('active'));
        document.getElementById('generatePreview').addEventListener('click', () => this.generatePreview());
        document.getElementById('downloadPreview').addEventListener('click', () => this.downloadPreview());
        // Print
        document.getElementById('printSeats').addEventListener('click', () => {
            document.getElementById('exportDropdown').style.display = 'none';
            this.printSeats();
        });
        // [FEATURE] 家长会视图
        document.getElementById('exportParentView')?.addEventListener('click', () => {
            document.getElementById('exportDropdown').style.display = 'none';
            this.printParentView();
        });
        // Theme switching
        document.querySelectorAll('.theme-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => this.applyTheme(swatch.dataset.theme));
        });
        // Accent color
        document.querySelectorAll('.accent-dot').forEach(dot => {
            dot.addEventListener('click', () => this.applyAccentColor(dot.dataset.color));
        });
        // Smart recommendation dropdown
        document.getElementById('smartRecommend').addEventListener('click', (e) => {
            e.stopPropagation();
            const dd = document.getElementById('recommendDropdown');
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        });
        document.getElementById('smartRecommendAction').addEventListener('click', () => {
            document.getElementById('recommendDropdown').style.display = 'none';
            this.showRecommendations();
        });
        document.getElementById('customAlgoAction').addEventListener('click', () => {
            document.getElementById('recommendDropdown').style.display = 'none';
            document.getElementById('customAlgoModal').classList.add('active');
            this.renderCustomAlgoList();
        });
        document.getElementById('closeRecommendPanel').addEventListener('click', () => { this.clearRecommendHighlights(); document.getElementById('recommendPanel').classList.remove('visible'); });
        document.getElementById('closeRecommendBtn').addEventListener('click', () => { this.clearRecommendHighlights(); document.getElementById('recommendPanel').classList.remove('visible'); });
        document.getElementById('applyAllRecommend').addEventListener('click', () => this.applyAllRecommendations());
        // Algorithm explanation
        // algoExplain button removed — 运行逻辑 accessible from 操作指南 tab
        // document.getElementById('algoExplain').addEventListener('click', () => { CompositeEval.renderExplanation(); this.openHelpTab('algorithm'); });
        // (algoModal handlers removed — content moved to guide)
        // Subject management
        document.getElementById('addSubjectBtn').addEventListener('click', () => {
            const input = document.getElementById('newSubjectInput');
            const name = input.value.trim();
            if (!name) return;
            if (state.subjects.includes(name)) { Toast.warning('科目已存在'); return; }
            state.subjects.push(name);
            input.value = '';
            this.renderSubjectTabs();
            this.updateHeatmapSubjectSelect();
            Toast.success(`已添加科目: ${name}`);
        });
        // Input validation
        ['rows','cols'].forEach(id => {
            document.getElementById(id).addEventListener('input', e => {
                const v = parseInt(e.target.value);
                if (v && v >= 1 && v <= 20) { e.target.classList.remove('error'); document.getElementById('layoutError').classList.remove('visible'); }
            });
        });
        // Template download handlers
        const downloadFile = (filename, content, type) => {
            const blob = new Blob([content], { type });
            const link = document.createElement('a');
            link.download = filename;
            link.href = URL.createObjectURL(blob);
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        };
        document.getElementById('downloadTextTemplate')?.addEventListener('click', () => {
            const subjects = state.subjects.join(',');
            const tpl = `# 座位编排系统 - 学生名单模板
# 格式：姓名,性别,午休,${subjects},性格,爱好,职务
# 性别：${state.settings.maleMapping}/${state.settings.femaleMapping}  午休：1=是 0=否
# 性格：外向/内向/中性  爱好：用/分隔  职务：班长/副班长/学习委员/体育委员/文艺委员/劳动委员/小组长/课代表
# 可省略性格、爱好、职务列（逗号留空即可）
张三,${state.settings.maleMapping},1,85,92,78,88,76,90,82,85,88,外向,篮球/绘画,班长
李四,${state.settings.femaleMapping},0,92,88,95,90,85,88,92,90,95,内向,阅读/音乐,学习委员
王五,${state.settings.maleMapping},0,78,65,72,80,68,75,70,72,78,中性,篮球,体育委员
赵六,${state.settings.femaleMapping},1,88,91,85,82,90,86,88,85,82,外向,绘画/舞蹈,文艺委员
孙七,${state.settings.maleMapping},0,65,58,70,60,55,62,58,65,60,内向,阅读,`;
            downloadFile('学生名单模板.txt', tpl, 'text/plain;charset=utf-8');
            Toast.success('文本模板已下载');
        });
        document.getElementById('downloadExcelTemplate')?.addEventListener('click', () => {
            const subjects = state.subjects;
            const header = ['姓名', '性别', '午休', ...subjects, '性格', '爱好', '职务'];
            const rows = [
                ['张三', state.settings.maleMapping, 1, 85, 92, 78, 88, 76, 90, 82, 85, 88, '外向', '篮球/绘画', '班长'],
                ['李四', state.settings.femaleMapping, 0, 92, 88, 95, 90, 85, 88, 92, 90, 95, '内向', '阅读/音乐', '学习委员'],
                ['王五', state.settings.maleMapping, 0, 78, 65, 72, 80, 68, 75, 70, 72, 78, '中性', '篮球', '体育委员'],
                ['赵六', state.settings.femaleMapping, 1, 88, 91, 85, 82, 90, 86, 88, 85, 82, '外向', '绘画/舞蹈', '文艺委员'],
                ['孙七', state.settings.maleMapping, 0, 65, 58, 70, 60, 55, 62, 58, 65, 60, '内向', '阅读', ''],
            ];
            const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '学生名单');
            XLSX.writeFile(wb, '学生名单模板.xlsx');
            Toast.success('Excel 模板已下载');
        });
        document.getElementById('downloadBlacklistTemplate')?.addEventListener('click', () => {
            const tpl = `# 黑名单模板 - 同组学生会被尽量分开坐
# 每行一组，空格分隔学生姓名
张三 李四
王五 赵六`;
            downloadFile('黑名单模板.txt', tpl, 'text/plain;charset=utf-8');
            Toast.success('黑名单模板已下载');
        });
        document.getElementById('downloadWhitelistTemplate')?.addEventListener('click', () => {
            const tpl = `# 白名单模板 - 同组学生会被尽量安排坐在一起
# 每行一组，空格分隔学生姓名
小明 小红
小刚 小丽`;
            downloadFile('白名单模板.txt', tpl, 'text/plain;charset=utf-8');
            Toast.success('白名单模板已下载');
        });
        document.getElementById('downloadAiDocFromGuide')?.addEventListener('click', () => {
            const doc = generateAiDevDoc();
            downloadFile(`座位编排系统_AI插件开发文档_v${ModuleRegistry.systemVersion}.md`, doc, 'text/markdown;charset=utf-8');
            Toast.success('AI 开发文档已下载');
        });
        document.getElementById('downloadPluginTplFromGuide')?.addEventListener('click', () => {
            downloadFile('plugin-template.js', PluginManager.getBlankTemplate(), 'text/javascript;charset=utf-8');
            Toast.success('空白插件模板已下载');
        });
        // Custom algorithm modal
        document.getElementById('openCustomAlgo')?.addEventListener('click', () => {
            document.getElementById('customAlgoModal').classList.add('active');
            this.renderCustomAlgoList();
        });
        document.getElementById('closeCustomAlgo')?.addEventListener('click', () => document.getElementById('customAlgoModal').classList.remove('active'));
        document.getElementById('closeCustomAlgoBtn')?.addEventListener('click', () => document.getElementById('customAlgoModal').classList.remove('active'));
        document.getElementById('importCustomAlgo')?.addEventListener('click', () => document.getElementById('customAlgoFile').click());
        document.getElementById('customAlgoFile')?.addEventListener('change', e => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const code = ev.target.result;
                    const report = SecuritySandbox.scan(code);
                    if (report.riskLevel === 'critical') { Toast.error('算法安全检测未通过'); e.target.value = ''; return; }
                    const fn = new Function('AlgorithmRegistry', 'CompositeEval', 'state', code);
                    const registry = {
                        register: (algo) => {
                            if (!algo.name || !algo.peerInfluence) { Toast.error('算法缺少必要字段 (name, peerInfluence)'); return; }
                            if (!this._customAlgorithms) this._customAlgorithms = {};
                            this._customAlgorithms[algo.name] = algo;
                            this._customAlgorithm = algo;
                            Toast.success(`算法 "${algo.name}" 已导入并激活`);
                            addLog('🧬', `导入自定义算法: ${algo.name}`);
                            this.renderCustomAlgoList();
                        }
                    };
                    fn(registry, CompositeEval, state);
                } catch (err) { Toast.error('算法导入失败: ' + err.message); console.error(err); }
                finally { e.target.value = ''; }
            };
            reader.readAsText(file);
        });
        document.getElementById('resetToBuiltinAlgo')?.addEventListener('click', () => {
            this._customAlgorithm = null;
            Toast.success('已恢复内置推荐算法');
            this.renderCustomAlgoList();
        });
        document.getElementById('downloadAlgoTemplate')?.addEventListener('click', () => this._downloadAlgoTemplate());
        document.getElementById('downloadAlgoTemplateFromGuide')?.addEventListener('click', () => this._downloadAlgoTemplate());
        document.getElementById('downloadAiDevDocFromAiAlgo')?.addEventListener('click', () => {
            const doc = generateAiDevDoc();
            const blob = new Blob([doc], { type: 'text/markdown;charset=utf-8' });
            const link = document.createElement('a');
            link.download = `座位编排系统_AI开发文档_v${ModuleRegistry.systemVersion}.md`;
            link.href = URL.createObjectURL(blob); link.click();
            Toast.success('AI 开发文档已下载');
        });
        // [FEATURE #8] Ctrl+K Command Palette
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
                e.preventDefault();
                const overlay = document.getElementById('cmdPalette');
                overlay.classList.toggle('active');
                if (overlay.classList.contains('active')) {
                    const input = document.getElementById('cmdInput');
                    input.value = '';
                    input.focus();
                    this._renderCmdResults('');
                }
            }
        });
        document.getElementById('cmdPalette')?.addEventListener('click', e => {
            if (e.target === document.getElementById('cmdPalette')) document.getElementById('cmdPalette').classList.remove('active');
        });
        document.getElementById('cmdInput')?.addEventListener('input', e => this._renderCmdResults(e.target.value));
        document.getElementById('cmdInput')?.addEventListener('keydown', e => {
            const items = document.querySelectorAll('#cmdResults .cmd-item');
            const highlighted = document.querySelector('#cmdResults .cmd-item.highlighted');
            let idx = Array.from(items).indexOf(highlighted);
            if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('highlighted', i === idx)); items[idx]?.scrollIntoView({ block: 'nearest' }); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); items.forEach((it, i) => it.classList.toggle('highlighted', i === idx)); items[idx]?.scrollIntoView({ block: 'nearest' }); }
            else if (e.key === 'Enter') { e.preventDefault(); if (highlighted) highlighted.click(); else if (items[0]) items[0].click(); }
            else if (e.key === 'Escape') { document.getElementById('cmdPalette').classList.remove('active'); }
        });

        // [FEATURE #15] Touch mode toggle
        document.getElementById('touchModeBtn')?.addEventListener('click', () => {
            document.body.classList.toggle('touch-mode');
            const on = document.body.classList.contains('touch-mode');
            document.getElementById('touchModeBtn').textContent = on ? '🖐️ 标准模式' : '🖐️ 大屏模式';
            try { localStorage.setItem('seatTouchMode', on ? '1' : '0'); } catch(e) {}
            Toast.info(on ? '已开启大屏触控模式' : '已关闭大屏触控模式');
        });
        // Restore touch mode
        try { if (localStorage.getItem('seatTouchMode') === '1') document.body.classList.add('touch-mode'); } catch(e) {}
        // Touch mode sidebar overlay
        document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
            document.querySelector('.sidebar')?.classList.remove('open');
            document.getElementById('sidebarOverlay')?.classList.remove('visible');
        });

        // [FEATURE #11] More menu
        const moreMenuBtn = document.getElementById('moreMenuBtn');
        moreMenuBtn?.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault(); // [FIX] Prevent touch events from interfering
            const mm = document.getElementById('moreMenu');
            mm.classList.toggle('visible');
        });
        document.getElementById('mmReset')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); document.getElementById('resetDraw').click(); });
        document.getElementById('mmExport')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); document.getElementById('exportSeats').click(); });
        document.getElementById('mmStats')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); this.showStats(); });
        document.getElementById('mmPodium')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); this.togglePerspective(); });
        document.getElementById('mmHeatmap')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); document.getElementById('toggleHeatmap').click(); });
        document.getElementById('mmPrint')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); this.printSeats(); });
        document.getElementById('mmGuide')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); document.getElementById('helpBtn').click(); });
        document.getElementById('mmSettings')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); document.getElementById('globalSettingsBtn').click(); });
        document.getElementById('mmMonteCarlo')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); this.runMonteCarloSimulation(); });

        // [FEATURE #12] Side panel
        document.getElementById('closeSidePanel')?.addEventListener('click', () => document.getElementById('sidePanel').classList.remove('visible'));
        document.querySelectorAll('#sidePanelTabs .side-panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#sidePanelTabs .side-panel-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('#sidePanelBody .tab-content').forEach(t => t.classList.remove('active'));
                document.getElementById('sp-' + tab.dataset.sptab)?.classList.add('active');
            });
        });

        // [FEATURE #14] Mobile tab bar
        document.querySelectorAll('.mobile-tab-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation(); // [FIX] Prevent global click handler from closing menus
                document.querySelectorAll('.mobile-tab-item').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                switch (tab.dataset.mtab) {
                    case 'draw': document.getElementById('drawNext').click(); break;
                    case 'recommend': this.showRecommendations(); break;
                    case 'view': document.getElementById('viewDropdown').style.display = document.getElementById('viewDropdown').style.display === 'none' ? 'block' : 'none'; break;
                    case 'more': document.getElementById('moreMenu').classList.toggle('visible'); break;
                }
            });
        });

        // [FEATURE #19] Sync auto-draw interval inputs
        document.getElementById('autoDrawIntervalPlugin')?.addEventListener('input', e => {
            const val = e.target.value;
            const inline = document.getElementById('autoDrawIntervalInline');
            if (inline) inline.value = val;
        });

        // Close more menu on outside click
        document.addEventListener('click', e => {
            if (!e.target.closest('#moreMenu') && !e.target.closest('#moreMenuBtn') && !e.target.closest('[data-mtab="more"]')) {
                document.getElementById('moreMenu')?.classList.remove('visible');
            }
        });

        // Student detail modal
        document.getElementById('closeStudentDetail')?.addEventListener('click', () => document.getElementById('studentDetailModal').classList.remove('active'));
        document.getElementById('closeStudentDetailBtn')?.addEventListener('click', () => document.getElementById('studentDetailModal').classList.remove('active'));
    },

    // [FEATURE #22] Extracted keyboard shortcuts
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', e => {
            if (e.target.matches('input,textarea,select,[contenteditable]')) return;
            if (e.code === 'Space') { e.preventDefault(); document.getElementById('drawNext').click(); }
            if (e.code === 'Escape') {
                this.clearSelection();
                if (state.batchMode) this.exitBatchMode();
                document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
                document.getElementById('studentInfoPopup').style.display = 'none';
                if (state.selectedPoolStudent !== null) {
                    state.selectedPoolStudent = null;
                    document.querySelectorAll('.pool-item').forEach(pi => pi.classList.remove('pool-selected'));
                    document.querySelectorAll('.seat').forEach(s => s.classList.remove('pool-target'));
                    document.getElementById('poolClickHint')?.classList.remove('visible');
                }
            }
            if (e.ctrlKey && e.code === 'KeyS') { e.preventDefault(); saveConfig(); Toast.success('已保存'); }
            if (e.ctrlKey && e.code === 'KeyZ') { e.preventDefault(); UndoManager.undo(); }
            if (e.ctrlKey && e.code === 'KeyY') { e.preventDefault(); UndoManager.redo(); }
            if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey) { this.enterBatchMode(); Toast.info('批量模式：点击座位选择，然后批量操作'); }
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
                e.preventDefault();
                this.navigateSeats(e.code);
            }
            if (e.code.startsWith('Digit') && !e.ctrlKey && !e.metaKey) {
                const num = parseInt(e.code.replace('Digit', ''));
                if (num >= 1 && num <= 9) {
                    const targetSeat = state.seats.find(s => s.number === num && !s.disabled);
                    if (targetSeat) {
                        this.clearSelection();
                        state.selectedSeat = targetSeat;
                        targetSeat.element.classList.add('selected');
                        targetSeat.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
        });
    },

    // [FEATURE #8] Command palette rendering
    _renderCmdResults(query) {
        const container = document.getElementById('cmdResults');
        if (!container) return;
        const commands = [
            { icon: '🎲', label: '抽取下一个学生', hint: '空格键', action: () => document.getElementById('drawNext').click() },
            { icon: '⚡', label: '一键自动抽取', hint: '', action: () => document.getElementById('autoDraw').click() },
            { icon: '🧠', label: '智能推荐', hint: '', action: () => this.showRecommendations() },
            { icon: '🔄', label: '重置抽取', hint: '', action: () => document.getElementById('resetDraw').click() },
            { icon: '📊', label: '查看统计', hint: '', action: () => this.showStats() },
            { icon: '🔥', label: '切换热力图', hint: '', action: () => document.getElementById('toggleHeatmap').click() },
            { icon: '🎓', label: '切换讲台视角', hint: '', action: () => this.togglePerspective() },
            { icon: '📸', label: '截图导出', hint: '', action: () => this.showPreviewModal() },
            { icon: '📖', label: '操作指南', hint: '', action: () => document.getElementById('helpBtn').click() },
            { icon: '⚙️', label: '系统设置', hint: '', action: () => document.getElementById('globalSettingsBtn').click() },
            { icon: '🌙', label: '切换深色/浅色模式', hint: '', action: () => document.getElementById('themeToggle').click() },
            { icon: '🖐️', label: '切换大屏触控模式', hint: '', action: () => document.getElementById('touchModeBtn').click() },
        ];
        // Add student matches
        const q = (query || '').toLowerCase();
        if (q) {
            const matched = state.students.filter(s => matchStudent(s, q)).slice(0, 8);
            matched.forEach(s => {
                const isSeated = state.drawnStudents.some(d => d.id === s.id);
                const seat = isSeated ? [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === s.id) : null;
                commands.unshift({
                    icon: isSeated ? '🪑' : '⏳',
                    label: `${escapeHtml(s.name)} (${s.gender === 'male' ? '♂' : '♀'})`,
                    hint: isSeated && seat ? `座位 ${this.seatLabel(seat)}` : '待抽取',
                    action: () => { document.getElementById('cmdPalette').classList.remove('active'); if (isSeated && seat) this.showStudentInfo(seat); else this.showStudentDetailFromPool(s); }
                });
            });
        }
        // Filter commands by query
        const filtered = q ? commands.filter(c => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)) : commands;
        if (filtered.length === 0) { container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-tertiary);">无匹配结果</div>'; return; }
        container.innerHTML = filtered.map((c, i) => `<div class="cmd-item${i === 0 ? ' highlighted' : ''}" data-cmd-idx="${i}"><span class="cmd-item-icon">${c.icon}</span><span class="cmd-item-label">${c.label}</span><span class="cmd-item-hint">${c.hint}</span></div>`).join('');
        container.querySelectorAll('.cmd-item').forEach((item, i) => {
            item.addEventListener('click', () => { document.getElementById('cmdPalette').classList.remove('active'); filtered[i]?.action(); });
        });
    }
};

// ==================== System Plugins (Heatmap & SmartRecommend) ====================
const SystemPlugins = {
    registerAll() {
        // Heatmap System Plugin
        PluginManager.register('system-heatmap', {
            name: '🔥 成绩热力图', description: '多维度成绩可视化热力图', version: '2.0.0',
            defaultEnabled: true, hasSettings: false, defaultSettings: {},
            securityStatus: 'ok',
            init() { console.log('Heatmap plugin initialized'); },
            beforeDraw(availableStudents, probabilities, nextSeat) { return { availableStudents, probabilities }; },
            afterDraw(student, seat) {},
            beforeExport(data) { return data; }
        });

        // Smart Recommend System Plugin
        PluginManager.register('system-smart-recommend', {
            name: '🧠 智能座位推荐', description: '基于多维良性影响分析的智能座位推荐', version: '2.0.0',
            defaultEnabled: true, hasSettings: false, defaultSettings: {},
            securityStatus: 'ok',
            init() { console.log('Smart Recommend plugin initialized'); },
            beforeDraw(availableStudents, probabilities, nextSeat) { return { availableStudents, probabilities }; },
            afterDraw(student, seat) {},
            beforeExport(data) { return data; }
        });

        // Mark system plugins
        ['system-heatmap', 'system-smart-recommend'].forEach(id => {
            if (state.plugins[id]) {
                state.plugins[id].isSystem = true;
                state.plugins[id].securityStatus = 'ok';
            }
        });
    }
};

let currentEditingPlugin = null;

// ==================== Config Save ====================
function saveConfig() {
    try {
        const seatsData = state.seats.map(s => ({ number: s.number, row: s.row, col: s.col, disabled: s.disabled, student: s.student }));
        localStorage.setItem('seatArrangerConfig', JSON.stringify({
            rows: state.rows, cols: state.cols,
            platformLeft: { disabled: state.platformLeft.disabled, student: state.platformLeft.student },
            platformRight: { disabled: state.platformRight.disabled, student: state.platformRight.student },
            showDoors: state.showDoors, doorPosition: state.doorPosition, showPlatformLeft: state.showPlatformLeft, showPlatformRight: state.showPlatformRight,
            students: state.students, blacklist: state.blacklist, whitelist: state.whitelist,
            seats: seatsData,
            history: state.history, plugins: state.plugins, settings: state.settings
        }));
        const indicator = document.getElementById('savedIndicator');
        if (indicator) { indicator.style.opacity = '1'; setTimeout(() => { indicator.style.opacity = '0.5'; }, 2000); }
    } catch (err) {
        console.error('自动保存失败', err);
        if (err.name === 'QuotaExceededError' || err.code === 22) {
            Toast.error('本地存储已满，请清理缓存');
        }
    }
}

// Debounced auto-save
const debouncedSave = debounce(() => { saveConfig(); }, 1000);

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    window._startTime = Date.now();

    // Register core modules
    ModuleRegistry.register({ id: 'core-state', name: '状态管理', version: '6.0.0', type: 'core', description: '全局状态管理与数据持久化', init() {}, destroy() {} });
    ModuleRegistry.register({ id: 'core-algorithm', name: '抽取算法', version: '6.0.0', type: 'core', description: '概率计算与座位分配算法', init() {}, destroy() {} });
    ModuleRegistry.register({ id: 'core-eval', name: '综合评价引擎', version: '1.0.0', type: 'core', description: '多维度学生能力评估系统', init() {}, destroy() {} });
    ModuleRegistry.register({ id: 'core-security', name: '安全沙箱', version: '1.0.0', type: 'core', description: '插件安全检测与权限管理', init() {}, destroy() {} });
    ModuleRegistry.register({ id: 'panel-ui', name: '用户操作面板', version: '6.0.0', type: 'panel', description: '主界面渲染与交互处理', init() {}, destroy() {} });
    ModuleRegistry.register({ id: 'panel-management', name: '管理面板', version: '1.0.0', type: 'panel', description: '模块管理、健康监控、主题仓库', init() {}, destroy() {} });
    ModuleRegistry.register({ id: 'plugin-manager', name: '插件管理器', version: '1.0.0', type: 'core', description: '插件注册、安全检测、生命周期管理', init() {}, destroy() {} });
    ModuleRegistry.register({ id: 'theme-repo', name: '主题仓库', version: '1.0.0', type: 'panel', description: '多套视觉方案管理与切换', init() {}, destroy() {} });

    // Register system algorithm plugins
    ModuleRegistry.register({ id: 'algo-predictable', name: '公平可预测抽取', version: '1.0.0', type: 'algorithm', description: '基于概率权重的公平抽取，结果可预测', init() {}, destroy() {} });
    ModuleRegistry.register({ id: 'algo-unpredictable', name: '公平不可预测抽取', version: '1.0.0', type: 'algorithm', description: '在公平基础上加入随机扰动', init() {}, destroy() {} });

    // Register system feature plugins
    ModuleRegistry.register({ id: 'system-heatmap', name: '成绩热力图', version: '2.0.0', type: 'plugin', description: '多维度成绩可视化（综合评价/综合成绩/单科）', init() {}, destroy() {} });
    ModuleRegistry.register({ id: 'system-smart-recommend', name: '智能座位推荐', version: '2.0.0', type: 'plugin', description: '基于良性影响分析的智能座位互换推荐', init() {}, destroy() {} });

    // [FEATURE #26] Deferred non-critical init - only classroom render is critical at startup
    // Defer: module list, health monitor, theme repo, security report
    setTimeout(() => {
        ModuleRegistry.renderList();
        ThemeRepository.renderList();
        SecuritySandbox.renderReport();
    }, 0);
    setTimeout(() => { ModuleRegistry.renderHealth(); }, 100);

    // System panel event bindings
    document.getElementById('exportTheme')?.addEventListener('click', () => ThemeRepository.exportTheme());
    document.getElementById('importTheme')?.addEventListener('click', () => document.getElementById('themeFile').click());
    document.getElementById('themeFile')?.addEventListener('change', e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => ThemeRepository.importTheme(ev.target.result);
        reader.readAsText(file); e.target.value = '';
    });

    // Module OTA import
    document.getElementById('importModule')?.addEventListener('click', () => document.getElementById('moduleFile').click());
    document.getElementById('moduleFile')?.addEventListener('change', e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const code = ev.target.result;
            try {
                // Security scan before importing
                const report = SecuritySandbox.scan(code);
                if (report.riskLevel === 'critical') {
                    Toast.error('模块安全检测未通过：包含高危代码，已阻止导入');
                    addLog('🛡️', `模块安全拦截: ${file.name} (危险级别: ${report.riskLevel})`);
                    e.target.value = '';
                    return;
                }
                // Execute module code in sandbox
                const safeModuleRegistry = {
                    register: (mod) => {
                        if (!mod.id || !mod.name) { Toast.error('模块缺少必要字段 (id, name)'); return; }
                        ModuleRegistry.register(mod);
                        Toast.success(`模块 "${mod.name}" 已导入`);
                        addLog('📦', `导入系统模块: ${mod.name} v${mod.version || '1.0.0'}`);
                        ModuleRegistry.renderList();
                        ModuleRegistry.renderHealth();
                    },
                    hotSwap: (id, mod) => {
                        ModuleRegistry.hotSwap(id, mod);
                        Toast.success(`模块 "${mod.name || id}" 已热替换`);
                        ModuleRegistry.renderList();
                    }
                };
                const fn = new Function('ModuleRegistry', 'console', code);
                fn(safeModuleRegistry, console);
                if (report.riskLevel !== 'safe') {
                    Toast.warning(`模块已导入，但检测到潜在风险`);
                }
                SecuritySandbox.renderReport();
            } catch (err) {
                console.error('模块导入失败', err);
                Toast.error('模块导入失败: ' + err.message);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    // Health monitor refresh
    // [FEATURE #26] Health monitor refresh (deferred, then periodic)
    setTimeout(() => { ModuleRegistry.renderHealth(); }, 200);
    setInterval(() => { ModuleRegistry.renderHealth(); }, 10000);

    // [FEATURE #9] Guide "试一试" buttons
    document.getElementById('guideTryFillExample')?.addEventListener('click', () => {
        document.getElementById('helpModal').classList.remove('active');
        document.querySelector('.sidebar-tab[data-tab=students]')?.click();
        document.getElementById('fillExample')?.click();
    });
    const saved = localStorage.getItem('seatArrangerConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            if (config.rows) state.rows = config.rows;
            if (config.cols) state.cols = config.cols;
            if (config.showDoors !== undefined) state.showDoors = config.showDoors;
            if (config.doorPosition !== undefined) state.doorPosition = config.doorPosition;
            if (config.showPlatformLeft !== undefined) state.showPlatformLeft = config.showPlatformLeft;
            if (config.showPlatformRight !== undefined) state.showPlatformRight = config.showPlatformRight;
            if (config.platformLeft) { state.platformLeft.disabled = config.platformLeft.disabled; state.platformLeft.student = config.platformLeft.student; }
            if (config.platformRight) { state.platformRight.disabled = config.platformRight.disabled; state.platformRight.student = config.platformRight.student; }
            if (config.students) state.students = config.students;
            if (config.blacklist) state.blacklist = config.blacklist;
            if (config.whitelist) state.whitelist = config.whitelist;
            if (config.history) state.history = config.history;
            if (config.settings) state.settings = { ...state.settings, ...config.settings };
            if (config.plugins) {
                Object.entries(config.plugins).forEach(([name, plugin]) => {
                    state.plugins[name] = plugin;
                    if (plugin.init) try { plugin.init(); } catch(e) {}
                });
                PluginManager.renderPluginsList();
            }
            UI.applyGlobalSettings();
            UI.renderClassroom();
            // Restore theme and accent color
            if (config.settings?.theme) UI.applyTheme(config.settings.theme);
            if (config.settings?.accentColor) UI.applyAccentColor(config.settings.accentColor);
            if (config.seats) {
                config.seats.forEach((saved, i) => {
                    if (state.seats[i]) {
                        state.seats[i].disabled = saved.disabled;
                        state.seats[i].student = saved.student;
                        UI.updateSeatDisplay(state.seats[i]);
                    }
                });
                UI.checkAisles(); UI.generateDrawOrder();
            }
            state.drawnStudents = []; state.remainingStudents = []; state.currentDrawIndex = 0;
            [...state.seats, state.platformLeft, state.platformRight].forEach(s => { if (s.student) state.drawnStudents.push(s.student); });
            state.students.forEach(s => { if (!state.drawnStudents.some(d => d.id === s.id)) state.remainingStudents.push(s); });
            while (state.currentDrawIndex < state.drawOrder.length) {
                const s = state.drawOrder[state.currentDrawIndex];
                if (!s.student && !s.disabled) break;
                state.currentDrawIndex++;
            }
            UI.updateStats(); UI.updateProbabilityPanel(); UI.renderPool();
            document.getElementById('blacklist').value = state.blacklist.map(g => g.join(' ')).join('\n');
            document.getElementById('whitelist').value = state.whitelist.map(g => g.join(' ')).join('\n');
        } catch (e) { console.error('恢复配置失败', e); }
    }
    // [FIX] Auto-save with dirty flag detection - only saves when actual changes occur
    setInterval(() => { debouncedSave(); }, 5000);
    window.addEventListener('beforeunload', saveConfig);

    // [FEATURE #24] Throttled resize handler
    let _resizeTimer = null;
    window.addEventListener('resize', () => {
        if (_resizeTimer) return;
        _resizeTimer = setTimeout(() => {
            _resizeTimer = null;
            // Recalculate layout if needed
            if (state.heatmapVisible) UI.renderHeatmap();
        }, 150);
    });
});
