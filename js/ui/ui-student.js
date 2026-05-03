// ==================== Student Info Popup ====================
    function showStudentInfo(seat) {
    if (!seat.student) return;
    const s = seat.student;
    const modal = document.getElementById('studentDetailModal');
    document.getElementById('studentDetailName').textContent = `${s.name} 的详细信息`;

    let html = '';

    // Basic info section
    html += `<div class="detail-section"><div class="detail-section-title">👤 基本信息</div><div class="detail-grid">`;
    html += `<div class="detail-item"><span class="detail-item-label">姓名</span><span class="detail-item-value">${escapeHtml(s.name)}</span></div>`;
    html += `<div class="detail-item"><span class="detail-item-label">性别</span><span class="detail-item-value">${s.gender === 'male' ? '♂ 男' : '♀ 女'}</span></div>`;
    html += `<div class="detail-item"><span class="detail-item-label">午休</span><span class="detail-item-value">${s.lunch ? '💤 是' : '否'}</span></div>`;
    html += `<div class="detail-item"><span class="detail-item-label">座位</span><span class="detail-item-value">${UI.seatLabel(seat)}</span></div>`;
    if (s.personality) html += `<div class="detail-item"><span class="detail-item-label">性格</span><span class="detail-item-value">${escapeHtml(s.personality)}</span></div>`;
    if (s.position) html += `<div class="detail-item"><span class="detail-item-label">职务</span><span class="detail-item-value">${escapeHtml(s.position)}</span></div>`;
    if (s.hobbies && s.hobbies.length > 0) html += `<div class="detail-item" style="grid-column:1/-1;"><span class="detail-item-label">爱好</span><span class="detail-item-value">${s.hobbies.map(h => escapeHtml(h)).join(' / ')}</span></div>`;
    if (s.pinned) html += `<div class="detail-item"><span class="detail-item-label">状态</span><span class="detail-item-value">📌 已固定</span></div>`;
    html += `</div></div>`;

    // Scores section
    const scores = s.scores || {};
    const scoreEntries = Object.entries(scores).filter(([k, v]) => v !== null && v !== undefined);
    if (scoreEntries.length > 0) {
        html += `<div class="detail-section"><div class="detail-section-title">📊 各科成绩</div>`;
        scoreEntries.forEach(([subj, score]) => {
            const color = score >= 90 ? 'var(--success)' : score >= 80 ? 'var(--primary)' : score >= 70 ? 'var(--warning)' : score >= 60 ? '#FF9500' : 'var(--danger)';
            html += `<div class="detail-score-bar"><span class="detail-score-label">${subj}</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${score}%;background:${color};">${score}</div></div></div>`;
        });
        html += `</div>`;
    }

    // Composite evaluation section
    const compositeScore = CompositeEval.getScore(s);
    const avgScore = CompositeEval.getAvgScore(s);
    html += `<div class="detail-section"><div class="detail-section-title">🏆 综合评价</div>`;
    html += `<div class="detail-grid">`;
    html += `<div class="detail-item"><span class="detail-item-label">综合评分</span><span class="detail-item-value" style="color:var(--primary);font-size:16px;">${compositeScore}</span></div>`;
    html += `<div class="detail-item"><span class="detail-item-label">平均成绩</span><span class="detail-item-value">${avgScore ?? 'N/A'}</span></div>`;
    html += `</div>`;
    // Dimension breakdown
    const w = state.settings.weights;
    html += `<div style="margin-top:10px;">`;
    if (w.academic > 0 && avgScore !== null) html += `<div class="detail-score-bar"><span class="detail-score-label">学业</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${avgScore}%;background:var(--primary);">${avgScore}</div></div></div>`;
    if (w.personality > 0 && s.personality) { const ps = s.personality === '中性' ? 80 : s.personality === '外向' ? 70 : 65; html += `<div class="detail-score-bar"><span class="detail-score-label">性格</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${ps}%;background:var(--success);">${ps}</div></div></div>`; }
    if (w.hobby > 0 && s.hobbies?.length > 0) { const hs = Math.min(100, 50 + s.hobbies.length * 10); html += `<div class="detail-score-bar"><span class="detail-score-label">爱好</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${hs}%;background:var(--warning);">${hs}</div></div></div>`; }
    if (w.position > 0 && s.position) { const posScores = { '班长': 95, '副班长': 90, '学习委员': 90, '体育委员': 85, '文艺委员': 85, '劳动委员': 80, '小组长': 75, '课代表': 80 }; const poss = posScores[s.position] || 60; html += `<div class="detail-score-bar"><span class="detail-score-label">职务</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${poss}%;background:var(--info);">${poss}</div></div></div>`; }
    html += `</div></div>`;

    document.getElementById('studentDetailContent').innerHTML = html;
    modal.classList.add('active');

    // Close handlers
    document.getElementById('closeStudentDetail').onclick = () => modal.classList.remove('active');
    document.getElementById('closeStudentDetailBtn').onclick = () => modal.classList.remove('active');
    document.getElementById('locateStudentBtn').style.display = '';
    document.getElementById('locateStudentBtn').onclick = () => {
        modal.classList.remove('active');
        seat.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        seat.element.classList.add('selected');
        setTimeout(() => seat.element.classList.remove('selected'), 2000);
    };
    // [FIX #8] Edit button handler
    document.getElementById('editStudentBtn').style.display = '';
    document.getElementById('editStudentBtn').onclick = () => {
        const content = document.getElementById('studentDetailContent');
        const editHtml = `<div class="detail-section"><div class="detail-section-title">✏️ 编辑信息</div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">姓名</label><input class="form-input" id="editName" value="${escapeHtml(s.name)}"></div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">性别</label><select class="form-input" id="editGender"><option value="male" ${s.gender==='male'?'selected':''}>♂ 男</option><option value="female" ${s.gender==='female'?'selected':''}>♀ 女</option></select></div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">午休</label><select class="form-input" id="editLunch"><option value="true" ${s.lunch?'selected':''}>是</option><option value="false" ${!s.lunch?'selected':''}>否</option></select></div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">性格</label><input class="form-input" id="editPersonality" value="${escapeHtml(s.personality||'')}"></div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">职务</label><input class="form-input" id="editPosition" value="${escapeHtml(s.position||'')}"></div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">爱好 (逗号分隔)</label><input class="form-input" id="editHobbies" value="${escapeHtml((s.hobbies||[]).join(','))}"></div>
            <button class="btn btn-primary" id="saveEditBtn" style="margin-top:8px;">💾 保存</button>
        </div>`;
        content.innerHTML = editHtml;
        document.getElementById('editStudentBtn').style.display = 'none';
        document.getElementById('saveEditBtn').onclick = () => {
            s.name = document.getElementById('editName').value.trim() || s.name;
            s.gender = document.getElementById('editGender').value;
            s.lunch = document.getElementById('editLunch').value === 'true';
            s.personality = document.getElementById('editPersonality').value.trim() || null;
            s.position = document.getElementById('editPosition').value.trim() || null;
            const hobbiesStr = document.getElementById('editHobbies').value.trim();
            s.hobbies = hobbiesStr ? hobbiesStr.split(',').map(h => h.trim()).filter(h => h) : [];
            UI.updateSeatDisplay(seat);
            UI.updateStats();
            UI.renderPool();
            modal.classList.remove('active');
            Toast.success('学生信息已更新');
        };
    };
    },

    // ==================== Student Pool ====================
    function renderPool() {
    const list = document.getElementById('poolList');
    let students = [...state.remainingStudents];
    // Filter
    if (state.poolFilter === 'male') students = students.filter(s => s.gender === 'male');
    else if (state.poolFilter === 'female') students = students.filter(s => s.gender === 'female');
    else if (state.poolFilter === 'lunch') students = students.filter(s => s.lunch);
    else if (state.poolFilter === 'no-lunch') students = students.filter(s => !s.lunch);
    // [FIX #4] Search using unified matchStudent
    if (state.poolSearch) {
        students = students.filter(s => matchStudent(s, state.poolSearch.toLowerCase()));
    }
    if (students.length === 0) { list.innerHTML = '<div class="pool-empty">无匹配学生</div>'; return; }
    // [FEATURE #23] Virtual scrolling / pagination for large pools
    const POOL_PAGE = 80;
    const displayStudents = students.slice(0, POOL_PAGE);
    list.innerHTML = displayStudents.map(s => {
        const meta = [];
        meta.push(s.gender === 'male' ? '♂' : '♀');
        if (s.lunch) meta.push('💤');
        if (s.score !== null && s.score !== undefined) meta.push(`📊${s.score}`);
        return `<div class="pool-item" draggable="true" data-student-id="${s.id}">
            <span class="pool-item-name">${escapeHtml(s.name)}</span>
            <span class="pool-item-meta">${meta.join(' ')}</span>
        </div>`;
    }).join('');
    // [FEATURE #23] Load more button for large pools
    if (students.length > POOL_PAGE) {
        list.innerHTML += `<div class="pool-empty" style="cursor:pointer;" id="poolLoadMore">显示 ${POOL_PAGE}/${students.length} — 点击加载更多</div>`;
    }
    // Drag from pool + Click-to-place
    list.querySelectorAll('.pool-item').forEach(item => {
        item.addEventListener('dragstart', e => {
            const id = parseInt(item.dataset.studentId);
            e.dataTransfer.setData('text/pool-student', JSON.stringify({ id }));
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('click', e => {
            e.stopPropagation();
            const id = parseInt(item.dataset.studentId);
            if (state.selectedPoolStudent === id) {
                // Deselect
                state.selectedPoolStudent = null;
                item.classList.remove('pool-selected');
                document.getElementById('poolClickHint')?.classList.remove('visible');
                document.querySelectorAll('.seat').forEach(s => s.classList.remove('pool-target'));
            } else {
                // Select this student
                state.selectedPoolStudent = id;
                list.querySelectorAll('.pool-item').forEach(pi => pi.classList.remove('pool-selected'));
                item.classList.add('pool-selected');
                document.getElementById('poolClickHint')?.classList.add('visible');
                document.querySelectorAll('.seat:not(.disabled)').forEach(s => {
                    if (!state.seats.find(ss => ss.element === s)?.student) s.classList.add('pool-target');
                });
                Toast.info('请点击空座位落座，或按 ESC 取消');
            }
        });
    });
    // [FIX #5] Load more click handler
    const loadMoreBtn = document.getElementById('poolLoadMore');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            const remainingHtml = students.slice(POOL_PAGE).map(s => {
                const meta = [s.gender === 'male' ? '♂' : '♀'];
                if (s.lunch) meta.push('💤');
                if (s.score !== null && s.score !== undefined) meta.push(`📊${s.score}`);
                return `<div class="pool-item" draggable="true" data-student-id="${s.id}">
                    <span class="pool-item-name">${escapeHtml(s.name)}</span>
                    <span class="pool-item-meta">${meta.join(' ')}</span>
                </div>`;
            }).join('');
            loadMoreBtn.insertAdjacentHTML('beforebegin', remainingHtml);
            loadMoreBtn.remove();
            list.querySelectorAll('.pool-item').forEach(item => {
                if (item._bound) return;
                item._bound = true;
                item.addEventListener('dragstart', e => {
                    const id = parseInt(item.dataset.studentId);
                    e.dataTransfer.setData('text/pool-student', JSON.stringify({ id }));
                    e.dataTransfer.effectAllowed = 'move';
                });
                item.addEventListener('click', e => {
                    e.stopPropagation();
                    const id = parseInt(item.dataset.studentId);
                    if (state.selectedPoolStudent === id) {
                        state.selectedPoolStudent = null;
                        item.classList.remove('pool-selected');
                        document.getElementById('poolClickHint')?.classList.remove('visible');
                        document.querySelectorAll('.seat').forEach(s => s.classList.remove('pool-target'));
                    } else {
                        state.selectedPoolStudent = id;
                        list.querySelectorAll('.pool-item').forEach(pi => pi.classList.remove('pool-selected'));
                        item.classList.add('pool-selected');
                        document.getElementById('poolClickHint')?.classList.add('visible');
                        document.querySelectorAll('.seat:not(.disabled)').forEach(s => {
                            if (!state.seats.find(ss => ss.element === s)?.student) s.classList.add('pool-target');
                        });
                        Toast.info('请点击空座位落座，或按 ESC 取消');
                    }
                });
            });
        });
    }
    },
    function showStats() {
    const content = document.getElementById('statsContent');
    const drawn = state.drawnStudents;
    const total = state.students.length;
    if (total === 0) { content.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:20px;">暂无数据</p>'; document.getElementById('statsModal').classList.add('active'); return; }

    const males = drawn.filter(s => s.gender === 'male').length;
    const females = drawn.filter(s => s.gender === 'female').length;
    const lunchCount = drawn.filter(s => s.lunch).length;
    const scores = drawn.filter(s => s.score !== null && s.score !== undefined).map(s => s.score);
    const avgScore = scores.length > 0 ? (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1) : 'N/A';
    const maxScore = scores.length > 0 ? Math.max(...scores) : 'N/A';
    const minScore = scores.length > 0 ? Math.min(...scores) : 'N/A';

    // Score distribution
    const ranges = [[90,100,'优秀'],[80,89,'良好'],[70,79,'中等'],[60,69,'及格'],[0,59,'不及格']];
    const dist = ranges.map(([lo,label]) => ({ label, count: scores.filter(s => s >= lo && s <= (lo === 0 ? 59 : lo + (lo === 90 ? 10 : 9) )).length }));
    // Fix ranges properly
    const distFixed = [
        { label: '优秀 (90-100)', count: scores.filter(s => s >= 90).length },
        { label: '良好 (80-89)', count: scores.filter(s => s >= 80 && s < 90).length },
        { label: '中等 (70-79)', count: scores.filter(s => s >= 70 && s < 80).length },
        { label: '及格 (60-69)', count: scores.filter(s => s >= 60 && s < 70).length },
        { label: '不及格 (<60)', count: scores.filter(s => s < 60).length },
    ];
    const maxDist = Math.max(...distFixed.map(d => d.count), 1);

    // Front vs back row scores
    const frontScores = [], backScores = [];
    state.seats.forEach(s => {
        if (s.student && s.student.score !== null && s.student.score !== undefined) {
            if (s.row < Math.floor(state.rows / 2)) frontScores.push(s.student.score);
            else backScores.push(s.student.score);
        }
    });
    const frontAvg = frontScores.length > 0 ? (frontScores.reduce((a,b)=>a+b,0)/frontScores.length).toFixed(1) : 'N/A';
    const backAvg = backScores.length > 0 ? (backScores.reduce((a,b)=>a+b,0)/backScores.length).toFixed(1) : 'N/A';

    content.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${drawn.length}</div><div class="stat-label">已抽取</div></div>
            <div class="stat-card"><div class="stat-value">${total - drawn.length}</div><div class="stat-label">剩余</div></div>
            <div class="stat-card"><div class="stat-value">${males}:${females}</div><div class="stat-label">男女比</div></div>
            <div class="stat-card"><div class="stat-value">${lunchCount}</div><div class="stat-label">午休人数</div></div>
            <div class="stat-card"><div class="stat-value">${avgScore}</div><div class="stat-label">平均分</div></div>
            <div class="stat-card"><div class="stat-value">${scores.length > 0 ? maxScore + '/' + minScore : 'N/A'}</div><div class="stat-label">最高/最低</div></div>
        </div>
        ${scores.length > 0 ? `
        <div class="stats-chart">
            <div class="stats-chart-title">📊 成绩分布</div>
            ${distFixed.map(d => `
                <div class="stats-bar">
                    <span class="stats-bar-label">${d.label}</span>
                    <div class="stats-bar-track">
                        <div class="stats-bar-fill" style="width:${(d.count/maxDist*100)}%;background:${d.count > 0 ? 'var(--primary)' : 'var(--bg-tertiary)'};">
                            ${d.count > 0 ? d.count : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="stats-chart">
            <div class="stats-chart-title">📍 前后排成绩对比</div>
            <div class="stats-bar">
                <span class="stats-bar-label">前排均分</span>
                <div class="stats-bar-track">
                    <div class="stats-bar-fill" style="width:${frontAvg !== 'N/A' ? frontAvg : 0}%;background:var(--success);">${frontAvg}</div>
                </div>
            </div>
            <div class="stats-bar">
                <span class="stats-bar-label">后排均分</span>
                <div class="stats-bar-track">
                    <div class="stats-bar-fill" style="width:${backAvg !== 'N/A' ? backAvg : 0}%;background:var(--warning);">${backAvg}</div>
                </div>
            </div>
        </div>` : '<p style="color:var(--text-tertiary);text-align:center;">未导入成绩数据，跳过成绩统计</p>'}
    `;
    document.getElementById('statsModal').classList.add('active');
    },

    // ==================== Pool Search Dropdown ====================
    function renderPoolSearchDropdown(query) {
    const dropdown = document.getElementById('poolSearchDropdown');
    if (!dropdown) return;
    if (!query) { dropdown.classList.remove('open'); dropdown.style.top = ''; dropdown.style.left = ''; dropdown.style.width = ''; return; }

    // [FIX] Position dropdown with fixed coords to escape overflow:hidden
    const input = document.getElementById('poolSearch');
    if (input) {
        const rect = input.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 4) + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = rect.width + 'px';
    }

    // [FIX #4] Use unified matchStudent
    const q = query.toLowerCase();
    const students = state.remainingStudents.filter(s => matchStudent(s, q)).slice(0, 10);

    if (students.length === 0) { dropdown.classList.remove('open'); return; }

    dropdown.innerHTML = students.map(s => {
        const meta = [];
        meta.push(s.gender === 'male' ? '♂' : '♀');
        if (s.lunch) meta.push('💤');
        const avg = CompositeEval.getAvgScore(s);
        if (avg !== null) meta.push(`📊${avg}`);
        if (s.personality) meta.push(s.personality);
        if (s.position) meta.push(s.position);
        return `<div class="smart-search-item" data-student-id="${s.id}"><span>${escapeHtml(s.name)}</span><span class="match-hint">${meta.join(' ')}</span></div>`;
    }).join('');

    dropdown.classList.add('open');
    dropdown.querySelectorAll('.smart-search-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.studentId);
            const student = state.remainingStudents.find(s => s.id === id);
            if (student) UI.showStudentDetailFromPool(student);
            dropdown.classList.remove('open');
            document.getElementById('poolSearch').value = '';
        });
    });
    },

    function showStudentDetailFromPool(student) {
    const modal = document.getElementById('studentDetailModal');
    document.getElementById('studentDetailName').textContent = `${student.name} 的详细信息`;

    let html = '';
    html += `<div class="detail-section"><div class="detail-section-title">👤 基本信息</div><div class="detail-grid">`;
    html += `<div class="detail-item"><span class="detail-item-label">姓名</span><span class="detail-item-value">${escapeHtml(student.name)}</span></div>`;
    html += `<div class="detail-item"><span class="detail-item-label">性别</span><span class="detail-item-value">${student.gender === 'male' ? '♂ 男' : '♀ 女'}</span></div>`;
    html += `<div class="detail-item"><span class="detail-item-label">午休</span><span class="detail-item-value">${student.lunch ? '💤 是' : '否'}</span></div>`;
    html += `<div class="detail-item"><span class="detail-item-label">状态</span><span class="detail-item-value">⏳ 待抽取</span></div>`;
    if (student.personality) html += `<div class="detail-item"><span class="detail-item-label">性格</span><span class="detail-item-value">${escapeHtml(student.personality)}</span></div>`;
    if (student.position) html += `<div class="detail-item"><span class="detail-item-label">职务</span><span class="detail-item-value">${escapeHtml(student.position)}</span></div>`;
    if (student.hobbies?.length > 0) html += `<div class="detail-item" style="grid-column:1/-1;"><span class="detail-item-label">爱好</span><span class="detail-item-value">${student.hobbies.map(h => escapeHtml(h)).join(' / ')}</span></div>`;
    html += `</div></div>`;

    const scores = student.scores || {};
    const scoreEntries = Object.entries(scores).filter(([k, v]) => v !== null && v !== undefined);
    if (scoreEntries.length > 0) {
        html += `<div class="detail-section"><div class="detail-section-title">📊 各科成绩</div>`;
        scoreEntries.forEach(([subj, score]) => {
            const color = score >= 90 ? 'var(--success)' : score >= 80 ? 'var(--primary)' : score >= 70 ? 'var(--warning)' : score >= 60 ? '#FF9500' : 'var(--danger)';
            html += `<div class="detail-score-bar"><span class="detail-score-label">${subj}</span><div class="detail-score-track"><div class="detail-score-fill" style="width:${score}%;background:${color};">${score}</div></div></div>`;
        });
        html += `</div>`;
    }

    const compositeScore = CompositeEval.getScore(student);
    const avgScore = CompositeEval.getAvgScore(student);
    html += `<div class="detail-section"><div class="detail-section-title">🏆 综合评价</div>`;
    html += `<div class="detail-grid">`;
    html += `<div class="detail-item"><span class="detail-item-label">综合评分</span><span class="detail-item-value" style="color:var(--primary);font-size:16px;">${compositeScore}</span></div>`;
    html += `<div class="detail-item"><span class="detail-item-label">平均成绩</span><span class="detail-item-value">${avgScore ?? 'N/A'}</span></div>`;
    html += `</div></div>`;

    document.getElementById('studentDetailContent').innerHTML = html;
    modal.classList.add('active');
    document.getElementById('closeStudentDetail').onclick = () => modal.classList.remove('active');
    document.getElementById('closeStudentDetailBtn').onclick = () => modal.classList.remove('active');
    document.getElementById('locateStudentBtn').style.display = 'none';
    document.getElementById('locateStudentBtn').onclick = () => modal.classList.remove('active');
    // [FIX #8] Edit button handler for pool students
    document.getElementById('editStudentBtn').style.display = '';
    document.getElementById('editStudentBtn').onclick = () => {
        const content = document.getElementById('studentDetailContent');
        const editHtml = `<div class="detail-section"><div class="detail-section-title">✏️ 编辑信息</div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">姓名</label><input class="form-input" id="editName" value="${escapeHtml(student.name)}"></div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">性别</label><select class="form-input" id="editGender"><option value="male" ${student.gender==='male'?'selected':''}>♂ 男</option><option value="female" ${student.gender==='female'?'selected':''}>♀ 女</option></select></div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">午休</label><select class="form-input" id="editLunch"><option value="true" ${student.lunch?'selected':''}>是</option><option value="false" ${!student.lunch?'selected':''}>否</option></select></div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">性格</label><input class="form-input" id="editPersonality" value="${escapeHtml(student.personality||'')}"></div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">职务</label><input class="form-input" id="editPosition" value="${escapeHtml(student.position||'')}"></div>
            <div class="form-group" style="margin-bottom:8px;"><label class="form-label">爱好 (逗号分隔)</label><input class="form-input" id="editHobbies" value="${escapeHtml((student.hobbies||[]).join(','))}"></div>
            <button class="btn btn-primary" id="saveEditBtn" style="margin-top:8px;">💾 保存</button>
        </div>`;
        content.innerHTML = editHtml;
        document.getElementById('editStudentBtn').style.display = 'none';
        document.getElementById('saveEditBtn').onclick = () => {
            student.name = document.getElementById('editName').value.trim() || student.name;
            student.gender = document.getElementById('editGender').value;
            student.lunch = document.getElementById('editLunch').value === 'true';
            student.personality = document.getElementById('editPersonality').value.trim() || null;
            student.position = document.getElementById('editPosition').value.trim() || null;
            const hobbiesStr = document.getElementById('editHobbies').value.trim();
            student.hobbies = hobbiesStr ? hobbiesStr.split(',').map(h => h.trim()).filter(h => h) : [];
            UI.renderPool();
            modal.classList.remove('active');
            Toast.success('学生信息已更新');
        };
    };
    },

    // ==================== Full Student Search ====================
    _fullSearchFilter: 'all',
    function performFullStudentSearch(query, filter) {
    const results = document.getElementById('fullSearchResults');
    if (!results) return;

    const allStudents = state.students;
    if (!query && filter === 'all') {
        results.innerHTML = '<div class="pool-empty">输入关键词搜索全部学生</div>';
        return;
    }

    // [FEATURE #8] Parse advanced query syntax
    const parsed = parseQuery(query || '');
    const textQ = parsed.text;
    const filters = parsed.filters;

    let filtered = allStudents;

    // Apply status filter
    if (filter === 'seated') {
        filtered = filtered.filter(s => state.drawnStudents.some(d => d.id === s.id));
    } else if (filter === 'pending') {
        filtered = filtered.filter(s => state.remainingStudents.some(r => r.id === s.id));
    } else if (filter === 'pinned') {
        filtered = filtered.filter(s => s.pinned);
    } else if (filter === 'male') {
        filtered = filtered.filter(s => s.gender === 'male');
    } else if (filter === 'female') {
        filtered = filtered.filter(s => s.gender === 'female');
    }

    // [FIX #4] Apply search query using matchStudent
    if (textQ) {
        filtered = filtered.filter(s => matchStudent(s, textQ));
    }

    // [FEATURE #8] Apply parsed filters
    if (filters.gender) {
        const g = filters.gender === '男' || filters.gender === 'male' ? 'male' : 'female';
        filtered = filtered.filter(s => s.gender === g);
    }
    if (filters.lunch) {
        const want = filters.lunch === '是' || filters.lunch === 'yes' || filters.lunch === '1';
        filtered = filtered.filter(s => s.lunch === want);
    }
    if (filters.personality) {
        filtered = filtered.filter(s => s.personality === filters.personality);
    }
    if (filters.position) {
        filtered = filtered.filter(s => s.position && s.position.includes(filters.position));
    }
    if (filters.scoreAbove) {
        const min = parseInt(filters.scoreAbove);
        filtered = filtered.filter(s => { const avg = CompositeEval.getAvgScore(s); return avg !== null && avg > min; });
    }
    if (filters.scoreBelow) {
        const max = parseInt(filters.scoreBelow);
        filtered = filtered.filter(s => { const avg = CompositeEval.getAvgScore(s); return avg !== null && avg < max; });
    }

    if (filtered.length === 0) {
        results.innerHTML = '<div class="pool-empty">未找到匹配的学生</div>';
        return;
    }

    // [FEATURE #23] Virtual scrolling / load more for large result sets
    const PAGE_SIZE = 30;
    const limited = filtered.slice(0, PAGE_SIZE);

    results.innerHTML = limited.map(s => {
        const isSeated = state.drawnStudents.some(d => d.id === s.id);
        const seat = isSeated ? [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === s.id) : null;
        const statusBadge = isSeated
            ? `<span class="fsi-badge seated">🪑 ${seat ? UI.seatLabel(seat) : '已排座'}</span>`
            : '<span class="fsi-badge pending">⏳ 待抽取</span>';

        const meta = [];
        meta.push(s.gender === 'male' ? '♂' : '♀');
        if (s.lunch) meta.push('💤');
        if (s.personality) meta.push(escapeHtml(s.personality));
        if (s.position) meta.push(escapeHtml(s.position));

        const avg = CompositeEval.getAvgScore(s);
        const scoreStr = avg !== null ? `📊${avg}` : '';

        return `<div class="full-search-item" data-student-id="${s.id}" data-seated="${isSeated}">
            <div class="fsi-left">
                <div>
                    <div class="fsi-name">${escapeHtml(s.name)}${s.pinned ? ' 📌' : ''}</div>
                    <div class="fsi-meta">
                        ${meta.map(m => `<span class="fsi-badge">${m}</span>`).join('')}
                        ${scoreStr ? `<span class="fsi-badge">${scoreStr}</span>` : ''}
                    </div>
                </div>
            </div>
            ${statusBadge}
        </div>`;
    }).join('');

    if (filtered.length > PAGE_SIZE) {
        const loadMore = document.createElement('div');
        loadMore.className = 'pool-empty';
        loadMore.style.cursor = 'pointer';
        loadMore.textContent = `显示前 ${PAGE_SIZE} 条，共 ${filtered.length} 条结果 — 点击加载更多`;
        loadMore.addEventListener('click', () => {
            const nextBatch = filtered.slice(PAGE_SIZE, PAGE_SIZE * 2);
            nextBatch.forEach(s => {
                const isSeated = state.drawnStudents.some(d => d.id === s.id);
                const seat = isSeated ? [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === s.id) : null;
                const statusBadge = isSeated ? `<span class="fsi-badge seated">🪑 ${seat ? UI.seatLabel(seat) : '已排座'}</span>` : '<span class="fsi-badge pending">⏳ 待抽取</span>';
                const meta = [s.gender === 'male' ? '♂' : '♀'];
                if (s.lunch) meta.push('💤');
                if (s.personality) meta.push(escapeHtml(s.personality));
                if (s.position) meta.push(escapeHtml(s.position));
                const avg = CompositeEval.getAvgScore(s);
                const scoreStr = avg !== null ? `📊${avg}` : '';
                const item = document.createElement('div');
                item.className = 'full-search-item';
                item.dataset.studentId = s.id;
                item.dataset.seated = isSeated ? 'true' : 'false';
                item.innerHTML = `<div class="fsi-left"><div><div class="fsi-name">${escapeHtml(s.name)}${s.pinned ? ' 📌' : ''}</div><div class="fsi-meta">${meta.map(m => `<span class="fsi-badge">${m}</span>`).join('')}${scoreStr ? `<span class="fsi-badge">${scoreStr}</span>` : ''}</div></div></div>${statusBadge}`;
                results.insertBefore(item, loadMore);
                item.addEventListener('click', () => {
                    if (isSeated) { const st = [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === s.id); if (st) UI.showStudentInfo(st); }
                    else UI.showStudentDetailFromPool(s);
                });
            });
            loadMore.remove();
        });
        results.appendChild(loadMore);
    }

    // Bind click handlers
    results.querySelectorAll('.full-search-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.studentId);
            const student = allStudents.find(s => s.id === id);
            if (!student) return;
            const isSeated = item.dataset.seated === 'true';
            if (isSeated) {
                const seat = [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === id);
                if (seat) UI.showStudentInfo(seat);
            } else {
                UI.showStudentDetailFromPool(student);
            }
        });
        // [FEATURE] Double-click to locate seat or place student
        item.addEventListener('dblclick', () => {
            const id = parseInt(item.dataset.studentId);
            const student = allStudents.find(s => s.id === id);
            if (!student) return;
            const isSeated = item.dataset.seated === 'true';
            if (isSeated) {
                // Scroll to and highlight the seat
                const seat = [...state.seats, state.platformLeft, state.platformRight].find(ss => ss.student?.id === id);
                if (seat && seat.element) {
                    seat.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    seat.element.classList.add('selected');
                    setTimeout(() => seat.element.classList.remove('selected'), 2000);
                    Toast.info(`${student.name} 的座位已定位`);
                }
            } else {
                // Try to place student in selected empty seat
                if (state.selectedPoolStudent !== null) {
                    // Already in pool-select mode, just confirm
                    Toast.info('请点击空座位落座');
                } else {
                    // Auto-select this student and highlight empty seats
                    state.selectedPoolStudent = student.id;
                    document.querySelectorAll('.seat:not(.disabled)').forEach(s => {
                        if (!state.seats.find(ss => ss.element === s)?.student) s.classList.add('pool-target');
                    });
                    document.getElementById('poolClickHint')?.classList.add('visible');
                    Toast.info(`${student.name} 已选中，请点击空座位落座`);
                }
            }
        });
    });
    },
