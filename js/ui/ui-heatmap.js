// ==================== Heatmap (Multi-type) ====================
    function getHeatmapColor(score, alpha = 1) {
    const s = clamp(score, 0, 100);
    const hue = (s / 100) * 120;
    return `hsla(${hue}, 80%, 50%, ${alpha})`;
    },

    function getHeatmapScore(student) {
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

    function renderHeatmap() {
    // [FEATURE #23] Batch heatmap updates with requestAnimationFrame
    const updates = [];
    state.seats.forEach(seat => {
        const overlay = seat.element.querySelector('.heatmap-overlay');
        if (!overlay) return;
        if (seat.student) {
            const score = UI.getHeatmapScore(seat.student);
            if (score !== null && score !== undefined) {
                updates.push({ overlay, bg: UI.getHeatmapColor(score, 0.35) });
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
            const score = UI.getHeatmapScore(seat.student);
            if (score !== null && score !== undefined) {
                updates.push({ overlay, bg: UI.getHeatmapColor(score, 0.35) });
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

    function clearHeatmap() {
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
