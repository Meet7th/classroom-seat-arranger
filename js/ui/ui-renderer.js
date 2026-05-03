// ==================== Render Classroom ====================
    function renderClassroom() {
    document.getElementById('frontDoor').style.display = state.showDoors ? 'block' : 'none';
    document.getElementById('backDoor').style.display = state.showDoors ? 'block' : 'none';
    UI.applyDoorPosition();
    const pL = document.getElementById('platformLeft');
    const pR = document.getElementById('platformRight');
    pL.style.display = state.showPlatformLeft ? 'flex' : 'none';
    pR.style.display = state.showPlatformRight ? 'flex' : 'none';
    pL.classList.toggle('disabled', state.platformLeft.disabled);
    pR.classList.toggle('disabled', state.platformRight.disabled);

    // Column headers
    const colHeaders = document.getElementById('columnHeaders');
    colHeaders.innerHTML = '';
    colHeaders.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    for (let col = 0; col < state.cols; col++) {
        const ch = document.createElement('div');
        ch.className = 'column-header';
        ch.textContent = col + 1;
        ch.dataset.col = col;
        ch.addEventListener('contextmenu', e => { e.preventDefault(); UI.showColumnContextMenu(e, col); });
        ch.addEventListener('touchstart', e => {
            UI.longPressTimer = setTimeout(() => { e.preventDefault(); UI.showColumnContextMenu(e.touches[0], col); }, 500);
        }, { passive: false });
        ch.addEventListener('touchend', () => clearTimeout(UI.longPressTimer));
        ch.addEventListener('touchmove', () => clearTimeout(UI.longPressTimer));
        colHeaders.appendChild(ch);
    }

    // Seats grid
    const grid = document.getElementById('seatsGrid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    state.seats = [];
    const totalSeats = state.rows * state.cols;
    const randomNumbers = UI.generateUniqueRandomNumbers(totalSeats);
    for (let row = 0; row < state.rows; row++) {
        for (let col = 0; col < state.cols; col++) {
            const seatEl = document.createElement('div');
            seatEl.className = 'seat';
            seatEl.dataset.row = row;
            seatEl.dataset.col = col;
            let seatNumber;
            if (state.settings.numberingMode === 'horizontal-snake') {
                seatNumber = row % 2 === 0 ? row * state.cols + col + 1 : (row + 1) * state.cols - col;
            } else if (state.settings.numberingMode === 'vertical-snake') {
                seatNumber = col % 2 === 0 ? col * state.rows + row + 1 : (col + 1) * state.rows - row;
            } else {
                seatNumber = randomNumbers[row * state.cols + col];
            }
            seatEl.innerHTML = `<span class="seat-number">${seatNumber}</span><span class="seat-name" style="font-size:${state.settings.seatFontSize}px;"></span><span class="seat-gender"></span><div class="heatmap-overlay"></div>`;
            grid.appendChild(seatEl);
            state.seats.push({ element: seatEl, number: seatNumber, row, col, disabled: false, student: null, type: 'normal' });
        }
    }
    UI.generateDrawOrder();
    UI.checkAisles();
    UI.bindSeatEvents();
    UI.updateEmptyState();
    if (state.heatmapVisible) UI.renderHeatmap();
    UI.animateSeatsIn();
    },

    function generateUniqueRandomNumbers(n) {
    const numbers = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers;
    },

    function generateDrawOrder() {
    state.drawOrder = [];
    if (!state.platformRight.disabled && state.showPlatformRight) state.drawOrder.push(state.platformRight);
    if (!state.platformLeft.disabled && state.showPlatformLeft) state.drawOrder.push(state.platformLeft);
    state.drawOrder.push(...[...state.seats].filter(s => !s.disabled).sort((a, b) => a.number - b.number));
    },

    // [FIX] Aisles no longer clear seat HTML
    function checkAisles() {
    for (let col = 0; col < state.cols; col++) {
        let allDisabled = true;
        for (let row = 0; row < state.rows; row++) {
            if (!state.seats[row * state.cols + col].disabled) { allDisabled = false; break; }
        }
        for (let row = 0; row < state.rows; row++) {
            const s = state.seats[row * state.cols + col];
            s.element.classList.toggle('aisle', allDisabled);
        }
    }
    },

    function updateEmptyState() {
    const es = document.getElementById('emptyState');
    const cl = document.getElementById('classroom');
    if (state.students.length === 0) { es.style.display = 'block'; cl.style.display = 'none'; }
    else { es.style.display = 'none'; cl.style.display = 'flex'; }
    },

    // [FIX] Unified seat event binding
    function bindSeatEvents() {
    if (UI._seatAbort) UI._seatAbort.abort();
    UI._seatAbort = new AbortController();
    const sig = UI._seatAbort.signal;

    const bindSeat = (seat, el) => {
        el.draggable = state.settings.enableDragDrop;
        el.addEventListener('click', e => {
            if (state.batchMode) { UI.toggleBatchSeat(seat); return; }
            if (state.swapMode && state.selectedSeat) {
                if (state.selectedSeat !== seat && !seat.disabled) {
                    UI.doSwap(state.selectedSeat, seat);
                }
                return;
            }
            // Pool click-to-place
            if (state.selectedPoolStudent !== null && !seat.student && !seat.disabled) {
                const student = state.remainingStudents.find(s => s.id === state.selectedPoolStudent);
                if (student) {
                    state.remainingStudents = state.remainingStudents.filter(s => s.id !== student.id);
                    state.drawnStudents.push(student);
                    seat.student = student;
                    UI.updateSeatDisplay(seat);
                    UI.updateStats();
                    UI.updateProbabilityPanel();
                    UI.renderPool();
                    state.selectedPoolStudent = null;
                    document.querySelectorAll('.seat').forEach(s => s.classList.remove('pool-target'));
                    addLog('🎯', `${student.name} 被点击分配到 ${seat.type === 'normal' ? seat.number + '号' : '讲台'}`);
                    Toast.success(`${student.name} 已分配到 ${seat.type === 'normal' ? seat.number + '号座位' : '讲台座位'}`);
                    return;
                }
            }
            if (state.settings.enableClickSwap && seat.student) UI.handleSeatClick(seat);
            else if (seat.student) UI.toggleLunch(seat);
        }, { signal: sig });
        el.addEventListener('contextmenu', e => { e.preventDefault(); UI.showContextMenu(e, seat); }, { signal: sig });
        // Long press
        let tts = 0, tsx = 0, tsy = 0;
        el.addEventListener('touchstart', e => {
            tts = Date.now(); tsx = e.touches[0].clientX; tsy = e.touches[0].clientY;
            UI.longPressTimer = setTimeout(() => { e.preventDefault(); UI.showContextMenu(e.touches[0], seat); }, 500);
        }, { passive: false, signal: sig });
        el.addEventListener('touchend', e => {
            clearTimeout(UI.longPressTimer);
            if (!e.changedTouches || e.changedTouches.length === 0) return;
            const dur = Date.now() - tts;
            const dist = Math.hypot(e.changedTouches[0].clientX - tsx, e.changedTouches[0].clientY - tsy);
            if (dur < 300 && dist < 10) {
                if (state.batchMode) { UI.toggleBatchSeat(seat); return; }
                if (state.swapMode && state.selectedSeat) {
                    if (state.selectedSeat !== seat && !seat.disabled) UI.doSwap(state.selectedSeat, seat);
                    return;
                }
                if (state.settings.enableClickSwap && seat.student) UI.handleSeatClick(seat);
                else if (seat.student) UI.toggleLunch(seat);
            }
        }, { signal: sig });
        el.addEventListener('touchmove', () => clearTimeout(UI.longPressTimer), { signal: sig });
        // Drag & Drop
        if (state.settings.enableDragDrop) {
            el.addEventListener('dragstart', e => {
                clearTimeout(UI.longPressTimer); // [FIX #13] Cancel long press on drag
                if (!seat.student) { e.preventDefault(); return; }
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: seat.type, index: seat.type === 'normal' ? state.seats.indexOf(seat) : seat.type }));
                el.classList.add('dragging');
            }, { signal: sig });
            el.addEventListener('dragend', () => { el.classList.remove('dragging'); document.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over')); }, { signal: sig });
            el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); }, { signal: sig });
            el.addEventListener('dragleave', () => el.classList.remove('drag-over'), { signal: sig });
            el.addEventListener('drop', e => {
                e.preventDefault(); el.classList.remove('drag-over');
                try {
                    const src = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const tgt = { type: seat.type, index: seat.type === 'normal' ? state.seats.indexOf(seat) : seat.type };
                    UI.handleDrop(src, tgt);
                } catch(err) { console.error('拖拽数据解析失败', err); }
            }, { signal: sig });
        }
        // Pool drop target
        el.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/pool-student')) e.preventDefault(); }, { signal: sig });
        el.addEventListener('drop', e => {
            if (e.dataTransfer.types.includes('text/pool-student')) {
                e.preventDefault();
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/pool-student'));
                    const student = state.remainingStudents.find(s => s.id === data.id);
                    if (student && !seat.student && !seat.disabled) {
                        // Remove from remaining, assign to seat
                        state.remainingStudents = state.remainingStudents.filter(s => s.id !== student.id);
                        state.drawnStudents.push(student);
                        seat.student = student;
                        UI.updateSeatDisplay(seat);
                        UI.updateStats();
                        UI.updateProbabilityPanel();
                        UI.renderPool();
                        addLog('🎯', `${student.name} 被拖拽分配到 ${seat.type === 'normal' ? seat.number + '号' : '讲台'}`);
                        Toast.success(`${student.name} 已分配到 ${seat.type === 'normal' ? seat.number + '号座位' : '讲台座位'}`);
                    }
                } catch(err) {}
            }
        }, { signal: sig });
    };

    // Bind normal seats
    state.seats.forEach((seat, idx) => bindSeat(seat, seat.element));
    // Bind platform seats
    [state.platformLeft, state.platformRight].forEach(seat => {
        const el = document.getElementById(seat.type === 'platform-left' ? 'platformLeft' : 'platformRight');
        seat.element = el;
        bindSeat(seat, el);
    });
    },
