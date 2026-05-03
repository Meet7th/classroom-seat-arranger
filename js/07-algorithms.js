// ==================== Composite Evaluation Engine ====================
const CompositeEval = {
    /**
     * Calculate composite evaluation score for a student
     * @param {Object} student - Student data
     * @returns {number} 0-100 composite score
     */
    getScore(student) {
        if (!student) return 0;
        const w = state.settings.weights;
        let totalWeight = 0, totalScore = 0;

        // Academic (average of all subject scores)
        if (w.academic > 0) {
            const scores = student.scores || {};
            const vals = Object.values(scores).filter(v => v !== null && v !== undefined);
            if (vals.length > 0) {
                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                totalScore += avg * w.academic;
                totalWeight += w.academic;
            }
        }

        // Personality complement bonus (calculated during recommendation, not per-student)
        // Here we give a base score based on personality adaptability
        if (w.personality > 0 && student.personality) {
            const pScore = student.personality === '中性' ? 80 : student.personality === '外向' ? 70 : 65;
            totalScore += pScore * w.personality;
            totalWeight += w.personality;
        }

        // Hobby diversity bonus
        if (w.hobby > 0 && student.hobbies && student.hobbies.length > 0) {
            const hScore = Math.min(100, 50 + student.hobbies.length * 10);
            totalScore += hScore * w.hobby;
            totalWeight += w.hobby;
        }

        // Position responsibility bonus
        if (w.position > 0 && student.position) {
            const posScores = { '班长': 95, '副班长': 90, '学习委员': 90, '体育委员': 85, '文艺委员': 85, '劳动委员': 80, '小组长': 75, '课代表': 80 };
            const pScore = posScores[student.position] || 60;
            totalScore += pScore * w.position;
            totalWeight += w.position;
        }

        return totalWeight > 0 ? Math.round(totalScore / totalWeight) : (student.score || 0);
    },

    /**
     * Get average subject score
     */
    getAvgScore(student) {
        if (!student) return null;
        const scores = student.scores || {};
        const vals = Object.values(scores).filter(v => v !== null && v !== undefined);
        if (vals.length === 0) return student.score || null;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    },

    /**
     * Get single subject score
     */
    getSubjectScore(student, subject) {
        if (!student || !student.scores) return null;
        return student.scores[subject] ?? null;
    },

    /**
     * Calculate peer influence score between two adjacent students
     * Higher = more positive mutual influence
     */
    peerInfluence(s1, s2) {
        if (!s1 || !s2) return 0;
        let score = 0;

        // Academic complement: high scorer next to low scorer = positive
        const avg1 = this.getAvgScore(s1), avg2 = this.getAvgScore(s2);
        if (avg1 !== null && avg2 !== null) {
            const diff = Math.abs(avg1 - avg2);
            if (diff > 15 && diff < 40) score += 20; // Good pairing range
            else if (diff <= 15) score += 10; // Similar level, can discuss together
        }

        // Personality complement
        if (s1.personality && s2.personality) {
            if (s1.personality === '外向' && s2.personality === '内向') score += 15;
            else if (s1.personality === '内向' && s2.personality === '外向') score += 15;
            else if (s1.personality === '中性' || s2.personality === '中性') score += 8;
        }

        // Shared hobbies
        if (s1.hobbies && s2.hobbies) {
            const shared = s1.hobbies.filter(h => s2.hobbies.includes(h));
            score += Math.min(20, shared.length * 8);
        }

        // Position diversity (different roles complement each other)
        if (s1.position && s2.position && s1.position !== s2.position) score += 10;

        // Gender balance bonus
        if (s1.gender !== s2.gender) score += 5;

        return score;
    },

    /**
     * Generate explanation for why two students should sit together/apart
     */
    explainPairing(s1, s2, relationship) {
        const reasons = [];
        const avg1 = this.getAvgScore(s1), avg2 = this.getAvgScore(s2);

        if (avg1 !== null && avg2 !== null) {
            const diff = Math.abs(avg1 - avg2);
            if (diff > 20) reasons.push(`学业互补：${escapeHtml(s1.name)}(${avg1}分)与${escapeHtml(s2.name)}(${avg2}分)成绩差${diff}分，可形成帮扶关系`);
            else if (diff <= 10) reasons.push(`学业同步：两人成绩相近(${avg1}/${avg2}分)，便于讨论交流`);
        }

        if (s1.personality && s2.personality) {
            if ((s1.personality === '外向' && s2.personality === '内向') || (s1.personality === '内向' && s2.personality === '外向'))
                reasons.push(`性格互补：${s1.personality}型与${s2.personality}型搭配，有利于社交能力均衡发展`);
        }

        if (s1.hobbies && s2.hobbies) {
            const shared = s1.hobbies.filter(h => s2.hobbies.includes(h));
            if (shared.length > 0) reasons.push(`共同爱好：${shared.join('、')}，有共同话题`);
        }

        if (s1.position && s2.position && s1.position !== s2.position)
            reasons.push(`职务搭配：${s1.position}与${s2.position}协作，有利于班级管理`);

        if (s1.gender !== s2.gender) reasons.push('性别均衡：男女搭配坐，符合教育部建议');

        return reasons.length > 0 ? reasons.join('。') : '综合评估后的位置建议';
    },

    /**
     * Render algorithm explanation modal content
     */
    renderExplanation() {
        const w = state.settings.weights;
        const container = document.getElementById('algoWeightBars');
        if (!container) return;
        container.innerHTML = `
            <div style="margin-top:12px;">
                <div class="algo-weight-bar"><span class="algo-weight-label">学业成绩</span><div class="algo-weight-track"><div class="algo-weight-fill" style="width:${w.academic}%;background:var(--primary);">${w.academic}%</div></div></div>
                <div class="algo-weight-bar"><span class="algo-weight-label">性格互补</span><div class="algo-weight-track"><div class="algo-weight-fill" style="width:${w.personality}%;background:var(--success);">${w.personality}%</div></div></div>
                <div class="algo-weight-bar"><span class="algo-weight-label">爱好搭配</span><div class="algo-weight-track"><div class="algo-weight-fill" style="width:${w.hobby}%;background:var(--warning);">${w.hobby}%</div></div></div>
                <div class="algo-weight-bar"><span class="algo-weight-label">职务平衡</span><div class="algo-weight-track"><div class="algo-weight-fill" style="width:${w.position}%;background:var(--info);">${w.position}%</div></div></div>
                <div class="algo-weight-bar"><span class="algo-weight-label">性别均衡</span><div class="algo-weight-track"><div class="algo-weight-fill" style="width:${w.gender}%;background:#FF2D55;">${w.gender}%</div></div></div>
            </div>
        `;
    }
};

// ==================== Pinyin Initial Search ====================
// [FEATURE #26] Lazy PinyinMap - initialized on first search
let _pinyinMap = null;
function _getPinyinMap() {
    if (!_pinyinMap) {
        _pinyinMap = {
    '阿':'a','爱':'ai','安':'an','昂':'ang','奥':'ao',
    '八':'ba','白':'bai','百':'bai','柏':'bai','班':'ban','半':'ban','包':'bao','宝':'bao','保':'bao','鲍':'bao','北':'bei','贝':'bei','本':'ben','毕':'bi','边':'bian','卞':'bian','别':'bie','宾':'bin','丙':'bing','伯':'bo','卜':'bo','补':'bu','步':'bu',
    '才':'cai','蔡':'cai','曹':'cao','草':'cao','岑':'cen','柴':'chai','昌':'chang','常':'chang','超':'chao','朝':'chao','车':'che','陈':'chen','成':'cheng','程':'cheng','池':'chi','迟':'chi','充':'chong','初':'chu','楚':'chu','储':'chu','褚':'chu','春':'chun','崔':'cui','存':'cun',
    '达':'da','大':'da','戴':'dai','丹':'dan','但':'dan','党':'dang','刀':'dao','到':'dao','邓':'deng','狄':'di','典':'dian','丁':'ding','东':'dong','冬':'dong','董':'dong','杜':'du','段':'duan','顿':'dun','多':'duo',
    '娥':'e','恩':'en',
    '发':'fa','范':'fan','方':'fang','飞':'fei','丰':'feng','冯':'feng','凤':'feng','伏':'fu','符':'fu','福':'fu','傅':'fu',
    '刚':'gang','高':'gao','郜':'gao','戈':'ge','葛':'ge','耿':'geng','公':'gong','龚':'gong','巩':'gong','古':'gu','顾':'gu','关':'guan','管':'guan','广':'guang','桂':'gui','郭':'guo','国':'guo','果':'guo',
    '哈':'ha','海':'hai','韩':'han','杭':'hang','郝':'hao','何':'he','和':'he','贺':'he','衡':'heng','红':'hong','洪':'hong','侯':'hou','后':'hou','胡':'hu','花':'hua','华':'hua','桓':'huan','黄':'huang','回':'hui','惠':'hui','火':'huo','霍':'huo',
    '及':'ji','吉':'ji','纪':'ji','季':'ji','贾':'jia','简':'jian','江':'jiang','姜':'jiang','蒋':'jiang','焦':'jiao','金':'jin','晋':'jin','靳':'jin','经':'jing','景':'jing','靖':'jing','鞠':'ju','隽':'jun',
    '开':'kai','阚':'kan','康':'kang','柯':'ke','可':'ke','孔':'kong','寇':'kou','匡':'kuang','邝':'kuang','况':'kuang','奎':'kui','昆':'kun',
    '来':'lai','赖':'lai','兰':'lan','蓝':'lan','郎':'lang','劳':'lao','乐':'le','雷':'lei','冷':'leng','黎':'li','李':'li','力':'li','历':'li','厉':'li','利':'li','栗':'li','连':'lian','廉':'lian','练':'lian','梁':'liang','廖':'liao','林':'lin','凌':'ling','刘':'liu','柳':'liu','龙':'long','娄':'lou','卢':'lu','鲁':'lu','陆':'lu','路':'lu','吕':'lv','罗':'luo','骆':'luo',
    '麻':'ma','马':'ma','买':'mai','麦':'mai','满':'man','毛':'mao','茅':'mao','梅':'mei','孟':'meng','米':'mi','苗':'miao','闵':'min','明':'ming','莫':'mo','牟':'mu','木':'mu','穆':'mu',
    '那':'na','南':'nan','倪':'ni','聂':'nie','宁':'ning','牛':'niu','农':'nong',
    '欧':'ou','偶':'ou',
    '潘':'pan','庞':'pang','裴':'pei','彭':'peng','皮':'pi','平':'ping','蒲':'pu','濮':'pu','朴':'pu','浦':'pu',
    '戚':'qi','齐':'qi','祁':'qi','钱':'qian','强':'qiang','乔':'qiao','秦':'qin','丘':'qiu','邱':'qiu','裘':'qiu','曲':'qu','瞿':'qu','全':'quan','权':'quan',
    '冉':'ran','饶':'rao','任':'ren','荣':'rong','容':'rong','阮':'ruan','芮':'rui',
    '萨':'sa','桑':'sang','沙':'sha','单':'shan','商':'shang','尚':'shang','邵':'shao','佘':'she','申':'shen','沈':'shen','盛':'sheng','施':'shi','石':'shi','时':'shi','史':'shi','寿':'shou','舒':'shu','帅':'shuai','双':'shuang','税':'shui','司':'si','宋':'song','苏':'su','宿':'su','隋':'sui','孙':'sun','索':'suo',
    '邰':'tai','谈':'tan','谭':'tan','汤':'tang','唐':'tang','陶':'tao','滕':'teng','田':'tian','铁':'tie','童':'tong','佟':'tong','涂':'tu','屠':'tu',
    '万':'wan','汪':'wang','王':'wang','危':'wei','韦':'wei','卫':'wei','魏':'wei','温':'wen','文':'wen','翁':'weng','邬':'wu','巫':'wu','吴':'wu','武':'wu','伍':'wu',
    '奚':'xi','习':'xi','席':'xi','夏':'xia','鲜':'xian','向':'xiang','项':'xiang','肖':'xiao','萧':'xiao','谢':'xie','辛':'xin','邢':'xing','幸':'xing','熊':'xiong','修':'xiu','徐':'xu','许':'xu','续':'xu','宣':'xuan','薛':'xue','荀':'xun',
    '牙':'ya','严':'yan','言':'yan','阎':'yan','颜':'yan','杨':'yang','阳':'yang','姚':'yao','叶':'ye','衣':'yi','易':'yi','殷':'yin','尹':'yin','应':'ying','尤':'you','游':'you','于':'yu','余':'yu','俞':'yu','虞':'yu','禹':'yu','玉':'yu','元':'yuan','袁':'yuan','岳':'yue','云':'yun','郧':'yun','恽':'yun',
    '宰':'zai','臧':'zang','曾':'zeng','翟':'zhai','詹':'zhan','湛':'zhan','张':'zhang','章':'zhang','赵':'zhao','甄':'zhen','郑':'zheng','支':'zhi','钟':'zhong','仲':'zhong','周':'zhou','朱':'zhu','诸':'zhu','祝':'zhu','庄':'zhuang','卓':'zhuo','宗':'zong','邹':'zou','祖':'zu','左':'zuo',
    // [FIX #17] 补全常见姓氏
    '阙':'que','缪':'miao','乜':'nie','干':'gan','於':'yu','干':'gan','郏':'jia','郏':'jia','逄':'pang','嵇':'ji','濮阳':'pu','澹台':'tan','公冶':'gong','东方':'dong','上官':'shang','欧阳':'ou','诸葛':'ge','令狐':'ling','皇甫':'huang','尉迟':'yu','公孙':'gong','轩辕':'xuan','夏侯':'xia','闻人':'wen'
        };
    }
    return _pinyinMap;
}
// Backward compatibility alias
const PinyinMap = new Proxy({}, { get: (_, key) => _getPinyinMap()[key] });

/**
 * Get pinyin initials for a Chinese name
 * @param {string} name - Chinese name
 * @returns {string} pinyin initials (lowercase)
 */
// [FIX] Use pinyin-pro library for complete pinyin support
function _fallbackPinyinInitials(name) {
    let result = '';
    for (const ch of name) {
        const lower = ch.toLowerCase();
        if (/[a-z0-9]/.test(lower)) { result += lower; continue; }
        const py = PinyinMap[ch];
        if (py) result += py[0];
    }
    return result;
}
function _fallbackFullPinyin(name) {
    let result = '';
    for (const ch of name) {
        const lower = ch.toLowerCase();
        if (/[a-z0-9]/.test(lower)) { result += lower; continue; }
        const py = PinyinMap[ch];
        if (py) result += py;
    }
    return result;
}
// [FIX] pinyin-pro CDN exports `pinyin` directly on window (not pinyinPro.pinyin)
function getPinyinInitials(name) {
    try {
        if (typeof pinyin === 'function') {
            return pinyin(name, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();
        }
    } catch(e) { console.warn('pinyin-pro error:', e); }
    return _fallbackPinyinInitials(name);
}

/**
 * Get full pinyin for a Chinese name
 * @param {string} name - Chinese name
 * @returns {string} full pinyin (lowercase, no tones)
 */
function getFullPinyin(name) {
    try {
        if (typeof pinyin === 'function') {
            return pinyin(name, { toneType: 'none', type: 'array' }).join('').toLowerCase();
        }
    } catch(e) { console.warn('pinyin-pro error:', e); }
    return _fallbackFullPinyin(name);
}

/**
 * [FIX #4] Unified student matching function
 * Supports: name contains, full pinyin contains, pinyin initials substring match
 * @param {Object} student - student object
 * @param {string} query - lowercase query string
 * @returns {boolean}
 */
function matchStudent(student, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const name = student.name.toLowerCase();
    if (name.includes(q)) return true;
    const fullPy = getFullPinyin(student.name).toLowerCase();
    if (fullPy.includes(q.replace(/\s/g, ''))) return true;
    const initials = getPinyinInitials(student.name).toLowerCase();
    // Support any continuous substring match on initials (e.g. "lmf", "lm", "l" match "路明非")
    if (initials.includes(q)) return true;
    // Also match position and personality
    if (student.position && student.position.toLowerCase().includes(q)) return true;
    if (student.personality && student.personality.toLowerCase().includes(q)) return true;
    if (student.hobbies && student.hobbies.some(h => h.toLowerCase().includes(q))) return true;
    return false;
}

/**
 * [FEATURE #8] Parse advanced search query
 * Supports: >score, <score, gender:, lunch:, personality:, position:
 * @param {string} query - raw query string
 * @returns {Object} { text, filters }
 */
function parseQuery(query) {
    const filters = {};
    let text = query || '';
    // Extract special filters
    const patterns = [
        { re: /(?:成绩|score)\s*>\s*(\d+)/i, key: 'scoreAbove' },
        { re: /(?:成绩|score)\s*<\s*(\d+)/i, key: 'scoreBelow' },
        { re: /(?:性别|gender)\s*[:：]\s*(男|女|male|female)/i, key: 'gender' },
        { re: /(?:午休|lunch)\s*[:：]\s*(是|否|yes|no|1|0)/i, key: 'lunch' },
        { re: /(?:性格|personality)\s*[:：]\s*(外向|内向|中性)/i, key: 'personality' },
        { re: /(?:职务|position)\s*[:：]\s*(\S+)/i, key: 'position' },
    ];
    patterns.forEach(({ re, key }) => {
        const m = text.match(re);
        if (m) { filters[key] = m[1]; text = text.replace(m[0], '').trim(); }
    });
    return { text: text.trim(), filters };
}

/**
 * Smart search component for blacklist/whitelist
 */
class SmartSearch {
    /**
     * @param {Object} opts
     * @param {string} opts.inputId - Search input element ID
     * @param {string} opts.dropdownId - Dropdown element ID
     * @param {string} opts.textareaId - Target textarea element ID
     * @param {string} opts.listKey - 'blacklist' or 'whitelist'
     */
    constructor({ inputId, dropdownId, textareaId, listKey }) {
        this.input = document.getElementById(inputId);
        this.dropdown = document.getElementById(dropdownId);
        this.textarea = document.getElementById(textareaId);
        this.listKey = listKey;
        this.highlightIdx = -1;
        this.filteredStudents = [];
        this._bound = false;
        this.bind();
    }

    bind() {
        if (this._bound) return;
        this._bound = true;
        this.input.addEventListener('input', () => this.onInput());
        this.input.addEventListener('focus', () => this.onInput());
        this.input.addEventListener('keydown', e => this.onKeydown(e));
        document.addEventListener('click', e => {
            if (!e.target.closest('.smart-search')) this.close();
        });
        // Reposition dropdown on scroll (sidebar scroll changes input rect)
        const scrollParent = this.input.closest('.sidebar-content');
        if (scrollParent) {
            scrollParent.addEventListener('scroll', () => {
                if (this.dropdown.classList.contains('open')) this.render();
            }, { passive: true });
        }
    }

    onInput() {
        const query = this.input.value.trim().toLowerCase();
        if (!query) { this.close(); return; }
        // [FIX #4] Use unified matchStudent
        this.filteredStudents = state.students.filter(s => matchStudent(s, query)).slice(0, 15);
        this.highlightIdx = -1;
        this.render();
    }

    onKeydown(e) {
        if (!this.dropdown.classList.contains('open')) return;
        const items = this.dropdown.querySelectorAll('.smart-search-item:not(.disabled)');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.highlightIdx = Math.min(this.highlightIdx + 1, items.length - 1);
            this.updateHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.highlightIdx = Math.max(this.highlightIdx - 1, 0);
            this.updateHighlight(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.highlightIdx >= 0 && items[this.highlightIdx]) {
                this.selectStudent(items[this.highlightIdx].dataset.name);
            } else if (items.length > 0) {
                this.selectStudent(items[0].dataset.name);
            }
        } else if (e.key === 'Escape') {
            this.close();
        }
    }

    updateHighlight(items) {
        items.forEach((item, i) => item.classList.toggle('highlighted', i === this.highlightIdx));
        if (items[this.highlightIdx]) items[this.highlightIdx].scrollIntoView({ block: 'nearest' });
    }

    render() {
        // Position dropdown using fixed coordinates to escape overflow:hidden ancestors
        const rect = this.input.getBoundingClientRect();
        this.dropdown.style.top = (rect.bottom + 4) + 'px';
        this.dropdown.style.left = rect.left + 'px';
        this.dropdown.style.width = rect.width + 'px';
        if (this.filteredStudents.length === 0) {
            this.dropdown.innerHTML = '<div class="smart-search-empty">未找到匹配学生</div>';
            this.dropdown.classList.add('open');
            return;
        }
        const query = this.input.value.trim().toLowerCase();
        this.dropdown.innerHTML = this.filteredStudents.map(s => {
            const initials = getPinyinInitials(s.name);
            const fullPy = getFullPinyin(s.name);
            let hint = '';
            if (initials.includes(query) && !s.name.toLowerCase().includes(query)) hint = `拼音: ${fullPy}`;
            const genderIcon = s.gender === 'male' ? '♂' : '♀';
            return `<div class="smart-search-item" data-name="${escapeHtml(s.name)}"><span>${escapeHtml(s.name)} ${genderIcon}</span><span class="match-hint">${escapeHtml(hint)}</span></div>`;
        }).join('');
        this.dropdown.classList.add('open');
        this.dropdown.querySelectorAll('.smart-search-item').forEach(item => {
            item.addEventListener('click', () => this.selectStudent(item.dataset.name));
        });
    }

    selectStudent(name) {
        const current = this.textarea.value.trim();
        // Add to the last incomplete line, or start a new line
        if (current === '') {
            this.textarea.value = name + ' ';
        } else {
            const lines = current.split('\n');
            const lastLine = lines[lines.length - 1].trim();
            if (lastLine === '') {
                lines[lines.length - 1] = name + ' ';
            } else {
                // Check if the last line already ends with space (incomplete group)
                lines[lines.length - 1] = lastLine + ' ' + name;
            }
            this.textarea.value = lines.join('\n');
        }
        // Trigger input event to save
        this.textarea.dispatchEvent(new Event('input'));
        // [FIX #2] Directly parse and update state to ensure sync
        const lines = this.textarea.value.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
        state[this.listKey] = lines.map(l => l.trim().split(/\s+/).map(n => n.trim()));
        this.input.value = '';
        this.close();
        Toast.success(`已添加 ${name}`);
    }

    close() {
        this.dropdown.classList.remove('open');
        this.dropdown.style.top = '';
        this.dropdown.style.left = '';
        this.dropdown.style.width = '';
        this.highlightIdx = -1;
    }
}

// ==================== Relationship Network ====================
const RELATIONSHIP_TYPES = [
    { id: 'lover',    icon: '💕', label: '恋人',   defaultScore: 80,  desc: '情侣/互相喜欢' },
    { id: 'bestie',   icon: '👭', label: '闺蜜',   defaultScore: 60,  desc: '亲密好友/闺蜜' },
    { id: 'brother',  icon: '🤜🤛', label: '兄弟', defaultScore: 50,  desc: '好兄弟/铁哥们' },
    { id: 'friend',   icon: '😊', label: '好友',   defaultScore: 30,  desc: '普通朋友' },
    { id: 'rival',    icon: '😤', label: '死对头', defaultScore: -80, desc: '严重冲突/死对头' },
    { id: 'talker',   icon: '🗣️', label: '话包子', defaultScore: -50, desc: '坐一起会不停说话' },
    { id: 'disturb',  icon: '⚡', label: '干扰源', defaultScore: -60, desc: '容易互相干扰' },
    { id: 'neutral',  icon: '🤝', label: '一般',   defaultScore: 10,  desc: '普通关系/可调节' },
    { id: 'custom',   icon: '🏷️', label: '自定义', defaultScore: 0,   desc: '自定义关系与分数' },
];

const RelationshipManager = {
    _selectedType: 'lover',
    _editingId: null,
    _searchA: null,
    _searchB: null,

    init() {
        this.renderTypeGrid();
        this._searchA = new RelStudentSearch('relStudentA', 'relStudentADropdown');
        this._searchB = new RelStudentSearch('relStudentB', 'relStudentBDropdown');

        // Score slider
        const slider = document.getElementById('relScoreSlider');
        const label = document.getElementById('relScoreLabel');
        slider.addEventListener('input', () => {
            const v = parseInt(slider.value);
            label.textContent = v > 0 ? '+' + v : v;
            this._updateScoreColor(v);
        });

        // Add button
        document.getElementById('relAddBtn').addEventListener('click', () => this.addOrUpdate());
        document.getElementById('relClearForm').addEventListener('click', () => this.clearForm());

        // Search & filter
        document.getElementById('relSearch').addEventListener('input', () => this.renderList());
        document.querySelectorAll('#relFilterBar .rel-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#relFilterBar .rel-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderList();
            });
        });

        // Export/Import
        document.getElementById('relExportBtn').addEventListener('click', () => this.exportRelations());
        document.getElementById('relImportBtn').addEventListener('click', () => document.getElementById('relImportFile').click());
        document.getElementById('relImportFile').addEventListener('change', e => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => this.importRelations(ev.target.result);
            reader.readAsText(file); e.target.value = '';
        });
        document.getElementById('relClearAllBtn').addEventListener('click', () => {
            if (state.relationships.length === 0) return;
            if (confirm(`确定要清空全部 ${state.relationships.length} 条关系定义吗？`)) {
                state.relationships = [];
                this.renderList();
                debouncedSave();
                Toast.success('已清空全部关系');
                addLog('🕸️', '清空全部关系定义');
            }
        });
    },

    renderTypeGrid() {
        const grid = document.getElementById('relTypeGrid');
        grid.innerHTML = RELATIONSHIP_TYPES.map(t =>
            `<div class="rel-type-btn${t.id === this._selectedType ? ' active' : ''}" data-type="${t.id}">
                <span class="rel-type-icon">${t.icon}</span>
                <span class="rel-type-label">${t.label}</span>
            </div>`
        ).join('');
        grid.querySelectorAll('.rel-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                grid.querySelectorAll('.rel-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._selectedType = btn.dataset.type;
                const typeDef = RELATIONSHIP_TYPES.find(t => t.id === this._selectedType);
                if (typeDef) {
                    const slider = document.getElementById('relScoreSlider');
                    slider.value = typeDef.defaultScore;
                    document.getElementById('relScoreLabel').textContent = typeDef.defaultScore > 0 ? '+' + typeDef.defaultScore : typeDef.defaultScore;
                    this._updateScoreColor(typeDef.defaultScore);
                }
            });
        });
    },

    _updateScoreColor(v) {
        const label = document.getElementById('relScoreLabel');
        if (v > 0) label.style.color = 'var(--success)';
        else if (v < 0) label.style.color = 'var(--danger)';
        else label.style.color = 'var(--text-tertiary)';
    },

    clearForm() {
        this._searchA.clear(); this._searchB.clear();
        document.getElementById('relScoreSlider').value = 0;
        document.getElementById('relScoreLabel').textContent = '0';
        this._updateScoreColor(0);
        document.getElementById('relNote').value = '';
        this._editingId = null;
        document.getElementById('relAddBtn').textContent = '➕ 添加关系';
    },

    addOrUpdate() {
        const nameA = this._searchA.getSelectedName();
        const nameB = this._searchB.getSelectedName();
        if (!nameA || !nameB) { Toast.warning('请选择两名学生'); return; }
        if (nameA === nameB) { Toast.warning('不能为自己创建关系'); return; }

        const score = parseInt(document.getElementById('relScoreSlider').value) || 0;
        const note = document.getElementById('relNote').value.trim();
        const type = this._selectedType;
        const typeDef = RELATIONSHIP_TYPES.find(t => t.id === type);

        // Check for duplicate (excluding current edit)
        const dup = state.relationships.find(r =>
            r.id !== this._editingId &&
            ((r.studentA === nameA && r.studentB === nameB) || (r.studentA === nameB && r.studentB === nameA))
        );
        if (dup) { Toast.warning(`${nameA} 与 ${nameB} 之间已存在关系定义`); return; }

        if (this._editingId) {
            const rel = state.relationships.find(r => r.id === this._editingId);
            if (rel) {
                rel.studentA = nameA; rel.studentB = nameB; rel.type = type; rel.score = score; rel.note = note;
                Toast.success('关系已更新');
                addLog('✏️', `更新关系: ${nameA} ${typeDef?.icon || ''} ${nameB} (${score > 0 ? '+' : ''}${score})`);
            }
        } else {
            state.relationships.push({ id: Date.now(), studentA: nameA, studentB: nameB, type, score, note });
            Toast.success('关系已添加');
            addLog('🕸️', `添加关系: ${nameA} ${typeDef?.icon || ''} ${nameB} (${score > 0 ? '+' : ''}${score})`);
        }

        this.clearForm();
        this.renderList();
        debouncedSave();
    },

    editRelation(id) {
        const rel = state.relationships.find(r => r.id === id);
        if (!rel) return;
        this._editingId = id;
        this._searchA.setValue(rel.studentA);
        this._searchB.setValue(rel.studentB);
        this._selectedType = rel.type;
        this.renderTypeGrid();
        document.getElementById('relScoreSlider').value = rel.score;
        document.getElementById('relScoreLabel').textContent = rel.score > 0 ? '+' + rel.score : rel.score;
        this._updateScoreColor(rel.score);
        document.getElementById('relNote').value = rel.note || '';
        document.getElementById('relAddBtn').textContent = '✏️ 更新关系';
        // Scroll to add panel
        document.getElementById('relAddPanel').scrollIntoView({ behavior: 'smooth' });
    },

    deleteRelation(id) {
        const idx = state.relationships.findIndex(r => r.id === id);
        if (idx === -1) return;
        const rel = state.relationships[idx];
        if (!confirm(`确定删除 ${rel.studentA} 与 ${rel.studentB} 的关系？`)) return;
        state.relationships.splice(idx, 1);
        this.renderList();
        debouncedSave();
        Toast.success('关系已删除');
        addLog('🗑️', `删除关系: ${rel.studentA} - ${rel.studentB}`);
    },

    renderList() {
        const container = document.getElementById('relList');
        const search = document.getElementById('relSearch').value.trim().toLowerCase();
        const filter = document.querySelector('#relFilterBar .rel-filter.active')?.dataset.filter || 'all';

        let filtered = [...state.relationships];
        if (search) {
            filtered = filtered.filter(r =>
                r.studentA.toLowerCase().includes(search) ||
                r.studentB.toLowerCase().includes(search) ||
                (r.note && r.note.toLowerCase().includes(search)) ||
                (RELATIONSHIP_TYPES.find(t => t.id === r.type)?.label || '').includes(search)
            );
        }
        if (filter === 'positive') filtered = filtered.filter(r => r.score > 0);
        else if (filter === 'negative') filtered = filtered.filter(r => r.score < 0);

        document.getElementById('relSubtitle').textContent = `${state.relationships.length} 条关系` + (filtered.length !== state.relationships.length ? ` (显示 ${filtered.length})` : '');

        if (filtered.length === 0) {
            container.innerHTML = `<div class="rel-empty">${state.relationships.length === 0 ? '暂无关系定义，请在上方添加' : '无匹配结果'}</div>`;
            return;
        }

        container.innerHTML = filtered.map(r => {
            const t = RELATIONSHIP_TYPES.find(x => x.id === r.type) || RELATIONSHIP_TYPES[8];
            const scoreClass = r.score > 0 ? 'positive' : r.score < 0 ? 'negative' : 'zero';
            const scoreText = r.score > 0 ? '+' + r.score : r.score;
            return `<div class="rel-card">
                <div class="rel-card-header">
                    <div class="rel-card-names">
                        <span>${escapeHtml(r.studentA)}</span>
                        <span class="rel-connector">${t.icon} ${t.label}</span>
                        <span>${escapeHtml(r.studentB)}</span>
                    </div>
                    <div class="rel-card-actions">
                        <button class="btn btn-ghost btn-icon btn-sm" onclick="RelationshipManager.editRelation(${r.id})" title="编辑" style="width:26px;height:26px;min-width:26px;font-size:12px;">✏️</button>
                        <button class="btn btn-ghost btn-icon btn-sm" onclick="RelationshipManager.deleteRelation(${r.id})" title="删除" style="width:26px;height:26px;min-width:26px;font-size:12px;">🗑️</button>
                    </div>
                </div>
                <div class="rel-card-meta">
                    <span class="rel-card-score ${scoreClass}">${scoreText} 分</span>
                    ${r.note ? `<span class="rel-card-note" title="${escapeHtml(r.note)}">${escapeHtml(r.note)}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    },

    exportRelations() {
        if (state.relationships.length === 0) { Toast.warning('暂无关系可导出'); return; }
        const blob = new Blob([JSON.stringify({ relationships: state.relationships }, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `人物关系网_${new Date().toISOString().slice(0,10)}.json`;
        link.href = URL.createObjectURL(blob); link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        Toast.success(`已导出 ${state.relationships.length} 条关系`);
    },

    importRelations(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            const rels = data.relationships || data;
            if (!Array.isArray(rels)) { Toast.error('无效的关系数据格式'); return; }
            let imported = 0, skipped = 0;
            rels.forEach(r => {
                if (!r.studentA || !r.studentB || r.score === undefined) { skipped++; return; }
                const dup = state.relationships.find(existing =>
                    (existing.studentA === r.studentA && existing.studentB === r.studentB) ||
                    (existing.studentA === r.studentB && existing.studentB === r.studentA)
                );
                if (dup) { skipped++; return; }
                state.relationships.push({
                    id: r.id || Date.now() + Math.random(),
                    studentA: r.studentA, studentB: r.studentB,
                    type: r.type || 'custom', score: r.score, note: r.note || ''
                });
                imported++;
            });
            this.renderList();
            debouncedSave();
            Toast.success(`导入完成：${imported} 条新增，${skipped} 条跳过`);
            addLog('📥', `导入关系: ${imported} 条新增，${skipped} 条跳过`);
        } catch (e) {
            Toast.error('导入失败: ' + e.message);
        }
    },

    /** Get all relationships for a given student name */
    getForStudent(name) {
        return state.relationships.filter(r => r.studentA === name || r.studentB === name);
    },

    /** Get relationship score between two students (0 if none) */
    getScore(nameA, nameB) {
        const rel = state.relationships.find(r =>
            (r.studentA === nameA && r.studentB === nameB) ||
            (r.studentA === nameB && r.studentB === nameA)
        );
        return rel ? rel.score : 0;
    },

    /** Get relationship object between two students */
    getRelation(nameA, nameB) {
        return state.relationships.find(r =>
            (r.studentA === nameA && r.studentB === nameB) ||
            (r.studentA === nameB && r.studentB === nameA)
        ) || null;
    }
};

/** Inline student search for relationship add form */
class RelStudentSearch {
    constructor(inputId, dropdownId) {
        this.input = document.getElementById(inputId);
        this.dropdown = document.getElementById(dropdownId);
        this.selectedName = '';
        this.highlightIdx = -1;
        this._bindEvents();
    }
    _bindEvents() {
        this.input.addEventListener('input', () => this._onInput());
        this.input.addEventListener('focus', () => this._onInput());
        this.input.addEventListener('keydown', e => this._onKeydown(e));
        document.addEventListener('click', e => {
            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) this.close();
        });
    }
    _onInput() {
        const q = this.input.value.trim();
        this.selectedName = '';
        if (!q) { this.close(); return; }
        const matches = state.students.filter(s => matchStudent(s, q)).slice(0, 20);
        if (matches.length === 0) {
            this.dropdown.innerHTML = '<div class="smart-search-empty">无匹配学生</div>';
        } else {
            this.dropdown.innerHTML = matches.map((s, i) =>
                `<div class="smart-search-item${i === 0 ? ' highlighted' : ''}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)} <span class="match-hint">${s.gender === 'male' ? '♂' : '♀'}</span></div>`
            ).join('');
        }
        this.highlightIdx = 0;
        this._positionDropdown();
        this.dropdown.classList.add('open');
        this.dropdown.querySelectorAll('.smart-search-item').forEach(item => {
            item.addEventListener('click', () => this._select(item.dataset.name));
        });
    }
    _onKeydown(e) {
        if (!this.dropdown.classList.contains('open')) return;
        const items = this.dropdown.querySelectorAll('.smart-search-item');
        if (e.key === 'ArrowDown') { e.preventDefault(); this.highlightIdx = Math.min(this.highlightIdx + 1, items.length - 1); this._updateHighlight(items); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this.highlightIdx = Math.max(this.highlightIdx - 1, 0); this._updateHighlight(items); }
        else if (e.key === 'Enter') { e.preventDefault(); if (items[this.highlightIdx]) this._select(items[this.highlightIdx].dataset.name); }
        else if (e.key === 'Escape') this.close();
    }
    _updateHighlight(items) {
        items.forEach((it, i) => it.classList.toggle('highlighted', i === this.highlightIdx));
    }
    _select(name) {
        this.input.value = name;
        this.selectedName = name;
        this.close();
    }
    _positionDropdown() {
        const rect = this.input.getBoundingClientRect();
        this.dropdown.style.top = (rect.bottom + 4) + 'px';
        this.dropdown.style.left = rect.left + 'px';
        this.dropdown.style.width = rect.width + 'px';
    }
    close() { this.dropdown.classList.remove('open'); this.highlightIdx = -1; }
    getSelectedName() { return this.selectedName || this.input.value.trim(); }
    setValue(v) { this.input.value = v; this.selectedName = v; }
    clear() { this.input.value = ''; this.selectedName = ''; this.close(); }
}

// ==================== Algorithm (Bug-fixed) ====================
const Algorithm = {
    // [FIX] History now properly tracked via pushHistory()
    pushHistory() {
        const snapshot = [];
        [...state.seats, state.platformLeft, state.platformRight].forEach(s => {
            if (s.student) snapshot.push({ id: s.student.id, name: s.student.name, row: s.row, col: s.col, type: s.type });
        });
        if (snapshot.length > 0) {
            state.history.push(snapshot);
            if (state.history.length > 20) state.history.shift();
        }
    },
    calculateProbabilities() {
        if (state.remainingStudents.length === 0) return [];
        let probabilities = {};
        state.remainingStudents.forEach(s => { probabilities[s.id] = 1; });
        if (state.settings.antiCluster) {
            this.applyBlacklist(probabilities);
            this.applyWhitelist(probabilities);
        }
        if (state.settings.genderBalance) this.applyGenderBalance(probabilities);
        this.applyHistory(probabilities);
        this.applyRelationships(probabilities);
        // [FIX] Pass nextSeat to plugin hooks
        const nextSeat = state.drawOrder[state.currentDrawIndex] || null;
        Object.keys(state.plugins).forEach(pn => {
            if (PluginManager.isEnabled(pn) && state.plugins[pn].beforeDraw) {
                try {
                    const result = state.plugins[pn].beforeDraw(state.remainingStudents, probabilities, nextSeat);
                    if (result && result.probabilities) probabilities = result.probabilities;
                } catch(e) { console.error(`Plugin ${pn}.beforeDraw error`, e); }
            }
        });
        // [FIX] Clamp probabilities to prevent collapse from extreme blacklist/whitelist values
        Object.keys(probabilities).forEach(id => {
            probabilities[id] = Math.max(probabilities[id], 0.001);
        });
        // Normalize
        const total = Object.values(probabilities).reduce((a, b) => a + b, 0);
        if (total <= 0) {
            // Fallback: uniform distribution (should never reach here after clamping)
            state.remainingStudents.forEach(s => { probabilities[s.id] = 1 / state.remainingStudents.length; });
        } else {
            Object.keys(probabilities).forEach(id => { probabilities[id] = probabilities[id] / total; });
        }
        return Object.entries(probabilities)
            .map(([id, prob]) => ({ student: state.students.find(s => s.id === parseInt(id)), probability: prob }))
            .filter(item => item.student)
            .sort((a, b) => b.probability - a.probability);
    },
    calculateEffectiveDistance(seat1, seat2) {
        if (!seat1 || !seat2) return Infinity;
        if (seat1.type !== 'normal' || seat2.type !== 'normal') return Math.abs(seat1.row - seat2.row) + Math.abs(seat1.col - seat2.col);
        const row1 = seat1.row, col1 = seat1.col, row2 = seat2.row, col2 = seat2.col;
        if (row1 === row2) {
            const minC = Math.min(col1, col2), maxC = Math.max(col1, col2);
            for (let c = minC + 1; c < maxC; c++) {
                const idx = row1 * state.cols + c;
                if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) return Infinity;
            }
        }
        if (col1 === col2) {
            const minR = Math.min(row1, row2), maxR = Math.max(row1, row2);
            for (let r = minR + 1; r < maxR; r++) {
                const idx = r * state.cols + col1;
                if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) return Infinity;
            }
        }
        if (row1 !== row2 && col1 !== col2) {
            let path1Blocked = false, path2Blocked = false;
            for (let c = Math.min(col1, col2) + 1; c < Math.max(col1, col2); c++) {
                const idx = row1 * state.cols + c;
                if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) { path1Blocked = true; break; }
            }
            if (!path1Blocked) {
                for (let r = Math.min(row1, row2) + 1; r < Math.max(row1, row2); r++) {
                    const idx = r * state.cols + col2;
                    if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) { path1Blocked = true; break; }
                }
            }
            for (let r = Math.min(row1, row2) + 1; r < Math.max(row1, row2); r++) {
                const idx = r * state.cols + col1;
                if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) { path2Blocked = true; break; }
            }
            if (!path2Blocked) {
                for (let c = Math.min(col1, col2) + 1; c < Math.max(col1, col2); c++) {
                    const idx = row2 * state.cols + c;
                    if (state.seats[idx] && (state.seats[idx].disabled || state.seats[idx].element.classList.contains('aisle'))) { path2Blocked = true; break; }
                }
            }
            if (path1Blocked && path2Blocked) return Infinity;
        }
        return Math.abs(row1 - row2) + Math.abs(col1 - col2);
    },
    applyBlacklist(probabilities) {
        const drawnSeats = [...state.seats, state.platformLeft, state.platformRight].filter(s => s.student && !s.disabled);
        const nextSeat = state.drawOrder[state.currentDrawIndex];
        if (!nextSeat) return;
        // [FIX #7] Helper: extract clean name and check if it's an anchor
        const parseName = (raw) => {
            let name = raw;
            let isAnchor = false;
            if (name.startsWith('*')) { isAnchor = true; name = name.slice(1); }
            if ((name.startsWith('(') && name.endsWith(')')) || (name.startsWith('（') && name.endsWith('）'))) {
                isAnchor = true; name = name.slice(1, -1);
            }
            return { name, isAnchor };
        };
        state.blacklist.forEach(group => {
            const parsed = group.map(parseName);
            const cleanGroup = parsed.map(p => p.name);
            const anchorNames = parsed.filter(p => p.isAnchor).map(p => p.name);
            const drawnInGroup = cleanGroup.filter(name => drawnSeats.some(s => s.student.name === name));
            if (drawnInGroup.length === 0) return;
            // Determine anchors: if explicit markers exist, use them; otherwise use first drawn
            let anchors;
            if (anchorNames.length > 0) {
                anchors = drawnInGroup.filter(n => anchorNames.includes(n));
                if (anchors.length === 0) return; // [FIX #1] No anchor drawn yet, skip group
            } else {
                const drawOrder = state.drawnStudents.map(s => s.name);
                anchors = [drawnInGroup.sort((a, b) => drawOrder.indexOf(a) - drawOrder.indexOf(b))[0]];
            }
            // Only penalize remaining students based on proximity to anchor(s)
            state.remainingStudents.forEach(student => {
                if (!cleanGroup.includes(student.name)) return;
                let minDist = Infinity;
                anchors.forEach(dn => {
                    const ds = drawnSeats.find(s => s.student.name === dn);
                    if (ds) minDist = Math.min(minDist, this.calculateEffectiveDistance(ds, nextSeat));
                });
                if (minDist <= state.settings.blacklistRadius) {
                    // [FIX] Use floor to prevent exact 0 which causes normalization collapse
                    probabilities[student.id] *= Math.max(0.001, 1 - state.settings.blacklistPenalty / 100);
                }
            });
        });
    },
    applyWhitelist(probabilities) {
        const drawnSeats = [...state.seats, state.platformLeft, state.platformRight].filter(s => s.student && !s.disabled);
        const nextSeat = state.drawOrder[state.currentDrawIndex];
        if (!nextSeat || nextSeat.type !== 'normal') return;
        // [FIX #7] Helper: extract clean name and check if it's an anchor
        const parseName = (raw) => {
            let name = raw;
            let isAnchor = false;
            if (name.startsWith('*')) { isAnchor = true; name = name.slice(1); }
            if ((name.startsWith('(') && name.endsWith(')')) || (name.startsWith('（') && name.endsWith('）'))) {
                isAnchor = true; name = name.slice(1, -1);
            }
            return { name, isAnchor };
        };
        state.whitelist.forEach(group => {
            const parsed = group.map(parseName);
            const cleanGroup = parsed.map(p => p.name);
            const anchorNames = parsed.filter(p => p.isAnchor).map(p => p.name);
            const drawnInGroup = cleanGroup.filter(name => drawnSeats.some(s => s.student.name === name));
            if (drawnInGroup.length === 0) return;
            // Determine anchors
            let anchorDrawn;
            if (anchorNames.length > 0) {
                anchorDrawn = drawnInGroup.filter(n => anchorNames.includes(n));
                if (anchorDrawn.length === 0) return; // [FIX #1] No anchor drawn yet, skip group
            } else {
                anchorDrawn = drawnInGroup;
            }
            state.remainingStudents.forEach(student => {
                if (!cleanGroup.includes(student.name)) return;
                let bestBonus = 0;
                anchorDrawn.forEach(dn => {
                    const ds = drawnSeats.find(s => s.student.name === dn);
                    if (!ds) return;
                    const dist = this.calculateEffectiveDistance(ds, nextSeat);
                    if (dist === Infinity) return;
                    const rowDiff = Math.abs(ds.row - nextSeat.row);
                    const colDiff = Math.abs(ds.col - nextSeat.col);
                    let bonus = 0;
                    if (rowDiff === 0 && colDiff === 1) bonus = state.settings.whitelistDeskBonus / 100;
                    else if (rowDiff === 1 && colDiff === 0) bonus = state.settings.whitelistFrontBackBonus / 100;
                    else if (rowDiff === 1 && colDiff === 1) bonus = state.settings.whitelistDiagonalBonus / 100;
                    else if (dist <= 5) bonus = state.settings.whitelistFallbackBonus / 100;
                    bestBonus = Math.max(bestBonus, bonus);
                });
                if (bestBonus > 0) {
                    // [FIX] Use cubic scaling so extreme bonus values produce near-certain results
                    // At 200%: multiplier ≈ 27; at 500%: multiplier ≈ 216
                    probabilities[student.id] *= Math.pow(1 + bestBonus, 3);
                }
            });
        });
    },
    applyGenderBalance(probabilities) {
        const rm = state.remainingStudents.filter(s => s.gender === 'male').length;
        const rf = state.remainingStudents.filter(s => s.gender === 'female').length;
        const total = rm + rf;
        if (total === 0) return;
        const mr = rm / total, fr = rf / total;
        state.remainingStudents.forEach(s => {
            if (s.gender === 'male' && mr > 0.6) probabilities[s.id] *= 0.7;
            else if (s.gender === 'female' && fr > 0.6) probabilities[s.id] *= 0.7;
        });
    },
    // [FIX] History-based adjacency penalty now works
    applyHistory(probabilities) {
        if (state.history.length === 0) return;
        const recent = state.history.slice(-5);
        state.remainingStudents.forEach(student => {
            let penalty = 0;
            recent.forEach(snapshot => {
                const studentEntry = snapshot.find(h => h.id === student.id);
                if (!studentEntry) return;
                snapshot.forEach(entry => {
                    if (entry.id === student.id) return;
                    // Check if this person is already drawn and seated
                    const isDrawn = state.drawnStudents.some(d => d.id === entry.id);
                    if (!isDrawn) return;
                    if (this.areAdjacentByRC(studentEntry.row, studentEntry.col, entry.row, entry.col)) {
                        penalty += 0.1;
                    }
                });
            });
            probabilities[student.id] *= Math.max(0.1, 1 - penalty);
        });
    },
    areAdjacentByRC(r1, c1, r2, c2) {
        if (r1 < 0 || r2 < 0) return false; // platform seats
        return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
    },
    /**
     * Apply relationship network influence on draw probabilities.
     * Positive score → boost probability (should sit together)
     * Negative score → reduce probability (should be separated)
     */
    applyRelationships(probabilities) {
        if (state.relationships.length === 0) return;
        const drawnSeats = [...state.seats, state.platformLeft, state.platformRight].filter(s => s.student && !s.disabled);
        const nextSeat = state.drawOrder[state.currentDrawIndex];
        if (!nextSeat) return;

        state.remainingStudents.forEach(student => {
            let adjustment = 0;
            state.relationships.forEach(rel => {
                let partnerName = null;
                if (rel.studentA === student.name) partnerName = rel.studentB;
                else if (rel.studentB === student.name) partnerName = rel.studentA;
                if (!partnerName) return;

                // Check if partner is already drawn
                const partnerSeat = drawnSeats.find(s => s.student.name === partnerName);
                if (!partnerSeat) return;

                // Calculate distance from next seat to partner
                const dist = this.calculateEffectiveDistance(partnerSeat, nextSeat);
                if (dist === Infinity) return;

                const relType = RELATIONSHIP_TYPES.find(t => t.id === rel.type);
                const score = rel.score;

                if (score > 0) {
                    // Positive: boost if close to partner
                    // The closer the seat, the stronger the boost
                    if (dist <= 1) adjustment += score * 0.03;       // Adjacent: max boost
                    else if (dist <= 2) adjustment += score * 0.02;  // Near: moderate boost
                    else if (dist <= 4) adjustment += score * 0.01;  // Far: small boost
                } else if (score < 0) {
                    // Negative: penalize if close to partner
                    if (dist <= 1) adjustment += score * 0.03;       // Adjacent: max penalty
                    else if (dist <= 2) adjustment += score * 0.02;  // Near: moderate penalty
                    else if (dist <= 3) adjustment += score * 0.01;  // Close: small penalty
                    // Far away: no penalty (already separated)
                }
            });

            if (adjustment !== 0) {
                probabilities[student.id] *= Math.max(0.001, 1 + adjustment);
            }
        });
    },
    drawStudent() {
        const probabilities = this.calculateProbabilities();
        if (probabilities.length === 0) return null;
        let random = Math.random();
        let cumulative = 0;
        for (let i = 0; i < probabilities.length; i++) {
            cumulative += probabilities[i].probability;
            if (random <= cumulative || i === probabilities.length - 1) {
                const idx = state.remainingStudents.findIndex(s => s.id === probabilities[i].student.id);
                return state.remainingStudents.splice(idx, 1)[0];
            }
        }
        return state.remainingStudents.shift();
    }
};
