// ==================== Seat Operations ====================
    function handleSeatClick(seat) {
    if (state.swapMode) return; // handled in click listener now
    if (state.selectedSeat === seat) UI.clearSelection();
    else { UI.clearSelection(); state.selectedSeat = seat; seat.element.classList.add('selected'); }
    },

    function doSwap(s1, s2) {
    const desc = `${UI.seatLabel(s1)} ↔ ${UI.seatLabel(s2)}`;
    const oldS1 = s1.student, oldS2 = s2.student;
    UndoManager.push({
        desc: '互换: ' + desc,
        undo: () => { s1.student = oldS1; s2.student = oldS2; UI.updateSeatDisplay(s1); UI.updateSeatDisplay(s2); },
        redo: () => { s1.student = oldS2; s2.student = oldS1; UI.updateSeatDisplay(s1); UI.updateSeatDisplay(s2); }
    });
    UI.swapSeats(s1, s2);
    UI.clearSelection();
    Toast.success('座位互换成功');
    addLog('🔄', '互换: ' + desc);
    },

    function swapSeats(s1, s2) {
    const temp = s1.student; s1.student = s2.student; s2.student = temp;
    UI.updateSeatDisplay(s1); UI.updateSeatDisplay(s2);
    },

    function updateSeatDisplay(seat) {
    const el = seat.type === 'normal' ? seat.element : document.getElementById(seat.type === 'platform-left' ? 'platformLeft' : 'platformRight');
    if (!el) return;
    el.className = seat.type === 'normal' ? 'seat' : 'platform-side-seat';
    if (seat.disabled) { el.classList.add('disabled'); UI.clearSeatName(el); return; }
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
        UI.clearSeatName(el);
        el.classList.remove('no-score');
    }
    // Heatmap overlay (uses overlay div, not background)
    const overlay = el.querySelector('.heatmap-overlay');
    if (overlay) {
        if (state.heatmapVisible && seat.student && seat.student.score !== undefined && seat.student.score !== null) {
            overlay.style.background = UI.getHeatmapColor(seat.student.score, 0.3);
        } else {
            overlay.style.background = 'transparent';
        }
    }
    },

    function clearSeatName(el) {
    const nameEl = el.querySelector('.seat-name');
    if (nameEl) { nameEl.textContent = ''; nameEl.classList.remove('lunch-underline'); nameEl.style.textDecorationColor = ''; }
    const gEl = el.querySelector('.seat-gender');
    if (gEl) gEl.textContent = '';
    const overlay = el.querySelector('.heatmap-overlay');
    if (overlay) overlay.style.background = 'transparent';
    el.classList.remove('pinned');
    },

    function clearSelection() {
    if (state.selectedSeat && state.selectedSeat.element) state.selectedSeat.element.classList.remove('selected');
    state.selectedSeat = null; state.swapMode = false;
    },

    function toggleLunch(seat) {
    if (!seat.student) return;
    const old = seat.student.lunch;
    seat.student.lunch = !seat.student.lunch;
    UndoManager.push({
        desc: `${seat.student.name} ${old ? '取消' : '标记'}午休`,
        undo: () => { seat.student.lunch = old; UI.updateSeatDisplay(seat); UI.updateStats(); UI.renderPool(); },
        redo: () => { seat.student.lunch = !old; UI.updateSeatDisplay(seat); UI.updateStats(); UI.renderPool(); }
    });
    UI.updateSeatDisplay(seat); UI.updateStats(); UI.renderPool();
    Toast.success(`${seat.student.name} 已${seat.student.lunch ? '标记' : '取消'}午休`);
    addLog('💤', `${seat.student.name} ${seat.student.lunch ? '标记' : '取消'}午休`);
    },

    function clearSeat(seat) {
    if (!seat.student) return;
    const student = seat.student;
    const seatLabel = UI.seatLabel(seat);
    state.remainingStudents.push(student);
    state.drawnStudents = state.drawnStudents.filter(s => s.id !== student.id);
    seat.student = null;
    UndoManager.push({
        desc: `${student.name} 移至待选区`,
        undo: () => {
            state.remainingStudents = state.remainingStudents.filter(s => s.id !== student.id);
            state.drawnStudents.push(student);
            seat.student = student;
            UI.updateSeatDisplay(seat); UI.updateStats(); UI.updateProbabilityPanel(); UI.renderPool();
        },
        redo: () => {
            state.remainingStudents.push(student);
            state.drawnStudents = state.drawnStudents.filter(s => s.id !== student.id);
            seat.student = null;
            UI.updateSeatDisplay(seat); UI.updateStats(); UI.updateProbabilityPanel(); UI.renderPool();
        }
    });
    UI.updateSeatDisplay(seat); UI.updateStats(); UI.updateProbabilityPanel(); UI.renderPool();
    Toast.success(`${student.name} 已移至待选区`);
    addLog('↩️', `${student.name} 从 ${seatLabel} 移至待选区`);
    },

    function disableSeat(seat) {
    if (seat.student) { Toast.warning('请先清空该座位再禁用'); return; }
    seat.disabled = true;
    UndoManager.push({
        desc: `禁用座位 ${UI.seatLabel(seat)}`,
        undo: () => { seat.disabled = false; seat.element.classList.remove('aisle'); UI.updateSeatDisplay(seat); UI.generateDrawOrder(); UI.checkAisles(); },
        redo: () => { seat.disabled = true; UI.updateSeatDisplay(seat); UI.generateDrawOrder(); UI.checkAisles(); }
    });
    UI.updateSeatDisplay(seat); UI.generateDrawOrder(); UI.checkAisles();
    Toast.success('座位已禁用'); addLog('🚫', `禁用座位 ${UI.seatLabel(seat)}`);
    },

    function enableSeat(seat) {
    seat.disabled = false;
    UndoManager.push({
        desc: `启用座位 ${UI.seatLabel(seat)}`,
        undo: () => { seat.disabled = true; UI.updateSeatDisplay(seat); UI.generateDrawOrder(); UI.checkAisles(); },
        redo: () => { seat.disabled = false; seat.element.classList.remove('aisle'); UI.updateSeatDisplay(seat); UI.generateDrawOrder(); }
    });
    seat.element.classList.remove('aisle');
    UI.updateSeatDisplay(seat); UI.generateDrawOrder();
    Toast.success('座位已启用'); addLog('✅', `启用座位 ${UI.seatLabel(seat)}`);
    },

    function disableColumn(col) {
    const clearedStudents = [];
    for (let row = 0; row < state.rows; row++) {
        const s = state.seats[row * state.cols + col];
        if (s.student) { clearedStudents.push({ seat: s, student: s.student }); UI.clearSeat(s); }
        s.disabled = true; UI.updateSeatDisplay(s);
    }
    UndoManager.push({
        desc: `禁用第 ${col + 1} 列`,
        undo: () => {
            for (let row = 0; row < state.rows; row++) {
                const s = state.seats[row * state.cols + col];
                s.disabled = false; s.element.classList.remove('aisle'); UI.updateSeatDisplay(s);
            }
            clearedStudents.forEach(({ seat, student }) => {
                state.remainingStudents = state.remainingStudents.filter(s => s.id !== student.id);
                state.drawnStudents.push(student);
                seat.student = student;
                UI.updateSeatDisplay(seat);
            });
            UI.generateDrawOrder(); UI.checkAisles(); UI.updateStats(); UI.renderPool();
        },
        redo: () => {
            for (let row = 0; row < state.rows; row++) {
                const s = state.seats[row * state.cols + col];
                if (s.student) UI.clearSeat(s);
                s.disabled = true; UI.updateSeatDisplay(s);
            }
            UI.generateDrawOrder(); UI.checkAisles();
        }
    });
    UI.generateDrawOrder(); UI.checkAisles();
    Toast.success(`第 ${col + 1} 列已禁用`); addLog('🚫', `禁用第 ${col + 1} 列`);
    },

    function enableColumn(col) {
    for (let row = 0; row < state.rows; row++) {
        const s = state.seats[row * state.cols + col];
        s.disabled = false; s.element.classList.remove('aisle'); UI.updateSeatDisplay(s);
    }
    UndoManager.push({
        desc: `启用第 ${col + 1} 列`,
        undo: () => {
            for (let row = 0; row < state.rows; row++) {
                const s = state.seats[row * state.cols + col];
                if (s.student) UI.clearSeat(s);
                s.disabled = true; UI.updateSeatDisplay(s);
            }
            UI.generateDrawOrder(); UI.checkAisles();
        },
        redo: () => {
            for (let row = 0; row < state.rows; row++) {
                const s = state.seats[row * state.cols + col];
                s.disabled = false; s.element.classList.remove('aisle'); UI.updateSeatDisplay(s);
            }
            UI.generateDrawOrder();
        }
    });
    UI.generateDrawOrder();
    Toast.success(`第 ${col + 1} 列已启用`); addLog('✅', `启用第 ${col + 1} 列`);
    },

    function seatLabel(seat) {
    if (seat.type === 'platform-left') return '讲台左';
    if (seat.type === 'platform-right') return '讲台右';
    return seat.number + '号';
    },

    // ==================== Fill Seat ====================
    function fillSeat(student) {
    while (state.currentDrawIndex < state.drawOrder.length) {
        const seat = state.drawOrder[state.currentDrawIndex];
        if (!seat.student && !seat.disabled) {
            seat.student = student;
            UI.updateSeatDisplay(seat);
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

    // ==================== Pin Student ====================
    function togglePin(seat) {
    if (!seat.student) return;
    seat.student.pinned = !seat.student.pinned;
    seat.element.classList.toggle('pinned', seat.student.pinned);
    Toast.success(`${seat.student.name} 已${seat.student.pinned ? '固定' : '取消固定'}`);
    addLog(seat.student.pinned ? '📌' : '📍', `${seat.student.name} ${seat.student.pinned ? '固定' : '取消固定'}`);
    },

    // ==================== Seat Animation ====================
    function animateSeatsIn() {
    const seats = document.querySelectorAll('.seat');
    seats.forEach((seat, i) => {
        seat.classList.add('animate-in');
        seat.style.animationDelay = `${Math.min(i * 15, 600)}ms`;
        setTimeout(() => { seat.classList.remove('animate-in'); seat.style.animationDelay = ''; }, 800 + Math.min(i * 15, 600));
    });
    },

    // ==================== Arrow Key Navigation ====================
    _navSeat: null,
    function navigateSeats(direction) {
    if (state.seats.length === 0) return;
    if (!UI._navSeat) {
        UI._navSeat = state.seats[0];
    } else {
        const cur = UI._navSeat;
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
        if (target) UI._navSeat = target;
    }
    if (UI._navSeat) {
        UI.clearSelection();
        state.selectedSeat = UI._navSeat;
        UI._navSeat.element.classList.add('selected');
        UI._navSeat.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    },
