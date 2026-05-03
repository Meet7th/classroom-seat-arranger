// ==================== Batch Mode ====================
    function toggleBatchSeat(seat) {
    const idx = state.batchSeats.indexOf(seat);
    if (idx >= 0) { state.batchSeats.splice(idx, 1); seat.element.classList.remove('selected'); }
    else { state.batchSeats.push(seat); seat.element.classList.add('selected'); }
    document.getElementById('batchCount').textContent = state.batchSeats.length;
    },

    function enterBatchMode() {
    state.batchMode = true; state.batchSeats = [];
    document.getElementById('batchToolbar').classList.add('visible');
    document.getElementById('quickInfo').style.display = 'none';
    document.getElementById('batchCount').textContent = '0';
    },

    function exitBatchMode() {
    state.batchMode = false;
    state.batchSeats.forEach(s => s.element.classList.remove('selected'));
    state.batchSeats = [];
    document.getElementById('batchToolbar').classList.remove('visible');
    document.getElementById('quickInfo').style.display = '';
    },

    // ==================== Reset ====================
    function resetDraw() {
    UI.stopAutoDraw();
    state.pendingDrawSequence = null; // Clear any imported draw sequence
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
            prevSeats.forEach((sv, i) => { if (state.seats[i]) { state.seats[i].student = sv.student; UI.updateSeatDisplay(state.seats[i]); } });
            state.platformLeft.student = prevPL; state.platformRight.student = prevPR;
            UI.updateSeatDisplay(state.platformLeft); UI.updateSeatDisplay(state.platformRight);
            state.currentDrawIndex = prevDrawIdx;
            UI.updateStats(); UI.updateProbabilityPanel(); UI.renderPool();
        },
        redo: () => {
            state.drawnStudents = [];
            state.remainingStudents = [...state.students];
            state.currentDrawIndex = 0;
            state.platformLeft.student = null; state.platformRight.student = null;
            UI.updateSeatDisplay(state.platformLeft); UI.updateSeatDisplay(state.platformRight);
            state.seats.forEach(seat => { seat.student = null; UI.updateSeatDisplay(seat); });
            UI.updateStats(); UI.updateProbabilityPanel(); UI.updateEmptyState(); UI.renderPool();
        }
    });
    state.drawnStudents = [];
    state.remainingStudents = [...state.students];
    state.currentDrawIndex = 0;
    state.platformLeft.student = null; state.platformRight.student = null;
    UI.updateSeatDisplay(state.platformLeft); UI.updateSeatDisplay(state.platformRight);
    state.seats.forEach(seat => { seat.student = null; UI.updateSeatDisplay(seat); });
    UI.clearSelection();
    UI.updateStats(); UI.updateProbabilityPanel(); UI.updateEmptyState(); UI.renderPool();
    document.getElementById('stopAutoDraw').style.display = 'none';
    document.getElementById('autoDraw').style.display = 'inline-flex';
    Toast.success('抽取已重置');
    addLog('🔄', '抽取已重置');
    },

    // ==================== Auto Draw (Built-in, not plugin) ====================
    function startAutoDraw() {
    if (UI._autoDrawRunning) return;
    // Check if we have a pending draw sequence
    if (state.pendingDrawSequence && state.pendingDrawSequence.length > 0) {
        UI._autoDrawRunning = true;
        document.getElementById('autoDraw').style.display = 'none';
        document.getElementById('stopAutoDraw').style.display = 'inline-flex';
        const interval = state.settings.autoDrawInterval || 800;
        UI._autoDrawInterval = setInterval(() => {
            if (!state.pendingDrawSequence || state.pendingDrawSequence.length === 0) {
                UI.stopAutoDraw();
                Toast.success('所有座位已演示完毕');
                return;
            }
            UI._doDrawNextFromSequence();
        }, interval);
        addLog('⚡', '开始自动抽取（导入序列模式）');
        return;
    }
    UI._autoDrawRunning = true;
    document.getElementById('autoDraw').style.display = 'none';
    document.getElementById('stopAutoDraw').style.display = 'inline-flex';
    const interval = state.settings.autoDrawInterval || 800;
    UI._autoDrawInterval = setInterval(() => {
        if (state.remainingStudents.length === 0) { UI.stopAutoDraw(); Toast.success('所有学生已抽取完毕'); return; }
        UI.doDrawNext();
    }, interval);
    addLog('⚡', '开始自动抽取');
    },

    function stopAutoDraw() {
    UI._autoDrawRunning = false;
    if (UI._autoDrawInterval) { clearInterval(UI._autoDrawInterval); UI._autoDrawInterval = null; }
    document.getElementById('stopAutoDraw').style.display = 'none';
    document.getElementById('autoDraw').style.display = 'inline-flex';
    },

    /** Draw next seat from imported sequence (demo-style animation) */
    function _doDrawNextFromSequence() {
    if (!state.pendingDrawSequence || state.pendingDrawSequence.length === 0) return null;
    const item = state.pendingDrawSequence.shift();
    const seat = item.seat;
    if (!seat) return null;

    // Assign student to seat
    seat.student = item.student;
    UI.updateSeatDisplay(seat);
    UI.updateStats(); UI.updateProbabilityPanel(); UI.renderPool();

    // Animate
    const el = seat.type === 'normal' ? seat.element : document.getElementById(seat.type);
    if (el) {
        el.classList.add('drawing');
        setTimeout(() => el.classList.remove('drawing'), state.settings.drawAnimationDuration);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Update drawnStudents and remainingStudents
    if (!state.drawnStudents.some(d => d.id === item.student.id)) {
        state.drawnStudents.push(item.student);
    }
    const remIdx = state.remainingStudents.findIndex(s => s.id === item.student.id);
    if (remIdx >= 0) state.remainingStudents.splice(remIdx, 1);

    addLog('🎲', `抽取 ${item.student.name} → ${UI.seatLabel(seat)}`);

    // Clear pending sequence when done
    if (state.pendingDrawSequence.length === 0) {
        state.pendingDrawSequence = null;
        Toast.success('所有座位已演示完毕');
        UI.stopAutoDraw();
    }

    return seat;
    },

    function doDrawNext() {
    // If there's a pending draw sequence, use that instead
    if (state.pendingDrawSequence && state.pendingDrawSequence.length > 0) {
        return UI._doDrawNextFromSequence();
    }
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
    const seat = UI.fillSeat(student);
    if (seat) {
        state.drawnStudents.push(student);
        const drawnName = student.name;
        const seatLbl = UI.seatLabel(seat);
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
                UI.updateSeatDisplay(seat);
                state.seats.forEach(ss => UI.updateSeatDisplay(ss));
                UI.updateSeatDisplay(state.platformLeft);
                UI.updateSeatDisplay(state.platformRight);
                UI.updateStats(); UI.updateProbabilityPanel(); UI.renderPool();
            },
            redo: () => {
                // Re-assign
                const sIdx = state.remainingStudents.findIndex(s => s.id === student.id);
                if (sIdx >= 0) state.remainingStudents.splice(sIdx, 1);
                seat.student = student;
                if (!state.drawnStudents.some(d => d.id === student.id)) state.drawnStudents.push(student);
                UI.updateSeatDisplay(seat);
                UI.updateStats(); UI.updateProbabilityPanel(); UI.renderPool();
            }
        });
        UI.updateStats(); UI.updateProbabilityPanel(); UI.renderPool();
        return seat;
    }
    return null;
    },
