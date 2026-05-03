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
        const subtitle = document.getElementById('moduleSubtitle');
        if (subtitle) subtitle.textContent = `系统模块 v${this.systemVersion} · ${mods.length} 个模块`;
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
