// ==================== Global State ====================
const state = {
    rows: 7, cols: 11,
    seats: [],
    drawOrder: [],
    currentDrawIndex: 0,
    platformLeft: { disabled: false, student: null, type: 'platform-left', number: 0, row: -1, col: -1 },
    platformRight: { disabled: false, student: null, type: 'platform-right', number: -1, row: -1, col: -2 },
    showDoors: true, doorPosition: 'right', showPlatformLeft: true, showPlatformRight: true,
    students: [], drawnStudents: [], remainingStudents: [],
    blacklist: [], whitelist: [], history: [],
    relationships: [], // 人物关系网 {id, studentA, studentB, type, score, note}
    plugins: {},
    selectedSeat: null, swapMode: false,
    heatmapVisible: false, heatmapType: 'composite',
    batchMode: false, batchSeats: [],
    poolFilter: 'all', poolSearch: '',
    selectedPoolStudent: null,
    pendingDrawSequence: null, // For imported seat data not yet displayed
    // Subject definitions (expandable)
    subjects: ['语文', '数学', '英语', '物理', '化学', '历史', '地理', '政治', '生物'],
    // Personality types
    personalityTypes: ['外向', '内向', '中性'],
    // Class positions
    classPositions: ['班长', '副班长', '学习委员', '体育委员', '文艺委员', '劳动委员', '小组长', '课代表'],
    settings: {
        numberingMode: 'horizontal-snake',
        maleMapping: '男', femaleMapping: '女',
        blacklistPenalty: 95, blacklistRadius: 2,
        whitelistDeskBonus: 200, whitelistFrontBackBonus: 120,
        whitelistDiagonalBonus: 60, whitelistFallbackBonus: 150,
        drawMode: 'predictable', genderBalance: true, antiCluster: true,
        lunchUnderlineColor: '#007AFF', seatFontSize: 13,
        drawAnimationDuration: 400, screenshotBgColor: '#ffffff',
        screenshotTransparentBg: false,
        exportIncludeGender: true, exportIncludeLunch: true,
        exportIncludeSeatNumber: true,
        enableDragDrop: true, enableClickSwap: true,
        showStatsByDefault: true, showProbabilityByDefault: true,
        autoDrawInterval: 800,
        theme: '', accentColor: '#007AFF',
        demoSpeed: 600,
        // Quick info bar items visibility
        quickInfoItems: {
            layout: true, total: true, drawn: true, remaining: true,
            male: true, female: true, lunch: true
        },
        // Composite evaluation weights
        weights: {
            academic: 60,       // 学业成绩权重
            personality: 15,    // 性格互补权重
            hobby: 10,          // 爱好搭配权重
            position: 10,       // 职务平衡权重
            gender: 5           // 性别均衡权重
        }
    }
};

// ==================== Undo/Redo System ====================
const UndoManager = {
    stack: [], redoStack: [], maxStack: 50,
    push(action) {
        this.stack.push(action);
        if (this.stack.length > this.maxStack) this.stack.shift();
        this.redoStack = [];
        this.updateButtons();
    },
    undo() {
        if (this.stack.length === 0) return;
        const action = this.stack.pop();
        this.redoStack.push(action);
        action.undo();
        this.updateButtons();
        Toast.info('已撤销: ' + action.desc);
        addLog('↩️', '撤销: ' + action.desc);
    },
    redo() {
        if (this.redoStack.length === 0) return;
        const action = this.redoStack.pop();
        this.stack.push(action);
        action.redo();
        this.updateButtons();
        Toast.info('已重做: ' + action.desc);
    },
    updateButtons() {
        document.getElementById('undoBtn').style.opacity = this.stack.length > 0 ? '1' : '0.3';
        document.getElementById('redoBtn').style.opacity = this.redoStack.length > 0 ? '1' : '0.3';
    }
};

// ==================== Operation Log ====================
const opLogs = [];
function addLog(icon, text) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    opLogs.unshift({ icon, text, time });
    if (opLogs.length > 100) opLogs.pop();
    renderLogList();
}
function renderLogList() {
    const el = document.getElementById('logList');
    if (opLogs.length === 0) { el.innerHTML = '<div class="log-empty">暂无操作记录</div>'; return; }
    el.innerHTML = opLogs.slice(0, 50).map(l =>
        `<div class="log-item"><span class="log-icon">${l.icon}</span><span>${escapeHtml(l.text)}</span><span class="log-time">${l.time}</span></div>`
    ).join('');
}
