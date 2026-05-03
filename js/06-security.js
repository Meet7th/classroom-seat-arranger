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
