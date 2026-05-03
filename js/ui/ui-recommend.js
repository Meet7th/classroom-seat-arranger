// ==================== Smart Seat Recommendation (Multi-dimensional) ====================
    _recommendations: [],
    _customAlgorithms: {},
    _customAlgorithm: null,
    function generateRecommendations() {
    UI._recommendations = [];
    const allSeats = [...state.seats, state.platformLeft, state.platformRight].filter(s => s.student);
    if (allSeats.length < 2) { Toast.warning('需要至少2名已安排的学生'); return; }

    // Calculate current total peer influence score
    const currentScore = UI.calcTotalInfluence(allSeats);

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
            const newScore = UI.calcTotalInfluence(allSeats);
            const improvement = newScore - currentScore;
            // Undo swap
            s2.student = s1.student; s1.student = temp;

            if (improvement > 0) {
                const reasons = [];
                // Generate reasons using explainPairing without redundant simulation
                const orig1 = s1.student, orig2 = s2.student;
                const neighbors1 = UI.getNeighbors(s1).filter(n => n.student && n.student.id !== orig1.id && n.student.id !== orig2.id);
                const neighbors2 = UI.getNeighbors(s2).filter(n => n.student && n.student.id !== orig1.id && n.student.id !== orig2.id);
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

                // Add relationship-based reasons
                const relScore = RelationshipManager.getScore(orig1.name, orig2.name);
                if (relScore > 0) {
                    const rel = RelationshipManager.getRelation(orig1.name, orig2.name);
                    const t = RELATIONSHIP_TYPES.find(x => x.id === rel?.type);
                    reasons.push(`关系网：${orig1.name} 与 ${orig2.name} ${t ? t.icon + t.label : '有正向关系'}(+${relScore}分)，分开后可各自与周围同学建立更好联系`);
                } else if (relScore < 0) {
                    const rel = RelationshipManager.getRelation(orig1.name, orig2.name);
                    const t = RELATIONSHIP_TYPES.find(x => x.id === rel?.type);
                    reasons.push(`关系网：${orig1.name} 与 ${orig2.name} ${t ? t.icon + t.label : '有负向关系'}(${relScore}分)，互换座位可减少互相干扰`);
                }
                // Check neighbor relationships after swap
                const afterSwapNeighbors1 = UI.getNeighbors(s1).filter(n => n.student && n.student.id !== orig1.id && n.student.id !== orig2.id);
                const afterSwapNeighbors2 = UI.getNeighbors(s2).filter(n => n.student && n.student.id !== orig1.id && n.student.id !== orig2.id);
                afterSwapNeighbors1.forEach(n => {
                    const rs = RelationshipManager.getScore(orig2.name, n.student.name);
                    if (rs > 20) reasons.push(`关系网：${orig2.name} 与邻座 ${n.student.name} 有正向关系(+${rs}分)`);
                    else if (rs < -20) reasons.push(`关系网：${orig2.name} 与邻座 ${n.student.name} 有负向关系(${rs}分)，但整体影响仍为正`);
                });
                afterSwapNeighbors2.forEach(n => {
                    const rs = RelationshipManager.getScore(orig1.name, n.student.name);
                    if (rs > 20) reasons.push(`关系网：${orig1.name} 与邻座 ${n.student.name} 有正向关系(+${rs}分)`);
                    else if (rs < -20) reasons.push(`关系网：${orig1.name} 与邻座 ${n.student.name} 有负向关系(${rs}分)，但整体影响仍为正`);
                });

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
    UI._recommendations = candidates.slice(0, 5);

    // [FEATURE] 学霸帮扶链自动推荐
    UI._tutoringChains = UI.buildTutoringChain();
    },

    /**
     * [FEATURE] 学霸帮扶链 - 识别成绩前20%和后20%的学生，推荐同列相邻配对
     */
    function buildTutoringChain() {
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
    function calcTotalInfluence(seats) {
    // Use custom algorithm if available, otherwise use enhanced built-in
    if (UI._customAlgorithm && typeof UI._customAlgorithm.peerInfluence === 'function') {
        return UI._calcWithCustomAlgo(seats);
    }
    let total = 0;
    const checked = new Set();
    seats.forEach(s => {
        if (!s.student) return;
        UI.getNeighbors(s).forEach(n => {
            if (!n.student) return;
            const key = [Math.min(s.student.id, n.student.id), Math.max(s.student.id, n.student.id)].join('-');
            if (checked.has(key)) return;
            checked.add(key);
            total += UI.enhancedPeerInfluence(s.student, n.student, s, n);
        });
    });
    // Add row-level balance bonus
    total += UI.calcRowBalance(seats);
    // Add lunch clustering penalty
    total += UI.calcLunchPenalty(seats);
    // Add relationship network influence
    total += UI.calcRelationshipInfluence(seats);
    return total;
    },

    function _calcWithCustomAlgo(seats) {
    let total = 0;
    const checked = new Set();
    const context = { seats, settings: state.settings, rows: state.rows, cols: state.cols, blacklist: state.blacklist, whitelist: state.whitelist };
    seats.forEach(s => {
        if (!s.student) return;
        UI.getNeighbors(s).forEach(n => {
            if (!n.student) return;
            const key = [Math.min(s.student.id, n.student.id), Math.max(s.student.id, n.student.id)].join('-');
            if (checked.has(key)) return;
            checked.add(key);
            total += UI._customAlgorithm.peerInfluence(s.student, n.student, context);
        });
    });
    return total;
    },

    function enhancedPeerInfluence(s1, s2, seat1, seat2) {
    let score = CompositeEval.peerInfluence(s1, s2);

    // Bonus: row-level academic balance
    const avg1 = CompositeEval.getAvgScore(s1), avg2 = CompositeEval.getAvgScore(s2);
    if (avg1 !== null && avg2 !== null) {
        const diff = Math.abs(avg1 - avg2);
        if (diff >= 20 && diff <= 35) score += 5; // Good academic spread
    }

    // Penalty: too many lunch students adjacent
    if (s1.lunch && s2.lunch) {
        const n1 = UI.getNeighbors(seat1).filter(n => n.student?.lunch).length;
        const n2 = UI.getNeighbors(seat2).filter(n => n.student?.lunch).length;
        if (n1 >= 3 || n2 >= 3) score -= 10; // Too clustered
    }

    // Bonus: position diversity in same row
    if (seat1.row === seat2.row && s1.position && s2.position && s1.position !== s2.position) {
        score += 5;
    }

    return score;
    },

    function calcRowBalance(seats) {
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

    function calcLunchPenalty(seats) {
    let penalty = 0;
    seats.forEach(s => {
        if (!s.student?.lunch) return;
        const lunchNeighbors = UI.getNeighbors(s).filter(n => n.student?.lunch).length;
        if (lunchNeighbors >= 4) penalty -= 15; // Heavy lunch clustering
        else if (lunchNeighbors >= 3) penalty -= 8;
    });
    return penalty;
    },

    /**
     * Calculate relationship network influence on total score.
     * Positive relationships between adjacent students → bonus
     * Negative relationships between adjacent students → penalty
     */
    function calcRelationshipInfluence(seats) {
    if (state.relationships.length === 0) return 0;
    let total = 0;
    const checked = new Set();
    seats.forEach(s => {
        if (!s.student) return;
        UI.getNeighbors(s).forEach(n => {
            if (!n.student) return;
            const key = [Math.min(s.student.id, n.student.id), Math.max(s.student.id, n.student.id)].join('-');
            if (checked.has(key)) return;
            checked.add(key);
            const relScore = RelationshipManager.getScore(s.student.name, n.student.name);
            if (relScore !== 0) {
                // Scale relationship score: adjacent seats get full effect
                total += relScore * 0.5;
            }
        });
    });
    return total;
    },

    /**
     * Get neighboring seats (up, down, left, right, diagonal)
     */
    function getNeighbors(seat) {
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

    function showRecommendations() {
    const panel = document.getElementById('recommendPanel');
    const content = document.getElementById('recommendContent');
    // Show panel immediately with loading state
    content.innerHTML = '<div class="recommend-empty">🔄 正在分析座位安排...</div>';
    panel.classList.add('visible');
    Toast.info('正在分析座位安排...');
    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
        try {
            UI.generateRecommendations();
        } catch (e) {
            console.error('智能推荐生成失败:', e);
            Toast.error('智能推荐生成失败：' + (e.message || '未知错误'));
            content.innerHTML = '<div class="recommend-empty">❌ 分析失败，请查看控制台</div>';
            return;
        }
        const hasSwapRecs = UI._recommendations.length > 0;
        const hasTutoring = (UI._tutoringChains || []).length > 0;
        if (!hasSwapRecs && !hasTutoring) {
            content.innerHTML = '<div class="recommend-empty">🎉 当前座位安排已较合理，暂无推荐调整</div>';
            Toast.info('当前座位安排已较合理');
            return;
        }
        UI.renderRecommendations();
        const total = UI._recommendations.length + (UI._tutoringChains || []).length;
        Toast.success(`找到 ${total} 条优化建议`);
    }, 50);
    },

    function renderRecommendations() {
    const content = document.getElementById('recommendContent');
    const priorityLabels = { high: '强烈建议', medium: '建议调整', low: '可选优化' };
    const hasSwapRecs = UI._recommendations.length > 0;
    const hasTutoring = (UI._tutoringChains || []).length > 0;

    if (!hasSwapRecs && !hasTutoring) {
        content.innerHTML = '<div class="recommend-empty">🎉 当前座位安排已较合理，暂无推荐调整</div>';
        return;
    }

    let html = '';

    // Regular swap recommendations
    if (hasSwapRecs) {
        html += UI._recommendations.map((rec, i) => `
        <div class="recommend-card" data-idx="${i}" data-seat1-row="${rec.seat1.row}" data-seat1-col="${rec.seat1.col}" data-seat2-row="${rec.seat2.row}" data-seat2-col="${rec.seat2.col}" style="${rec.applied ? 'opacity:0.5;' : ''}">
            <div class="recommend-card-header">
                <span class="recommend-card-title">推荐 #${i + 1}</span>
                <span class="recommend-card-badge ${rec.priority}">${priorityLabels[rec.priority]} · 良性影响+${rec.improvement}</span>
            </div>
            <div class="recommend-reason">${rec.reason.replace(/\n/g, '<br>')}</div>
            <div class="recommend-swap">
                <span class="seat-chip">${escapeHtml(rec.student1.name)} → ${UI.seatLabel(rec.seat1)}</span>
                <span class="arrow">⇄</span>
                <span class="seat-chip">${escapeHtml(rec.student2.name)} → ${UI.seatLabel(rec.seat2)}</span>
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
        html += UI._tutoringChains.map((chain, i) => `
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
            const rec = UI._recommendations[idx];
            if (!rec || rec.applied) return;
            UI.clearRecommendHighlights();
            UI.highlightSeat(rec.seat1);
            UI.highlightSeat(rec.seat2);
            card.classList.add('hovering');
        });
        card.addEventListener('mouseleave', () => {
            UI.clearRecommendHighlights();
            card.classList.remove('hovering');
        });
    });
    content.querySelectorAll('[data-action="accept"]').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); UI.acceptRecommendation(parseInt(btn.dataset.idx)); });
    });
    content.querySelectorAll('[data-action="skip"]').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); UI.skipRecommendation(parseInt(btn.dataset.idx)); });
    });
    },

    function highlightSeat(seat) {
    const el = seat.type === 'normal' ? seat.element : document.getElementById(seat.type === 'platform-left' ? 'platformLeft' : 'platformRight');
    if (el) el.classList.add('recommend-highlight');
    },
    function clearRecommendHighlights() {
    document.querySelectorAll('.recommend-highlight').forEach(el => el.classList.remove('recommend-highlight'));
    },

    function acceptRecommendation(idx) {
    const rec = UI._recommendations[idx];
    if (!rec || rec.applied) return;
    UI.clearRecommendHighlights();
    UI.doSwap(rec.seat1, rec.seat2);
    rec.applied = true;
    Toast.success(`已采纳：${rec.student1.name} ↔ ${rec.student2.name}`);
    addLog('🧠', `智能推荐：${rec.student1.name} ↔ ${rec.student2.name}`);
    UI.renderRecommendations();
    },

    function skipRecommendation(idx) {
    const rec = UI._recommendations[idx];
    if (!rec) return;
    rec.applied = true; // Mark as handled (skipped)
    UI.renderRecommendations();
    },

    function applyAllRecommendations() {
    let applied = 0;
    UI._recommendations.forEach((rec, i) => {
        if (!rec.applied) {
            UI.doSwap(rec.seat1, rec.seat2);
            rec.applied = true;
            applied++;
            addLog('🧠', `智能推荐：${rec.student1.name} ↔ ${rec.student2.name}`);
        }
    });
    UI.renderRecommendations();
    if (applied > 0) Toast.success(`已采纳 ${applied} 条推荐`);
    else Toast.info('所有推荐已处理');
    },

    // ==================== Custom Algorithm Management ====================
    function renderCustomAlgoList() {
    const container = document.getElementById('customAlgoList');
    const display = document.getElementById('currentAlgoDisplay');
    if (!container) return;
    const algos = UI._customAlgorithms || {};
    const algoNames = Object.keys(algos);
    if (algoNames.length === 0) {
        container.innerHTML = '<span style="color:var(--text-tertiary);">暂无自定义算法</span>';
        if (display) display.textContent = '内置算法 (CompositeEval)';
        return;
    }
    container.innerHTML = algoNames.map(name => {
        const algo = algos[name];
        const isActive = UI._customAlgorithm?.name === name;
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
            UI._customAlgorithm = algos[btn.dataset.activateAlgo];
            Toast.success(`已切换到算法: ${btn.dataset.activateAlgo}`);
            UI.renderCustomAlgoList();
        });
    });
    container.querySelectorAll('[data-remove-algo]').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.removeAlgo;
            delete algos[name];
            if (UI._customAlgorithm?.name === name) UI._customAlgorithm = null;
            UI.renderCustomAlgoList();
            Toast.success(`已移除算法: ${name}`);
        });
    });
    if (display) display.textContent = UI._customAlgorithm ? `自定义: ${UI._customAlgorithm.name}` : '内置算法 (CompositeEval)';
    },

    function _downloadAlgoTemplate() {
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
    function peerInfluence(s1, s2, context) {
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
    function generateRecommendations(seatedStudents, context) {
    return [];
    },

    /**
     * 计算学生综合评分 (可选，用于热力图)
     * @param {Object} student
     * @returns {number} 0-100
     */
    function getScore(student) {
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
