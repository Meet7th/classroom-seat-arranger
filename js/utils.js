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
        `<div class="log-item"><span class="log-icon">${escapeHtml(l.icon)}</span><span>${escapeHtml(l.text)}</span><span class="log-time">${l.time}</span></div>`
    ).join('');
}

// ==================== Toast ====================
const Toast = {
    show(message, type = 'success', duration = 2500) {
        const container = document.getElementById('toastContainer');
        while (container.children.length >= 5) container.removeChild(container.firstChild);
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toast-out 0.3s ease-out forwards';
            setTimeout(() => { if (toast.parentNode) container.removeChild(toast); }, 300);
        }, duration);
    },
    success(m) { this.show(m, 'success'); },
    error(m) { this.show(m, 'error'); },
    warning(m) { this.show(m, 'warning'); },
    info(m) { this.show(m, 'info'); }
};

// ==================== Utils ====================
function debounce(func, wait) {
    let timeout;
    return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); };
}
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function formatTime(d) { return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; }
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ==================== Draggable Panels ====================
function makeDraggable(element) {
    const dragState = { isDragging: false, initialX: 0, initialY: 0, xOffset: 0, yOffset: 0 };
    const onStart = (clientX, clientY, e) => {
        if (e.target.closest('.island-close,.probability-close,.probability-toggle-btn')) return;
        dragState.isDragging = true;
        dragState.initialX = clientX - dragState.xOffset;
        dragState.initialY = clientY - dragState.yOffset;
    };
    const onMove = (clientX, clientY, ev) => {
        if (!dragState.isDragging) return;
        if (ev) ev.preventDefault();
        dragState.xOffset = clientX - dragState.initialX;
        dragState.yOffset = clientY - dragState.initialY;
        element.style.transform = `translate(${dragState.xOffset}px,${dragState.yOffset}px)`;
    };
    const onEnd = () => { dragState.isDragging = false; };
    element.addEventListener('mousedown', e => {
        onStart(e.clientX, e.clientY, e);
        const move = ev => onMove(ev.clientX, ev.clientY, ev);
        const end = () => { onEnd(); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', end); };
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', end);
    });
    element.addEventListener('touchstart', e => {
        e.preventDefault();
        onStart(e.touches[0].clientX, e.touches[0].clientY, e);
        const move = ev => onMove(ev.touches[0].clientX, ev.touches[0].clientY, ev);
        const end = () => { onEnd(); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); };
        document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', end);
    }, { passive: false });
}
