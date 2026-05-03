// ==================== Context Menus ====================
    function showContextMenu(e, seat) {
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
    if (UI._closeMenuFn) document.removeEventListener('click', UI._closeMenuFn);
    UI._closeMenuFn = () => { menu.style.display = 'none'; document.removeEventListener('click', UI._closeMenuFn); };
    setTimeout(() => document.addEventListener('click', UI._closeMenuFn), 0);
    },

    function showColumnContextMenu(e, col) {
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
    if (UI._closeMenuFn) document.removeEventListener('click', UI._closeMenuFn);
    UI._closeMenuFn = () => { menu.style.display = 'none'; document.removeEventListener('click', UI._closeMenuFn); };
    setTimeout(() => document.addEventListener('click', UI._closeMenuFn), 0);
    },

    function handleDrop(source, target) {
    const getSeat = d => {
        if (d.type === 'normal') return state.seats[d.index];
        if (d.type === 'platform-left') return state.platformLeft;
        if (d.type === 'platform-right') return state.platformRight;
        return state[d.type];
    };
    const src = getSeat(source), tgt = getSeat(target);
    if (src && tgt && src !== tgt && !tgt.disabled && src.student) {
        UI.doSwap(src, tgt);
    }
    },

    // ==================== Stats ====================
    function updateStats() {
    const el = id => document.getElementById(id);
    // Settings console stats
    if (el('stTotal')) el('stTotal').textContent = state.students.length;
    if (el('stDrawn')) el('stDrawn').textContent = state.drawnStudents.length;
    if (el('stRemaining')) el('stRemaining').textContent = state.remainingStudents.length;
    if (el('stLunch')) el('stLunch').textContent = state.drawnStudents.filter(s => s.lunch).length;
    if (el('stLayout')) el('stLayout').textContent = `${state.rows}×${state.cols}`;
    el('poolSubtitle').textContent = `${state.remainingStudents.length} 人待抽取`;
    UI.updateQuickInfo();
    },

    function updateProbabilityPanel() {
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

    // ==================== Events ====================
    function bindEvents() {
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
            case 'moveToPool': case 'clearSeat': UI.clearSeat(seat); break;
            case 'toggleLunch': UI.toggleLunch(seat); break;
            case 'disableSeat': UI.disableSeat(seat); break;
            case 'enableSeat': UI.enableSeat(seat); break;
            case 'togglePin': UI.togglePin(seat); break;
            case 'viewInfo': UI.showStudentInfo(seat); break;
        }
        menu.style.display = 'none';
    });
    // Context menu: column
    document.getElementById('columnContextMenu').addEventListener('click', e => {
        const action = e.target.dataset.action;
        if (!action) return;
        const col = parseInt(document.getElementById('columnContextMenu').dataset.col);
        if (action === 'disableColumn') UI.disableColumn(col);
        else if (action === 'enableColumn') UI.enableColumn(col);
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
        UI.applyDoorPosition();
        UI.renderClassroom();
        UI.resetDraw();
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
        UI.resetDraw();
        UI.checkStaleListEntries();
        addLog('📝', `文本导入 ${state.students.length} 名学生`);
        Toast.success(`导入 ${state.students.length} 名学生`);
    });
    // Clear students
    document.getElementById('clearStudents').addEventListener('click', () => {
        if (!confirm('确定清空所有学生名单？')) return;
        state.students = [];
        document.getElementById('studentsText').value = '';
        UI.resetDraw();
        Toast.success('学生名单已清空');
        addLog('🗑️', '清空学生名单');
    });
    // Excel import
    document.getElementById('importExcel').addEventListener('click', () => document.getElementById('excelFile').click());
    document.getElementById('excelFile').addEventListener('change', e => {
        const file = e.target.files[0]; if (!file) return;
        UI.setButtonLoading('importExcel', true);
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
                UI.resetDraw();
                UI.checkStaleListEntries();
                addLog('📂', `Excel导入 ${state.students.length} 名学生`);
                Toast.success(`导入 ${state.students.length} 名学生`);
            } catch (err) { Toast.error('导入失败'); console.error(err); }
            finally { UI.setButtonLoading('importExcel', false); e.target.value = ''; }
        };
        reader.readAsArrayBuffer(file);
    });
    // Student pool filter/search
    document.querySelectorAll('.pool-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pool-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.poolFilter = btn.dataset.filter;
            UI.renderPool();
        });
    });
    document.getElementById('poolSearch').addEventListener('input', debounce(e => {
        state.poolSearch = e.target.value.trim();
        UI.renderPool();
        UI.renderPoolSearchDropdown(e.target.value.trim());
    }, 200));
    document.getElementById('poolSearch').addEventListener('focus', e => {
        if (e.target.value.trim()) UI.renderPoolSearchDropdown(e.target.value.trim());
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.pool-search')) {
            document.getElementById('poolSearchDropdown')?.classList.remove('open');
        }
    });
    // Full student search
    document.getElementById('fullStudentSearch')?.addEventListener('input', debounce(e => {
        UI.performFullStudentSearch(e.target.value.trim(), UI._fullSearchFilter);
    }, 200));
    document.getElementById('fullStudentSearch')?.addEventListener('focus', e => {
        if (e.target.value.trim()) UI.performFullStudentSearch(e.target.value.trim(), UI._fullSearchFilter);
    });
    document.querySelectorAll('#fullSearchFilters .pool-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#fullSearchFilters .pool-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            UI._fullSearchFilter = btn.dataset.filter;
            const query = document.getElementById('fullStudentSearch')?.value?.trim() || '';
            UI.performFullStudentSearch(query, UI._fullSearchFilter);
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
        const seat = UI.doDrawNext();
        if (seat) Toast.success(`${state.drawnStudents[state.drawnStudents.length - 1].name} → ${UI.seatLabel(seat)}`);
    });
    document.getElementById('autoDraw').addEventListener('click', () => UI.startAutoDraw());
    document.getElementById('stopAutoDraw').addEventListener('click', () => UI.stopAutoDraw());
    document.getElementById('resetDraw').addEventListener('click', () => { if (confirm('确定重置抽取？')) UI.resetDraw(); });
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
            UI.renderHeatmap(); legend.style.display = 'flex';
            document.getElementById('toggleHeatmap').textContent = '🔥 关闭热力图';
            UI.updateHeatmapSubjectVisibility();
        } else {
            UI.clearHeatmap(); legend.style.display = 'none';
            document.getElementById('toggleHeatmap').textContent = '🔥 热力图';
        }
    });
    document.getElementById('closeHeatmap').addEventListener('click', () => { state.heatmapVisible = false; UI.clearHeatmap(); document.getElementById('heatmapLegend').style.display = 'none'; document.getElementById('toggleHeatmap').textContent = '🔥 热力图'; });
    // Heatmap type selector
    document.getElementById('heatmapTypeSelector').addEventListener('click', e => {
        const btn = e.target.closest('.heatmap-type-btn');
        if (!btn) return;
        document.querySelectorAll('.heatmap-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.heatmapType = btn.dataset.type;
        UI.updateHeatmapSubjectVisibility();
        UI.updateHeatmapLegendLabels();
        if (state.heatmapVisible) UI.renderHeatmap();
    });
    // Heatmap subject select
    document.getElementById('heatmapSubjectSelect').addEventListener('change', () => {
        if (state.heatmapType === 'subject') UI.updateHeatmapLegendLabels();
        if (state.heatmapVisible) UI.renderHeatmap();
    });
    // Stats
    document.getElementById('viewStats').addEventListener('click', () => { document.getElementById('viewDropdown').style.display = 'none'; UI.showStats(); });
    document.getElementById('closeStatsModal').addEventListener('click', () => document.getElementById('statsModal').classList.remove('active'));
    document.getElementById('closeStatsBtn').addEventListener('click', () => document.getElementById('statsModal').classList.remove('active'));
    // Batch mode
    document.getElementById('batchCancel').addEventListener('click', () => UI.exitBatchMode());
    document.getElementById('batchClear').addEventListener('click', () => {
        state.batchSeats.forEach(s => UI.clearSeat(s));
        UI.exitBatchMode();
    });
    document.getElementById('batchDisable').addEventListener('click', () => {
        state.batchSeats.forEach(s => UI.disableSeat(s));
        UI.exitBatchMode();
    });
    document.getElementById('batchLunch').addEventListener('click', () => {
        state.batchSeats.forEach(s => UI.toggleLunch(s));
        UI.exitBatchMode();
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
        XLSX.writeFile(wb, `座位表_${UI.getTimestamp()}.xlsx`);
        Toast.success(fullData ? '完整数据已导出' : '座位表已导出');
        addLog('📤', fullData ? '导出完整数据 Excel' : '导出座位表 Excel');
    });
    // Export screenshot - now uses preview modal (handled above)
    // document.getElementById('exportScreenshot') event is bound in the new preview section above
    // Settings modal
    document.getElementById('globalSettingsBtn').addEventListener('click', () => {
        UI.updateStats(); // Refresh stats when opening
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
        s.demoSpeed = parseInt(document.getElementById('demoSpeed')?.value) || 600;
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
        if (s.theme) UI.applyTheme(s.theme);
        if (s.accentColor) UI.applyAccentColor(s.accentColor);
        UI.applyGlobalSettings();
        state.seats.forEach(seat => UI.updateSeatDisplay(seat));
        UI.updateSeatDisplay(state.platformLeft); UI.updateSeatDisplay(state.platformRight);
        UI.updateProbabilityPanel();
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
            autoDrawInterval:800, theme:'', accentColor:'#007AFF', demoSpeed:600,
            quickInfoItems: { layout:true, total:true, drawn:true, remaining:true, male:true, female:true, lunch:true },
            weights: { academic: 60, personality: 15, hobby: 10, position: 10, gender: 5 }
        };
        UI.applyGlobalSettings(); UI.renderClassroom(); UI.resetDraw();
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
        link.download = `座位配置_${UI.getTimestamp()}.json`;
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
        UI.setButtonLoading('importConfig', true);
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const config = JSON.parse(ev.target.result);
                // [FIX] Safe restore with seat count validation
                if (config.rows) state.rows = clamp(config.rows, 1, 20);
                if (config.cols) state.cols = clamp(config.cols, 1, 20);
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
                        autoDrawInterval:800, theme:'', accentColor:'#007AFF', demoSpeed:600,
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
                UI.applyGlobalSettings();
                UI.renderClassroom();
                // Restore disabled/student - [FIX] validate seat count
                if (config.seats) {
                    const savedCount = config.seats.length;
                    const currentCount = state.seats.length;
                    if (savedCount !== currentCount) Toast.warning(`座位数不匹配(保存:${savedCount} 当前:${currentCount})，部分座位数据可能丢失`);
                    config.seats.forEach((saved, i) => {
                        if (state.seats[i]) {
                            state.seats[i].disabled = saved.disabled;
                            state.seats[i].student = saved.student;
                            UI.updateSeatDisplay(state.seats[i]);
                        }
                    });
                    UI.checkAisles(); UI.generateDrawOrder();
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
                UI.updateStats(); UI.updateProbabilityPanel(); UI.renderPool();
                addLog('📥', '导入配置包'); Toast.success('配置导入成功');
            } catch (err) { Toast.error('导入失败: ' + err.message); console.error(err); }
            finally { UI.setButtonLoading('importConfig', false); e.target.value = ''; }
        };
        reader.readAsText(file);
    });
    }
    // Export/Import log
    const exportLogBtn = document.getElementById('exportLog');
    if (exportLogBtn) exportLogBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state.history, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `历史日志_${UI.getTimestamp()}.json`;
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
            UI.setButtonLoading('importLog', true);
            const reader = new FileReader();
            reader.onload = ev => {
                try { state.history = JSON.parse(ev.target.result); Toast.success('历史日志导入成功'); }
                catch (err) { Toast.error('导入失败'); }
                finally { UI.setButtonLoading('importLog', false); e.target.value = ''; }
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
    document.getElementById('drawMode').addEventListener('change', () => { state.settings.drawMode = document.getElementById('drawMode').value; UI.updateProbabilityPanel(); });
    document.getElementById('genderBalance').addEventListener('change', () => { state.settings.genderBalance = document.getElementById('genderBalance').checked; });
    document.getElementById('antiCluster').addEventListener('change', () => { state.settings.antiCluster = document.getElementById('antiCluster').checked; });
    document.getElementById('maleMapping').addEventListener('change', () => { state.settings.maleMapping = document.getElementById('maleMapping').value; });
    document.getElementById('femaleMapping').addEventListener('change', () => { state.settings.femaleMapping = document.getElementById('femaleMapping').value; });
    // [FEATURE #22] Keyboard shortcuts extracted to bindKeyboardShortcuts
    UI.bindKeyboardShortcuts();
    // Click empty to deselect
    document.addEventListener('click', e => {
        if (!e.target.closest('.seat,.platform-side-seat,.context-menu,.batch-toolbar,.student-info-popup')) UI.clearSelection();
    });
    // Modal overlay click to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
    });
    // Perspective toggle
    document.getElementById('togglePerspective').addEventListener('click', () => UI.togglePerspective());
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
        UI.showPreviewModal();
    });
    document.getElementById('closePreviewModal').addEventListener('click', () => document.getElementById('previewModal').classList.remove('active'));
    document.getElementById('generatePreview').addEventListener('click', () => UI.generatePreview());
    document.getElementById('downloadPreview').addEventListener('click', () => UI.downloadPreview());
    // Print
    document.getElementById('printSeats').addEventListener('click', () => {
        document.getElementById('exportDropdown').style.display = 'none';
        UI.printSeats();
    });
    // [FEATURE] 家长会视图
    document.getElementById('exportParentView')?.addEventListener('click', () => {
        document.getElementById('exportDropdown').style.display = 'none';
        UI.printParentView();
    });
    // Theme switching
    document.querySelectorAll('.theme-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => UI.applyTheme(swatch.dataset.theme));
    });
    // Accent color
    document.querySelectorAll('.accent-dot').forEach(dot => {
        dot.addEventListener('click', () => UI.applyAccentColor(dot.dataset.color));
    });
    // Smart recommendation dropdown
    document.getElementById('smartRecommend').addEventListener('click', (e) => {
        e.stopPropagation();
        const dd = document.getElementById('recommendDropdown');
        dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('smartRecommendAction').addEventListener('click', () => {
        document.getElementById('recommendDropdown').style.display = 'none';
        UI.showRecommendations();
    });
    document.getElementById('customAlgoAction').addEventListener('click', () => {
        document.getElementById('recommendDropdown').style.display = 'none';
        document.getElementById('customAlgoModal').classList.add('active');
        UI.renderCustomAlgoList();
    });
    document.getElementById('closeRecommendPanel').addEventListener('click', () => { UI.clearRecommendHighlights(); document.getElementById('recommendPanel').classList.remove('visible'); });
    document.getElementById('closeRecommendBtn').addEventListener('click', () => { UI.clearRecommendHighlights(); document.getElementById('recommendPanel').classList.remove('visible'); });
    document.getElementById('applyAllRecommend').addEventListener('click', () => UI.applyAllRecommendations());
    // Algorithm explanation
    // algoExplain button removed — 运行逻辑 accessible from 操作指南 tab
    // document.getElementById('algoExplain').addEventListener('click', () => { CompositeEval.renderExplanation(); UI.openHelpTab('algorithm'); });
    // (algoModal handlers removed — content moved to guide)
    // Subject management
    document.getElementById('addSubjectBtn').addEventListener('click', () => {
        const input = document.getElementById('newSubjectInput');
        const name = input.value.trim();
        if (!name) return;
        if (state.subjects.includes(name)) { Toast.warning('科目已存在'); return; }
        state.subjects.push(name);
        input.value = '';
        UI.renderSubjectTabs();
        UI.updateHeatmapSubjectSelect();
        // Update textarea placeholder with new subject columns
        const ta = document.getElementById('studentsText');
        if (ta) {
            const subjects = state.subjects.join(',');
            ta.placeholder = `张三,男,1,${state.subjects.map(() => '85').join(',')},外向,篮球/绘画,班长\n李四,女,0,${state.subjects.map(() => '92').join(',')},内向,阅读,`;
        }
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
        UI.renderCustomAlgoList();
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
                        if (!UI._customAlgorithms) UI._customAlgorithms = {};
                        UI._customAlgorithms[algo.name] = algo;
                        UI._customAlgorithm = algo;
                        Toast.success(`算法 "${algo.name}" 已导入并激活`);
                        addLog('🧬', `导入自定义算法: ${algo.name}`);
                        UI.renderCustomAlgoList();
                    }
                };
                fn(registry, CompositeEval, state);
            } catch (err) { Toast.error('算法导入失败: ' + err.message); console.error(err); }
            finally { e.target.value = ''; }
        };
        reader.readAsText(file);
    });
    document.getElementById('resetToBuiltinAlgo')?.addEventListener('click', () => {
        UI._customAlgorithm = null;
        Toast.success('已恢复内置推荐算法');
        UI.renderCustomAlgoList();
    });
    document.getElementById('downloadAlgoTemplate')?.addEventListener('click', () => UI._downloadAlgoTemplate());
    document.getElementById('downloadAlgoTemplateFromGuide')?.addEventListener('click', () => UI._downloadAlgoTemplate());
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
                UI._renderCmdResults('');
            }
        }
    });
    document.getElementById('cmdPalette')?.addEventListener('click', e => {
        if (e.target === document.getElementById('cmdPalette')) document.getElementById('cmdPalette').classList.remove('active');
    });
    document.getElementById('cmdInput')?.addEventListener('input', e => UI._renderCmdResults(e.target.value));
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
    document.getElementById('mmStats')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); UI.showStats(); });
    document.getElementById('mmPodium')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); UI.togglePerspective(); });
    document.getElementById('mmHeatmap')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); document.getElementById('toggleHeatmap').click(); });
    document.getElementById('mmPrint')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); UI.printSeats(); });
    document.getElementById('mmGuide')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); document.getElementById('helpBtn').click(); });
    document.getElementById('mmSettings')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); document.getElementById('globalSettingsBtn').click(); });
    document.getElementById('mmMonteCarlo')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); UI.runMonteCarloSimulation(); });

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
                case 'recommend': UI.showRecommendations(); break;
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

    // ==================== Advanced Export/Import Events ====================
    document.getElementById('mmAdvExport')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); AdvExportImport.showExportModal(); });
    document.getElementById('mmAdvImport')?.addEventListener('click', () => { document.getElementById('moreMenu').classList.remove('visible'); AdvExportImport.triggerImport(); });
    document.getElementById('closeAdvExportModal')?.addEventListener('click', () => document.getElementById('advExportModal').classList.remove('active'));
    document.getElementById('cancelAdvExport')?.addEventListener('click', () => document.getElementById('advExportModal').classList.remove('active'));
    document.getElementById('confirmAdvExport')?.addEventListener('click', () => AdvExportImport.doExport());
    document.getElementById('advExportSelectAll')?.addEventListener('click', () => {
        document.querySelectorAll('#advExportGrid input[type="checkbox"]').forEach(cb => { cb.checked = true; cb.closest('.adv-export-item').classList.add('checked'); });
    });
    document.getElementById('advExportDeselectAll')?.addEventListener('click', () => {
        document.querySelectorAll('#advExportGrid input[type="checkbox"]').forEach(cb => { cb.checked = false; cb.closest('.adv-export-item').classList.remove('checked'); });
    });
    document.getElementById('closeAdvImportModal')?.addEventListener('click', () => document.getElementById('advImportModal').classList.remove('active'));
    document.getElementById('cancelAdvImport')?.addEventListener('click', () => document.getElementById('advImportModal').classList.remove('active'));
    document.getElementById('confirmAdvImport')?.addEventListener('click', () => AdvExportImport.doImport());

    // ==================== Import Display Option Events ====================
    document.getElementById('closeImportDisplayOption')?.addEventListener('click', () => {
        document.getElementById('importDisplayOptionModal').classList.remove('active');
    });
    document.getElementById('cancelImportDisplayOption')?.addEventListener('click', () => {
        document.getElementById('importDisplayOptionModal').classList.remove('active');
    });
    document.getElementById('confirmImportDisplayOption')?.addEventListener('click', () => {
        const modal = document.getElementById('importDisplayOptionModal');
        const selectedOption = modal.querySelector('input[name="importDisplayOption"]:checked')?.value || 'display';
        modal.classList.remove('active');

        if (selectedOption === 'display') {
            // Display mode: seats are already shown, just toast
            Toast.success(`已导入并展示座位数据`);
            addLog('📥', '高级导入: 座位数据已展示');
        } else {
            // Hide mode: clear displayed seats, build pending draw sequence
            const seq = [];
            // Platform seats
            if (state.platformRight.student && !state.platformRight.disabled) {
                seq.push({ type: 'platform-right', seat: state.platformRight, student: JSON.parse(JSON.stringify(state.platformRight.student)) });
            }
            if (state.platformLeft.student && !state.platformLeft.disabled) {
                seq.push({ type: 'platform-left', seat: state.platformLeft, student: JSON.parse(JSON.stringify(state.platformLeft.student)) });
            }
            // Normal seats sorted by number
            const occupiedSeats = state.seats.filter(s => s.student && !s.disabled).sort((a, b) => a.number - b.number);
            occupiedSeats.forEach(s => seq.push({ type: 'normal', seat: s, student: JSON.parse(JSON.stringify(s.student)) }));

            // Clear all seat assignments
            state.seats.forEach(s => { s.student = null; UI.updateSeatDisplay(s); });
            state.platformLeft.student = null; UI.updateSeatDisplay(state.platformLeft);
            state.platformRight.student = null; UI.updateSeatDisplay(state.platformRight);

            // Reset draw state
            state.drawnStudents = [];
            state.remainingStudents = [...state.students];
            state.currentDrawIndex = 0;

            // Set pending draw sequence
            state.pendingDrawSequence = seq;

            UI.updateStats(); UI.updateProbabilityPanel(); UI.updateEmptyState(); UI.renderPool();

            Toast.info(`已准备 ${seq.length} 个座位，点击「抽取下一个」或「一键自动抽取」开始演示`);
            addLog('📥', '高级导入: 座位数据已加载为抽取序列');
        }
    });

    // ==================== Demo Mode Events ====================
    document.getElementById('mmDemo')?.addEventListener('click', () => {
        document.getElementById('moreMenu').classList.remove('visible');
        if (DemoMode._running) { DemoMode.stop(); }
        else { DemoMode.start(); }
    });
    document.getElementById('demoPauseBtn')?.addEventListener('click', () => DemoMode.togglePause());
    document.getElementById('demoStopBtn')?.addEventListener('click', () => DemoMode.stop());

    // Demo speed slider
    const demoSpeedInput = document.getElementById('demoSpeed');
    const demoSpeedVal = document.getElementById('demoSpeedVal');
    if (demoSpeedInput) {
        demoSpeedInput.addEventListener('input', () => {
            const val = parseInt(demoSpeedInput.value);
            state.settings.demoSpeed = val;
            if (demoSpeedVal) demoSpeedVal.textContent = val;
        });
    }
    },

    // [FEATURE #22] Extracted keyboard shortcuts
    function bindKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        if (e.target.matches('input,textarea,select,[contenteditable]')) return;
        if (e.code === 'Space') { e.preventDefault(); document.getElementById('drawNext').click(); }
        if (e.code === 'Escape') {
            UI.clearSelection();
            if (state.batchMode) UI.exitBatchMode();
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
        if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey) { UI.enterBatchMode(); Toast.info('批量模式：点击座位选择，然后批量操作'); }
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
            e.preventDefault();
            UI.navigateSeats(e.code);
        }
        if (e.code.startsWith('Digit') && !e.ctrlKey && !e.metaKey) {
            const num = parseInt(e.code.replace('Digit', ''));
            if (num >= 1 && num <= 9) {
                const targetSeat = state.seats.find(s => s.number === num && !s.disabled);
                if (targetSeat) {
                    UI.clearSelection();
                    state.selectedSeat = targetSeat;
                    targetSeat.element.classList.add('selected');
                    targetSeat.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    });
    },

    // [FEATURE #8] Command palette rendering
    function _renderCmdResults(query) {
    const container = document.getElementById('cmdResults');
    if (!container) return;
    const commands = [
        { icon: '🎲', label: '抽取下一个学生', hint: '空格键', action: () => document.getElementById('drawNext').click() },
        { icon: '⚡', label: '一键自动抽取', hint: '', action: () => document.getElementById('autoDraw').click() },
        { icon: '🧠', label: '智能推荐', hint: '', action: () => UI.showRecommendations() },
        { icon: '🔄', label: '重置抽取', hint: '', action: () => document.getElementById('resetDraw').click() },
        { icon: '📊', label: '查看统计', hint: '', action: () => UI.showStats() },
        { icon: '🔥', label: '切换热力图', hint: '', action: () => document.getElementById('toggleHeatmap').click() },
        { icon: '🎓', label: '切换讲台视角', hint: '', action: () => UI.togglePerspective() },
        { icon: '📸', label: '截图导出', hint: '', action: () => UI.showPreviewModal() },
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
                hint: isSeated && seat ? `座位 ${UI.seatLabel(seat)}` : '待抽取',
                action: () => { document.getElementById('cmdPalette').classList.remove('active'); if (isSeated && seat) UI.showStudentInfo(seat); else UI.showStudentDetailFromPool(s); }
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
