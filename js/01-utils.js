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
        e.preventDefault(); // [FIX #4] Prevent scroll during drag
        onStart(e.touches[0].clientX, e.touches[0].clientY, e);
        const move = ev => onMove(ev.touches[0].clientX, ev.touches[0].clientY, ev);
        const end = () => { onEnd(); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); };
        document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', end);
    }, { passive: false });
}
