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
