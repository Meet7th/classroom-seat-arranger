// ==================== [FEATURE] Monte Carlo Simulation v2 ====================

    async function runMonteCarloSimulation(numSimulations, options = {}) {
        // Show config panel if no explicit count
        if (!numSimulations) {
            const config = await UI._showSimConfig();
            if (!config) return;
            numSimulations = config.count;
            options = config;
        }

        const totalSims = numSimulations;
        const seed = options.seed || Math.floor(Math.random() * 1000000);
        const includePlatform = options.includePlatform !== false;

        // Create progress panel
        UI._simCancelled = false;
        UI._createProgressPanel();

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
            UI._simWorker = UI._createSimWorker();
        } catch (err) {
            Toast.error('无法创建模拟 Worker: ' + err.message);
            if (UI._simProgressPanel) { UI._simProgressPanel.remove(); UI._simProgressPanel = null; }
            return;
        }

        const worker = UI._simWorker;
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
                    UI._updateProgress(completed, totalSims, startTime);
                    UI._updateAlerts(mergedPairFreq, completed);

                    // Send next chunk or finish
                    chunkIdx++;
                    if (chunkIdx < chunks.length && !UI._simCancelled) {
                        const chunk = chunks[chunkIdx];
                        worker.postMessage({ type: 'run', startIdx: chunk.startIdx, count: chunk.count, seed: seed });
                    } else {
                        // Done
                        worker.terminate();
                        UI._simWorker = null;
                        UI._onSimulationComplete(mergedSeatFreq, mergedPairFreq, completed, startTime, resolve);
                    }
                } else if (msg.type === 'cancelled') {
                    completed += msg.processed;
                    worker.terminate();
                    UI._simWorker = null;
                    Toast.info(`模拟已取消，已完成 ${completed} 次`);
                    if (completed > 0) {
                        UI._onSimulationComplete(mergedSeatFreq, mergedPairFreq, completed, startTime, resolve);
                    } else {
                        if (UI._simProgressPanel) { UI._simProgressPanel.remove(); UI._simProgressPanel = null; }
                        resolve(null);
                    }
                } else if (msg.type === 'error') {
                    worker.terminate();
                    UI._simWorker = null;
                    Toast.error('模拟 Worker 错误: ' + msg.message);
                    if (UI._simProgressPanel) { UI._simProgressPanel.remove(); UI._simProgressPanel = null; }
                    resolve(null);
                }
            };

            worker.onerror = (err) => {
                worker.terminate();
                UI._simWorker = null;
                Toast.error('模拟 Worker 崩溃: ' + (err.message || '未知错误'));
                if (completed > 0) {
                    Toast.warning('已保留部分结果 (' + completed + ' 次)');
                    UI._onSimulationComplete(mergedSeatFreq, mergedPairFreq, completed, startTime, resolve);
                } else {
                    if (UI._simProgressPanel) { UI._simProgressPanel.remove(); UI._simProgressPanel = null; }
                    resolve(null);
                }
            };

            // Init and start first chunk
            worker.postMessage({ type: 'init', state: serializedState });
            const firstChunk = chunks[0];
            worker.postMessage({ type: 'run', startIdx: firstChunk.startIdx, count: firstChunk.count, seed: seed });
        });
    },

    // --- Simulation Worker (inline Blob URL) ---
    function _createSimWorker() {
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

    function _createProgressPanel() {
    // Remove existing panel if any
    if (UI._simProgressPanel) { UI._simProgressPanel.remove(); UI._simProgressPanel = null; }

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
    UI._simProgressPanel = panel;

    // Make draggable
    makeDraggable(panel);

    // Close button
    panel.querySelector('#sppClose').addEventListener('click', () => {
        if (UI._simWorker) { UI._simCancelled = true; UI._simWorker.postMessage({ type: 'cancel' }); }
        panel.remove();
        UI._simProgressPanel = null;
    });
    panel.querySelector('#sppCancel').addEventListener('click', () => {
        UI._simCancelled = true;
        if (UI._simWorker) UI._simWorker.postMessage({ type: 'cancel' });
        document.getElementById('sppCancel').textContent = '⏹ 正在取消...';
        document.getElementById('sppCancel').disabled = true;
    });

    return panel;
    },

    function _updateProgress(completed, total, startTime) {
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

    function _updateAlerts(pairFreq, numSim) {
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
    function _showSimConfig() {
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
        const config = await UI._showSimConfig();
        if (!config) return;
        numSimulations = config.count;
        options = config;
    }

    const totalSims = numSimulations;
    const seed = options.seed || Math.floor(Math.random() * 1000000);
    const includePlatform = options.includePlatform !== false;

    // Create progress panel
    UI._simCancelled = false;
    UI._createProgressPanel();

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
        UI._simWorker = UI._createSimWorker();
    } catch (err) {
        Toast.error('无法创建模拟 Worker: ' + err.message);
        if (UI._simProgressPanel) { UI._simProgressPanel.remove(); UI._simProgressPanel = null; }
        return;
    }

    const worker = UI._simWorker;
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
                UI._updateProgress(completed, totalSims, startTime);
                UI._updateAlerts(mergedPairFreq, completed);

                // Send next chunk or finish
                chunkIdx++;
                if (chunkIdx < chunks.length && !UI._simCancelled) {
                    const chunk = chunks[chunkIdx];
                    worker.postMessage({ type: 'run', startIdx: chunk.startIdx, count: chunk.count, seed: seed });
                } else {
                    // Done
                    worker.terminate();
                    UI._simWorker = null;
                    UI._onSimulationComplete(mergedSeatFreq, mergedPairFreq, completed, startTime, resolve);
                }
            } else if (msg.type === 'cancelled') {
                completed += msg.processed;
                worker.terminate();
                UI._simWorker = null;
                Toast.info(`模拟已取消，已完成 ${completed} 次`);
                if (completed > 0) {
                    UI._onSimulationComplete(mergedSeatFreq, mergedPairFreq, completed, startTime, resolve);
                } else {
                    if (UI._simProgressPanel) { UI._simProgressPanel.remove(); UI._simProgressPanel = null; }
                    resolve(null);
                }
            } else if (msg.type === 'error') {
                worker.terminate();
                UI._simWorker = null;
                Toast.error('模拟 Worker 错误: ' + msg.message);
                if (UI._simProgressPanel) { UI._simProgressPanel.remove(); UI._simProgressPanel = null; }
                resolve(null);
            }
        };

        worker.onerror = (err) => {
            worker.terminate();
            UI._simWorker = null;
            Toast.error('模拟 Worker 崩溃: ' + (err.message || '未知错误'));
            if (completed > 0) {
                Toast.warning('已保留部分结果 (' + completed + ' 次)');
                UI._onSimulationComplete(mergedSeatFreq, mergedPairFreq, completed, startTime, resolve);
            } else {
                if (UI._simProgressPanel) { UI._simProgressPanel.remove(); UI._simProgressPanel = null; }
                resolve(null);
            }
        };

        // Init and start first chunk
        worker.postMessage({ type: 'init', state: serializedState });
        const firstChunk = chunks[0];
        worker.postMessage({ type: 'run', startIdx: firstChunk.startIdx, count: firstChunk.count, seed: seed });
    });
    },

    function _onSimulationComplete(seatFreq, pairFreq, numSim, startTime, resolve) {
    // Close progress panel
    if (UI._simProgressPanel) {
        const cancelBtn = document.getElementById('sppCancel');
        if (cancelBtn) { cancelBtn.textContent = '✅ 完成'; cancelBtn.disabled = true; }
        setTimeout(() => {
            if (UI._simProgressPanel) { UI._simProgressPanel.remove(); UI._simProgressPanel = null; }
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
    const gini = maxPctValues.length > 0 ? UI._calcGini(maxPctValues) : 0;

    // Generate suggestions
    const suggestions = UI._generateSuggestions(allPairs, numSim);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Show dashboard
    UI._showMonteCarloDashboard(seatFreq, seatEntropy, allPairs, numSim, elapsed, gini, suggestions);
    Toast.success(`预演完成！${numSim} 次模拟，耗时 ${elapsed}s`);
    resolve && resolve({ seatFreq, pairFreq: allPairs, numSim, seatEntropy, gini, suggestions });
    },

    function _calcGini(values) {
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

    function _generateSuggestions(pairs, numSim) {
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
    function _showMonteCarloDashboard(seatFreq, seatEntropy, allPairs, numSim, elapsed, gini, suggestions) {
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
            <div class="mc-tab-content" id="mcTabHeatmap">${UI._buildHeatmapTab(seatFreq, seatEntropy, numSim)}</div>
            <div class="mc-tab-content" id="mcTabMatrix" style="display:none;">${UI._buildMatrixTab(seatFreq, numSim)}</div>
            <div class="mc-tab-content" id="mcTabPairs" style="display:none;">${UI._buildPairsTab(allPairs, numSim)}</div>
            <div class="mc-tab-content" id="mcTabSuggest" style="display:none;">${UI._buildSuggestTab(suggestions)}</div>
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

    function _buildHeatmapTab(seatFreq, seatEntropy, numSim) {
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

            html += `<div class="mc-heatmap-cell" style="background:${bgColor};color:white;" title="座位${seat.number}\n熵值: ${entropy.toFixed(2)}\n${topStudent ? escapeHtml(topStudent.name) + ' ' + topPct + '%' : '无数据'}">
                <div class="mc-hc-num">${seat.number}</div>
                <div class="mc-hc-name">${topStudent ? escapeHtml(topStudent.name) : '-'}</div>
                <div class="mc-hc-pct">${topPct}%</div>
            </div>`;
        }
    }
    html += '</div></div>';
    return html;
    },

    function _buildMatrixTab(seatFreq, numSim) {
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
            html += `<td class="mc-matrix-cell" style="background:${bg};" title="${escapeHtml(student.name)} → ${seat.number}号: ${(pct * 100).toFixed(1)}%">${pct > 0.01 ? (pct * 100).toFixed(0) + '%' : ''}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    if (state.students.length > 30) html += `<div class="form-hint" style="margin-top:8px;">显示前 30 名学生 / ${state.students.length} 人</div>`;
    if (state.seats.filter(s => !s.disabled).length > 20) html += `<div class="form-hint">显示前 20 个座位 / ${state.seats.filter(s => !s.disabled).length} 个</div>`;
    html += '</div>';
    return html;
    },

    function _buildPairsTab(allPairs, numSim) {
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

    function _buildSuggestTab(suggestions) {
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
