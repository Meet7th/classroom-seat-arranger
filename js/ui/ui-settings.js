// ==================== Theme Switching ====================
    function applyTheme(themeName) {
    document.body.classList.remove('theme-ocean', 'theme-forest', 'theme-sunset');
    if (themeName) document.body.classList.add(themeName);
    document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === themeName));
    state.settings.theme = themeName;
    },
    function applyAccentColor(color) {
    document.documentElement.style.setProperty('--primary', color);
    document.querySelectorAll('.accent-dot').forEach(d => d.classList.toggle('active', d.dataset.color === color));
    state.settings.accentColor = color;
    },

    // ==================== Quick Info Bar ====================
    function updateQuickInfo() {
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
    UI.applyQuickInfoVisibility();
    },

    function applyQuickInfoVisibility() {
    const vis = state.settings.quickInfoItems || {};
    const defaults = { layout:true, total:true, drawn:true, remaining:true, male:true, female:true, lunch:true };
    document.querySelectorAll('#quickInfo .qi-item').forEach(el => {
        const key = el.dataset.qi;
        if (key && vis[key] === false) el.classList.add('hidden');
        else if (key) el.classList.remove('hidden');
    });
    },

    // ==================== Subject Management ====================
    function renderSubjectTabs() {
    const container = document.getElementById('subjectTabs');
    container.innerHTML = state.subjects.map(s =>
        `<span class="subject-tab" data-subject="${s}">${s} <span style="cursor:pointer;opacity:0.5;" data-remove="${s}">×</span></span>`
    ).join('');
    container.querySelectorAll('.subject-tab').forEach(tab => {
        tab.querySelector('[data-remove]')?.addEventListener('click', e => {
            e.stopPropagation();
            const subj = e.target.dataset.remove;
            state.subjects = state.subjects.filter(s => s !== subj);
            UI.renderSubjectTabs();
            UI.updateHeatmapSubjectSelect();
        });
    });
    },
    function updateHeatmapSubjectSelect() {
    const sel = document.getElementById('heatmapSubjectSelect');
    sel.innerHTML = state.subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    },
    function updateHeatmapSubjectVisibility() {
    document.getElementById('heatmapSubjectWrap').style.display = state.heatmapType === 'subject' ? 'inline' : 'none';
    },
    function updateHeatmapLegendLabels() {
    const lowSpan = document.getElementById('heatmapLowLabel');
    const highSpan = document.getElementById('heatmapHighLabel');
    if (!lowSpan || !highSpan) return;
    if (state.heatmapType === 'subject') {
        const subj = document.getElementById('heatmapSubjectSelect')?.value || '单科';
        lowSpan.textContent = `${subj} 低分`;
        highSpan.textContent = `${subj} 高分`;
    } else if (state.heatmapType === 'average') {
        lowSpan.textContent = '均分低';
        highSpan.textContent = '均分高';
    } else {
        lowSpan.textContent = '低分';
        highSpan.textContent = '高分';
    }
    },

    // ==================== Stale Blacklist/Whitelist Detection ====================
    function checkStaleListEntries() {
    const studentNames = new Set(state.students.map(s => s.name));
    const staleBlacklist = [];
    const staleWhitelist = [];
    state.blacklist.forEach((group, i) => {
        const stale = group.map(n => n.replace(/^\*/, '').replace(/^[（(]/, '').replace(/[）)]$/, '')).filter(n => !studentNames.has(n));
        if (stale.length > 0) staleBlacklist.push({ group: group.join(' '), missing: stale });
    });
    state.whitelist.forEach((group, i) => {
        const stale = group.map(n => n.replace(/^\*/, '').replace(/^[（(]/, '').replace(/[）)]$/, '')).filter(n => !studentNames.has(n));
        if (stale.length > 0) staleWhitelist.push({ group: group.join(' '), missing: stale });
    });
    if (staleBlacklist.length > 0 || staleWhitelist.length > 0) {
        let msg = '检测到名单变更，以下黑白名单中包含不在当前学生名单中的成员：\n';
        if (staleBlacklist.length > 0) {
            msg += '\n🚫 黑名单：';
            staleBlacklist.forEach(s => msg += `\n  · ${s.group}（缺少：${s.missing.join('、')}）`);
        }
        if (staleWhitelist.length > 0) {
            msg += '\n✅ 白名单：';
            staleWhitelist.forEach(s => msg += `\n  · ${s.group}（缺少：${s.missing.join('、')}）`);
        }
        msg += '\n\n是否自动移除这些无效条目？';
        if (confirm(msg)) {
            if (staleBlacklist.length > 0) {
                state.blacklist = state.blacklist.filter(group => {
                    const names = group.map(n => n.replace(/^\*/, '').replace(/^[（(]/, '').replace(/[）)]$/, ''));
                    return names.every(n => studentNames.has(n));
                });
                document.getElementById('blacklist').value = state.blacklist.map(g => g.join(' ')).join('\n');
            }
            if (staleWhitelist.length > 0) {
                state.whitelist = state.whitelist.filter(group => {
                    const names = group.map(n => n.replace(/^\*/, '').replace(/^[（(]/, '').replace(/[）)]$/, ''));
                    return names.every(n => studentNames.has(n));
                });
                document.getElementById('whitelist').value = state.whitelist.map(g => g.join(' ')).join('\n');
            }
            Toast.success('已清理无效黑白名单条目');
        } else {
            Toast.warning('请手动检查黑白名单');
        }
    }
    },

    // ==================== Apply Settings ====================
    function applyGlobalSettings() {
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
    UI.applyQuickInfoVisibility();
    // Sync demo speed slider
    const demoSpeedInput = document.getElementById('demoSpeed');
    const demoSpeedVal = document.getElementById('demoSpeedVal');
    if (demoSpeedInput) demoSpeedInput.value = s.demoSpeed || 600;
    if (demoSpeedVal) demoSpeedVal.textContent = s.demoSpeed || 600;
    },

    function setButtonLoading(id, loading) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (loading) { btn.dataset.origText = btn.innerHTML; btn.innerHTML = '<span class="loading-spinner"></span>'; btn.disabled = true; }
    else { btn.innerHTML = btn.dataset.origText || btn.innerHTML; btn.disabled = false; }
    },
