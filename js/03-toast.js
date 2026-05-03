// ==================== Toast ====================
const Toast = {
    show(message, type = 'success', duration = 2500) {
        const container = document.getElementById('toastContainer');
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
// [AUDIT-1] XSS escape utility
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
