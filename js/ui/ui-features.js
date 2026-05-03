// ==================== Door Position ====================
    function applyDoorPosition() {
    const front = document.getElementById('frontDoor');
    const back = document.getElementById('backDoor');
    const isPodium = document.getElementById('classroom').classList.contains('podium-view');
    const frontDisplay = front.style.display;
    const backDisplay = back.style.display;
    // Reset position styles (preserve display)
    front.style.cssText = '';
    back.style.cssText = '';
    front.style.display = frontDisplay;
    back.style.display = backDisplay;
    // [FIX #3] Reset perspective classes
    front.classList.remove('podium-far', 'podium-near');
    back.classList.remove('podium-far', 'podium-near');

    if (isPodium) {
        // [FIX #3] Podium view: original front door is "far" (top of view), back door is "near" (bottom)
        switch (state.doorPosition) {
            case 'right':
                front.textContent = '后门';
                front.classList.add('podium-far');
                front.style.top = '48px'; front.style.left = '12px';
                back.textContent = '前门';
                back.classList.add('podium-near');
                back.style.bottom = '48px'; back.style.left = '12px';
                break;
            case 'left':
                front.textContent = '后门';
                front.classList.add('podium-far');
                front.style.top = '48px'; front.style.right = '12px';
                back.textContent = '前门';
                back.classList.add('podium-near');
                back.style.bottom = '48px'; back.style.right = '12px';
                break;
            case 'front-right-back-left':
                front.textContent = '后门';
                front.classList.add('podium-far');
                front.style.top = '48px'; front.style.left = '12px';
                back.textContent = '前门';
                back.classList.add('podium-near');
                back.style.bottom = '48px'; back.style.right = '12px';
                break;
            case 'front-left-back-right':
                front.textContent = '后门';
                front.classList.add('podium-far');
                front.style.top = '48px'; front.style.right = '12px';
                back.textContent = '前门';
                back.classList.add('podium-near');
                back.style.bottom = '48px'; back.style.left = '12px';
                break;
        }
    } else {
        front.textContent = '前门';
        back.textContent = '后门';
        switch (state.doorPosition) {
            case 'right':
                front.style.top = '48px'; front.style.right = '12px';
                back.style.bottom = '48px'; back.style.right = '12px';
                break;
            case 'left':
                front.style.top = '48px'; front.style.left = '12px';
                back.style.bottom = '48px'; back.style.left = '12px';
                break;
            case 'front-right-back-left':
                front.style.top = '48px'; front.style.right = '12px';
                back.style.bottom = '48px'; back.style.left = '12px';
                break;
            case 'front-left-back-right':
                front.style.top = '48px'; front.style.left = '12px';
                back.style.bottom = '48px'; back.style.right = '12px';
                break;
        }
    }
    },

    // ==================== Perspective Toggle ====================
    function togglePerspective() {
    const cl = document.getElementById('classroom');
    cl.classList.toggle('podium-view');
    const btn = document.getElementById('togglePerspective');
    UI.applyDoorPosition();
    if (cl.classList.contains('podium-view')) {
        btn.textContent = '📐 平面视图';
        Toast.info('已切换到讲台视角');
    } else {
        btn.textContent = '🎓 讲台视角';
        Toast.info('已切换到平面视图');
    }
    },

    // ==================== Screenshot Preview ====================
    _previewCanvas: null,
    function showPreviewModal() {
    document.getElementById('previewModal').classList.add('active');
    document.getElementById('previewFrame').innerHTML = '<p style="color:var(--text-tertiary);">点击"生成预览"查看效果</p>';
    UI._previewCanvas = null;
    },
    function generatePreview() {
    const frame = document.getElementById('previewFrame');
    frame.innerHTML = '<p style="color:var(--text-tertiary);">正在生成预览...</p>';
    const scale = parseInt(document.getElementById('previewScale').value) || 2;
    const includeDoors = document.getElementById('previewIncludeDoors').checked;
    const includePlatform = document.getElementById('previewIncludePlatform').checked;
    const includeTitle = document.getElementById('previewIncludeTitle').checked;
    const watermark = document.getElementById('previewWatermark').value.trim();
    const includeDate = document.getElementById('previewIncludeDate').checked;
    const bgColor = state.settings.screenshotTransparentBg ? null : state.settings.screenshotBgColor;
    const classroom = document.getElementById('classroom');
    // [FIX #6] Use onclone callback to position doors in cloned DOM instead of moving real DOM
    setTimeout(() => {
        html2canvas(classroom, {
            backgroundColor: bgColor, scale: scale, useCORS: true, allowTaint: true,
            logging: false, scrollX: 0, scrollY: 0,
            onclone: (clonedDoc) => {
                const clonedClassroom = clonedDoc.getElementById('classroom');
                if (!clonedClassroom) return;
                // Hide UI elements in clone
                const qi = clonedDoc.getElementById('quickInfo');
                if (qi) qi.style.display = 'none';
                const legend = clonedDoc.getElementById('seatLegend');
                if (legend) legend.style.display = 'none';
                const podium = clonedDoc.querySelector('.podium-toggle');
                if (podium) podium.style.display = 'none';
                const hmLegend = clonedDoc.getElementById('heatmapLegend');
                if (hmLegend) hmLegend.style.display = 'none';
                // Handle platform seats
                if (!includePlatform) {
                    const pL = clonedDoc.getElementById('platformLeft'), pR = clonedDoc.getElementById('platformRight');
                    if (pL) pL.style.display = 'none';
                    if (pR) pR.style.display = 'none';
                }
                // Handle doors - position absolutely in cloned classroom
                if (includeDoors) {
                    const frontDoor = clonedDoc.getElementById('frontDoor');
                    const backDoor = clonedDoc.getElementById('backDoor');
                    if (frontDoor) {
                        frontDoor.style.display = 'block';
                        frontDoor.style.position = 'absolute';
                        clonedClassroom.appendChild(frontDoor);
                    }
                    if (backDoor) {
                        backDoor.style.display = 'block';
                        backDoor.style.position = 'absolute';
                        clonedClassroom.appendChild(backDoor);
                    }
                }
            }
        }).then(canvas => {
            // Add watermark
            if (watermark) {
                const ctx = canvas.getContext('2d');
                ctx.save();
                ctx.globalAlpha = 0.12;
                ctx.font = `${Math.floor(canvas.width / 20)}px ${getComputedStyle(document.body).getPropertyValue('--font-sans')}`;
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(-Math.PI / 6);
                ctx.fillText(watermark, 0, 0);
                ctx.restore();
            }
            // Add date
            if (includeDate) {
                const ctx = canvas.getContext('2d');
                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.font = `${Math.floor(canvas.width / 60)}px sans-serif`;
                ctx.fillStyle = '#666';
                ctx.textAlign = 'right';
                const now = new Date();
                ctx.fillText(`${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`, canvas.width - 20, canvas.height - 15);
                ctx.restore();
            }
            UI._previewCanvas = canvas;
            frame.innerHTML = '';
            const img = document.createElement('img');
            img.src = canvas.toDataURL();
            img.style.maxWidth = '100%';
            img.style.borderRadius = '8px';
            frame.appendChild(img);
            // [FIX #6] No DOM restore needed - onclone handles cloned tree
        }).catch(err => {
            frame.innerHTML = '<p style="color:var(--danger);">预览生成失败</p>';
            console.error(err);
        });
    }, 100);
    },
    function downloadPreview() {
    if (!UI._previewCanvas) { Toast.warning('请先生成预览'); return; }
    const format = document.getElementById('previewFormat').value;
    const quality = parseFloat(document.getElementById('previewQuality').value);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const dataUrl = UI._previewCanvas.toDataURL(mimeType, quality);
    const link = document.createElement('a');
    link.download = `座位表_${UI.getTimestamp()}.${ext}`;
    link.href = dataUrl;
    link.click();
    Toast.success(`截图已导出 (${format.toUpperCase()})`);
    addLog('📸', `导出截图 (${format.toUpperCase()})`);
    document.getElementById('previewModal').classList.remove('active');
    },

    // ==================== Print ====================
    function printSeats() {
    document.getElementById('printDate').textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    // Calculate stats for print header
    const drawn = state.drawnStudents;
    const total = drawn.length;
    const male = drawn.filter(s => s.gender === state.settings.maleMapping).length;
    const female = drawn.filter(s => s.gender === state.settings.femaleMapping).length;
    const lunch = drawn.filter(s => s.lunch).length;
    document.getElementById('printStats').textContent = `总人数：${total}　男生：${male}　女生：${female}　午休：${lunch}`;
    window.print();
    },

    // [FEATURE] 家长会视图 - A4打印优化
    function printParentView() {
    // Create a temporary print-optimized view
    const printWindow = window.open('', '_blank');
    if (!printWindow) { Toast.error('请允许弹出窗口以打印'); return; }

    const drawn = state.drawnStudents;
    const total = drawn.length;
    const male = drawn.filter(s => s.gender === state.settings.maleMapping).length;
    const female = drawn.filter(s => s.gender === state.settings.femaleMapping).length;

    let tableHtml = '<table style="width:100%;border-collapse:collapse;margin:20px 0;">';
    tableHtml += '<tr style="background:#f5f5f5;">';
    if (state.settings.exportIncludeSeatNumber) tableHtml += '<th style="border:1px solid #ddd;padding:8px;text-align:center;">座位号</th>';
    tableHtml += '<th style="border:1px solid #ddd;padding:8px;text-align:center;">姓名</th>';
    if (state.settings.exportIncludeGender) tableHtml += '<th style="border:1px solid #ddd;padding:8px;text-align:center;">性别</th>';
    tableHtml += '</tr>';

    const allSeats = [...state.drawOrder].sort((a, b) => a.number - b.number);
    allSeats.forEach(seat => {
        if (!seat.student) return;
        const s = seat.student;
        const genderBorder = s.gender === 'male' ? 'border-left:3px solid #007AFF;' : 'border-left:3px solid #FF2D55;';
        tableHtml += `<tr>`;
        if (state.settings.exportIncludeSeatNumber) tableHtml += `<td style="border:1px solid #ddd;padding:8px;text-align:center;${genderBorder}">${seat.number}</td>`;
        tableHtml += `<td style="border:1px solid #ddd;padding:8px;text-align:center;font-weight:600;${genderBorder}">${s.name}</td>`;
        if (state.settings.exportIncludeGender) tableHtml += `<td style="border:1px solid #ddd;padding:8px;text-align:center;">${s.gender === 'male' ? '♂' : '♀'}</td>`;
        tableHtml += '</tr>';
    });
    tableHtml += '</table>';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>家长会座位表</title>
<style>
    @page { size: A4; margin: 15mm; }
    body { font-family: -apple-system, 'PingFang SC', sans-serif; padding: 20px; color: #333; }
    h1 { text-align: center; font-size: 22px; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #666; font-size: 13px; margin-bottom: 20px; }
    .stats { text-align: center; color: #888; font-size: 12px; margin-bottom: 16px; }
    @media print { body { padding: 0; } }
</style></head><body>
<h1>📋 教室座位表</h1>
<div class="subtitle">${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
<div class="stats">总人数：${total}　男生：${male}　女生：${female}</div>
${tableHtml}
<div style="text-align:center;color:#aaa;font-size:11px;margin-top:20px;">— 此表由教室座位智能编排系统生成 —</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    Toast.success('家长会视图已生成，正在准备打印');
    },

    // ==================== Export with timestamp ====================
    function getTimestamp() {
    const d = new Date();
    return `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}_${d.getHours().toString().padStart(2,'0')}${d.getMinutes().toString().padStart(2,'0')}`;
    },

    // ==================== Help Modal Tab Switching ====================
    function openHelpTab(tabName) {
    document.getElementById('helpModal').classList.add('active');
    document.querySelectorAll('#helpTabBar .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('#helpModal .tab-content').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tabName));
    if (tabName === 'algorithm') CompositeEval.renderExplanation();
    },
