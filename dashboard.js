/* ===================================================================
   STUDYBUDDY UNIFIED MASTER CONTROLLER (dashboard.js)
   Combines Dashboard, Voice Study Arena, Review Materials,
   Question Bank, Task Tracking, Analytics, and Student Authentication
   =================================================================== */

'use strict';

// ─── STORAGE KEYS ────────────────────────────────────────────────────────────
const TASKS_KEY   = 'sb_tasks_v2';
const SCHED_KEY   = 'sb_schedule_v1';
const NOTIF_KEY   = 'sb_notifs_v1';

function loadJSON(key, def = []) {
    try { return JSON.parse(localStorage.getItem(key)) || def; }
    catch { return def; }
}
function saveJSON(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// ─── GLOBAL APPLICATION STATE ────────────────────────────────────────────────
let currentStudent = null;
let currentView    = 'dashboard';
let subjects       = [];
let tasks          = loadJSON(TASKS_KEY, []);
let schedules      = loadJSON(SCHED_KEY, defaultSchedule());
let notifications  = loadJSON(NOTIF_KEY, defaultNotifs());
let taskFilter     = 'all';
let calYear        = new Date().getFullYear();
let calMonth       = new Date().getMonth();

// Arena active recall session state
const arenaState = {
    currentSession: [],
    currentQuestionIndex: 0,
    currentQuestion: null,
    autoSpeakQuestion: true,
    lastVoiceMemo: ''
};

// Global Voice Controller Instance
let voice = null;

// ─── SEED DEFAULTS ───────────────────────────────────────────────────────────
// Period map: p1..p7 → index 0..6 used in timetable rows
const PERIOD_MAP = [
    { id: 'p1', label: '07:30 – 09:00 AM', period: '1st Period' },
    { id: 'p2', label: '09:00 – 10:30 AM', period: '2nd Period' },
    { id: 'p3', label: '10:30 – 12:00 PM', period: '3rd Period' },
    { id: 'p4', label: '01:00 – 02:30 PM', period: '4th Period' },
    { id: 'p5', label: '02:30 – 04:00 PM', period: '5th Period' },
    { id: 'p6', label: '04:00 – 05:30 PM', period: '6th Period' },
    { id: 'p7', label: '05:30 – 07:00 PM', period: 'Active Recall' },
];

function defaultSchedule() {
    return [
        { id: 's1', day: 0, period: 'p1', title: 'IT 101 – CompFund',   color: 'blue',   room: 'Lab 1',    type: 'Laboratory', code: 'IT 101' },
        { id: 's2', day: 0, period: 'p2', title: 'IT 102 – Prog Logic', color: 'purple', room: 'Room 203', type: 'Lecture',    code: 'IT 102' },
        { id: 's3', day: 1, period: 'p1', title: 'IT 103 – Disc Struct', color: 'green',  room: 'Lab 2',   type: 'Laboratory', code: 'IT 103' },
        { id: 's4', day: 2, period: 'p1', title: 'IT 101 – CompFund',   color: 'blue',   room: 'Lab 1',    type: 'Lecture',    code: 'IT 101' },
        { id: 's5', day: 2, period: 'p3', title: 'Math 1 – Calculus',   color: 'orange', room: 'Room 101', type: 'Lecture',    code: 'Math 1' },
        { id: 's6', day: 3, period: 'p2', title: 'IT 102 – Prog Logic', color: 'purple', room: 'Room 203', type: 'Lecture',    code: 'IT 102' },
        { id: 's7', day: 4, period: 'p1', title: 'IT 103 – Disc Struct', color: 'green',  room: 'Lab 2',   type: 'Laboratory', code: 'IT 103' },
        { id: 's8', day: 4, period: 'p4', title: 'Math 1 – Calculus',   color: 'orange', room: 'Room 101', type: 'Lecture',    code: 'Math 1' },
        { id: 's9', day: 0, period: 'p6', title: 'Active Recall Drill',  color: 'amber',  room: 'Self-Study', type: 'Recall Drill', code: 'Drill' },
        { id: 's10',day: 2, period: 'p6', title: 'Active Recall Drill',  color: 'amber',  room: 'Self-Study', type: 'Recall Drill', code: 'Drill' },
        { id: 's11',day: 4, period: 'p6', title: 'Active Recall Drill',  color: 'amber',  room: 'Self-Study', type: 'Recall Drill', code: 'Drill' },
    ];
}

function defaultNotifs() {
    return [
        { id: 'n1', title: 'Review due: IT 101 Computer Fundamentals', time: '1 hour ago', read: false },
        { id: 'n2', title: 'Active recall queue has 4 pending questions', time: '3 hours ago', read: false },
        { id: 'n3', title: 'New reviewer notes processed & ready', time: 'Yesterday', read: false },
    ];
}

function uid() { return '_' + Math.random().toString(36).substr(2, 9); }

// ─── INITIALIZATION ON DOM READY ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initVoiceSystem();
    await checkAuthStatus();
    await loadSubjects();
    seedDefaultTasks(subjects);
    initWelcomeBanner();
    renderCalendar();
    renderDashboard();
    renderReviewSchedule();
    initEventListeners();
    updateNotifBadge();
    loadSettings();
});

// ─── VOICE SYSTEM SETUP ──────────────────────────────────────────────────────
function initVoiceSystem() {
    try {
        if (typeof VoiceController !== 'undefined') {
            voice = new VoiceController();
            
            const canvas = document.getElementById('voiceVisualizer');
            if (canvas) voice.initVisualizer(canvas);

            const statusPill = document.getElementById('voiceStatusPill');
            const statusText = document.getElementById('statusText');
            const micStage   = document.querySelector('.mic-stage');
            const micInstruction = document.getElementById('micInstruction');

            voice.onStateChange = (state, error) => {
                const micBtn = document.getElementById('btnMicTrigger');
                const micIcon = document.getElementById('micIcon');

                if (statusPill) statusPill.classList.remove('listening', 'speaking');

                if (state === 'listening') {
                    if (statusPill) statusPill.classList.add('listening');
                    if (statusText) statusText.textContent = 'Listening...';
                    if (micStage) micStage.classList.add('listening');
                    if (micBtn) micBtn.classList.add('listening');
                    if (micIcon) micIcon.className = 'fa-solid fa-microphone-slash';
                    if (micInstruction) micInstruction.textContent = 'Listening to your answer... Click mic again to stop.';
                } else if (state === 'speaking') {
                    if (statusPill) statusPill.classList.add('speaking');
                    if (statusText) statusText.textContent = 'Speaking...';
                    if (micStage) micStage.classList.remove('listening');
                    if (micBtn) micBtn.classList.remove('listening');
                    if (micIcon) micIcon.className = 'fa-solid fa-microphone';
                    if (micInstruction) micInstruction.textContent = 'Assistant speaking active recall prompt...';
                } else if (state === 'error') {
                    if (statusText) statusText.textContent = 'Voice Error';
                    if (micStage) micStage.classList.remove('listening');
                    if (micBtn) micBtn.classList.remove('listening');
                    if (micIcon) micIcon.className = 'fa-solid fa-microphone';
                    if (micInstruction) {
                        micInstruction.textContent = error === 'not-allowed'
                            ? 'Microphone blocked. Please allow mic permissions in your browser.'
                            : 'Microphone recognition error. You can also type your answer.';
                    }
                    if (error === 'not-allowed') {
                        showToast('Microphone permission blocked. Please allow microphone access in your browser.', 'warning');
                    } else if (error === 'not-supported') {
                        showToast('Speech Recognition requires Google Chrome or Microsoft Edge.', 'warning');
                    }
                } else {
                    if (statusText) statusText.textContent = 'Voice Ready';
                    if (micStage) micStage.classList.remove('listening');
                    if (micBtn) micBtn.classList.remove('listening');
                    if (micIcon) micIcon.className = 'fa-solid fa-microphone';
                    if (micInstruction) micInstruction.textContent = 'Click microphone to answer verbally, or type below';
                }
            };

            const transcriptionDisplay = document.getElementById('transcriptionDisplay');
            const btnSubmitAnswer = document.getElementById('btnSubmitAnswer');

            voice.onTranscriptionUpdate = (text, isFinal) => {
                if (transcriptionDisplay) {
                    transcriptionDisplay.innerText = text;
                    if (btnSubmitAnswer) btnSubmitAnswer.disabled = !text || text.trim().length === 0;
                }
            };

            // Initialize sidebar voice reader pill
            const currentR = voice.getCurrentReader();
            const pillName = document.getElementById('sidebarReaderName');
            const pillAvatar = document.getElementById('sidebarReaderAvatar');
            if (currentR) {
                if (pillName) pillName.textContent = currentR.name;
                if (pillAvatar) pillAvatar.textContent = currentR.avatar;
            }
        }
    } catch (e) {
        console.warn('Voice system init warning:', e);
    }
}

// ─── AUTHENTICATION FLOW ─────────────────────────────────────────────────────
async function checkAuthStatus() {
    try {
        const res = await fetch('/api/auth/current-user');
        const data = await res.json();
        
        if (data.logged_in && data.student) {
            currentStudent = data.student;
            updateStudentUI(data.student);
            hideModal('authModal');
            return true;
        } else {
            // Unauthenticated: show login/create account modal
            currentStudent = null;
            showAuthModal(!data.has_any_accounts);
            return false;
        }
    } catch (e) {
        showAuthModal(false);
        return false;
    }
}

function showAuthModal(noAccounts = false) {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const noAccountsBanner = document.getElementById('noAccountsBanner');
    if (noAccounts) {
        if (noAccountsBanner) noAccountsBanner.style.display = 'flex';
        switchAuthTab('register');
    } else {
        if (noAccountsBanner) noAccountsBanner.style.display = 'none';
        switchAuthTab('login');
    }
}

window.switchAuthTab = function(mode) {
    const tabLogin = document.getElementById('authTabLogin');
    const tabReg   = document.getElementById('authTabRegister');
    const panelLogin = document.getElementById('authPanelLogin');
    const panelReg   = document.getElementById('authPanelRegister');
    const loginErr   = document.getElementById('authLoginError');
    const regErr     = document.getElementById('authRegError');

    if (loginErr) loginErr.style.display = 'none';
    if (regErr) regErr.style.display = 'none';

    if (mode === 'register') {
        tabLogin.style.background = 'transparent';
        tabLogin.style.color = 'var(--text-2)';
        tabReg.style.background = 'var(--primary)';
        tabReg.style.color = '#fff';
        panelLogin.style.display = 'none';
        panelReg.style.display = 'block';
    } else {
        tabLogin.style.background = 'var(--primary)';
        tabLogin.style.color = '#fff';
        tabReg.style.background = 'transparent';
        tabReg.style.color = 'var(--text-2)';
        panelLogin.style.display = 'block';
        panelReg.style.display = 'none';
    }
};

function updateStudentUI(student) {
    if (!student) return;
    const initials = student.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    
    setTxt('headerName', student.name);
    setTxt('headerYear', student.year_level || 'Student');
    setTxt('headerAvatar', initials);
    
    const welcomeTitle = document.getElementById('welcomeTitle');
    if (welcomeTitle) {
        const firstName = student.name.split(' ')[0];
        welcomeTitle.textContent = `Welcome back, ${firstName}! 👋`;
    }

    const logoutBtnLabel = document.getElementById('logoutBtnLabel');
    if (logoutBtnLabel) logoutBtnLabel.textContent = 'Log Out';
}

async function handleLogoutClick() {
    if (confirm('Are you sure you want to log out?')) {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {}
        currentStudent = null;
        setTxt('headerName', 'Guest / Log In');
        setTxt('headerYear', 'Click to authenticate');
        setTxt('headerAvatar', '?');
        showAuthModal(false);
    }
}

function handleProfileChipClick() {
    if (currentStudent) {
        const confirmLogout = confirm(`Signed in as ${currentStudent.name} (${currentStudent.student_id}).\n\nWould you like to switch accounts or log out?`);
        if (confirmLogout) handleLogoutClick();
    } else {
        showAuthModal(false);
    }
}

// ─── UNIFIED VIEW SWITCHING ──────────────────────────────────────────────────
window.showView = function(view) {
    currentView = view;
    
    // Hide all view panels
    document.querySelectorAll('.dash-content, .tasks-view, .schedule-view').forEach(el => {
        el.style.display = 'none';
    });

    // Show target view
    const target = document.getElementById('view-' + view);
    if (target) {
        target.style.display = 'block';
    }

    // Update active nav item
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById('nav-' + view);
    if (navEl) navEl.classList.add('active');

    // Update mobile bottom nav
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');
    const overlay = document.getElementById('backdropOverlay');
    if (overlay) overlay.style.display = 'none';

    // Trigger view-specific loads
    if (view === 'dashboard')  { renderDashboard(); renderReviewSchedule(); }
    if (view === 'arena')      { if (arenaState.currentSession.length === 0) startActiveRecallSession(); }
    if (view === 'flashcards') { populateFlashcardSubjects(); loadFlashcardDeck(); }
    if (view === 'materials')  { loadMaterials(); }
    if (view === 'questions')  { loadQuestionBank(); }
    if (view === 'schedule')   { renderScheduleGrid(); populateScheduleModalSubjects(); }
    if (view === 'tasks')      { setTaskViewMode(taskViewMode); renderTasks(); }
    if (view === 'analytics')  { loadStats(); renderAnalytics(); loadRecentAttempts(); }
};

// ─── SUBJECTS API & MANAGEMENT ───────────────────────────────────────────────
async function loadSubjects(selectedId = null) {
    try {
        const res = await fetch('/api/subjects');
        subjects = await res.json();
        if (!Array.isArray(subjects)) subjects = subjects.subjects || [];
    } catch (e) {
        subjects = [
            { id: 1, code: 'IT 101', name: 'Introduction to Computing', color: '#3b82f6' },
            { id: 2, code: 'IT 102', name: 'Computer Programming 1',    color: '#8b5cf6' },
            { id: 3, code: 'IT 103', name: 'Discrete Structures',       color: '#10b981' },
        ];
    }
    populateAllSubjectSelects(selectedId);
    renderExistingSubjectsManagement();
}

function populateAllSubjectSelects(selectedId = null) {
    const selects = [
        { el: document.getElementById('studySubjectSelect'),  includeAll: true,  allText: 'All Subjects' },
        { el: document.getElementById('uploadSubject'),       includeAll: false, allText: '' },
        { el: document.getElementById('customQSubject'),      includeAll: false, allText: '' },
        { el: document.getElementById('qbSubjectFilter'),     includeAll: true,  allText: 'All Subjects' },
        { el: document.getElementById('taskSubjectFilter'),   includeAll: true,  allText: 'All Subjects' },
        { el: document.getElementById('taskSubjectInput'),    includeAll: true,  allText: 'General' },
        { el: document.getElementById('headerSubjectFilter'), includeAll: true,  allText: 'All Topics / Subjects' },
        { el: document.getElementById('askModalSubject'),     includeAll: true,  allText: 'All Uploaded Course Notes' },
    ];

    selects.forEach(({ el, includeAll, allText }) => {
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = includeAll ? `<option value="all">${allText}</option>` : '';

        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = (el.id === 'taskSubjectFilter' || el.id === 'taskSubjectInput') ? s.code : s.id;
            opt.textContent = `${s.code} – ${s.name}`;
            el.appendChild(opt);
        });

        if (selectedId) {
            el.value = selectedId;
        } else if (currentVal && Array.from(el.options).some(o => o.value == currentVal)) {
            el.value = currentVal;
        }
    });
}

function renderExistingSubjectsManagement() {
    const list = document.getElementById('existingSubjectsList');
    const countLabel = document.getElementById('existingSubjectCount');
    if (countLabel) countLabel.textContent = `${subjects.length} subjects`;
    if (!list) return;

    if (subjects.length === 0) {
        list.innerHTML = '<div style="font-size:0.8rem;color:var(--text-3);padding:0.4rem;">No subjects yet. Create one above!</div>';
        return;
    }

    list.innerHTML = subjects.map(s => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.6rem;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex;align-items:center;gap:0.5rem;overflow:hidden;">
                <span class="badge" style="background:${s.color || '#6366f1'}22;color:${s.color || '#818cf8'};font-size:0.75rem;padding:0.15rem 0.45rem;border-radius:4px;font-weight:700;">${escHtml(s.code)}</span>
                <span style="font-size:0.82rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${escHtml(s.name)}</span>
            </div>
            <button type="button" class="btn-icon btn-sm" onclick="deleteSubjectDash(event, ${s.id}, '${escHtml(s.code)}')" title="Remove subject ${escHtml(s.code)}" style="color:var(--danger);padding:0.25rem 0.5rem;font-size:0.8rem;cursor:pointer;border:none;background:transparent;">
                <i class="fa-solid fa-trash"></i> Remove
            </button>
        </div>
    `).join('');
}

window.deleteSubjectDash = async function(event, id, code) {
    if (event) event.stopPropagation();
    const confirmed = confirm(`Are you sure you want to remove subject "${code}"?\n\nThis will permanently delete all associated reviewer materials, questions, and study attempts.`);
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove subject');
        
        showToast(data.message || `Subject ${code} removed successfully`, 'success');
        await loadSubjects();
        renderDashboard();
        renderReviewSchedule();
        if (currentView === 'materials') loadMaterials();
        if (currentView === 'questions') loadQuestionBank();
    } catch (err) {
        showToast(err.message || 'Error deleting subject', 'error');
    }
};

// ─── DASHBOARD: COURSES & REVIEW SCHEDULE ────────────────────────────────────
function renderDashboard() {
    renderCourseCards();
    renderAchievements();
}

const COURSE_EMOJIS = ['📚','🌐','💾','🧮','🖥️','🔬','📡','🗃️'];
const COURSE_COLORS = ['#6366f1', '#a855f7', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e'];

async function renderCourseCards() {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!subjects.length) {
        grid.innerHTML = '<div style="grid-column:span 3;text-align:center;color:#64748b;padding:2rem;">No courses found. <a href="#" onclick="showModal(\'dashSubjectModal\'); return false;" style="color:#818cf8;">Add a subject</a>.</div>';
        return;
    }

    let statsMap = {};
    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        if (stats.subject_breakdown) {
            stats.subject_breakdown.forEach(s => { statsMap[s.id] = s; });
        }
    } catch (e) {}

    subjects.slice(0, 9).forEach((s, i) => {
        const color = s.color || COURSE_COLORS[i % COURSE_COLORS.length];
        const emoji = COURSE_EMOJIS[i % COURSE_EMOJIS.length];
        const sStats = statsMap[s.id] || { mastery_rate: 0, total_questions: 0, mastered_questions: 0 };
        const pct = sStats.mastery_rate || 0;

        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `
            <div class="course-card-thumb" style="background:${color}15;position:relative;">
                <span style="position:relative;z-index:2;">${emoji}</span>
                <button type="button" class="course-delete-btn" onclick="deleteSubjectDash(event, ${s.id}, '${escHtml(s.code)}')" title="Remove subject ${escHtml(s.code)}" style="position:absolute;top:8px;right:8px;z-index:10;background:rgba(15,23,42,0.7);color:#f43f5e;border:1px solid rgba(244,63,94,0.3);border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.75rem;transition:all 0.2s;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="course-card-body">
                <div class="course-card-title">${escHtml(s.name || s.code)}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                    <span class="course-card-meta">${escHtml(s.code)}</span>
                    <span style="font-size:0.72rem;color:var(--text-3);">${sStats.total_questions} questions</span>
                </div>
                <div class="course-progress-row">
                    <div class="course-progress-bar-wrap">
                        <div class="course-progress-fill" style="width:${pct}%;background:${color};"></div>
                    </div>
                    <span class="course-progress-pct" style="color:${color};">${pct}%</span>
                </div>
            </div>`;
        
        card.addEventListener('click', (e) => {
            if (e.target.closest('.course-delete-btn')) return;
            startPracticeForSubject(s.id);
        });
        grid.appendChild(card);
    });
}

// ─── REVIEW SCHEDULE (WHAT TO REVIEW FIRST & STATUS) ─────────────────────────
async function renderReviewSchedule() {
    const panel = document.getElementById('reviewSchedulePanel');
    if (!panel) return;
    panel.innerHTML = '<div style="padding:1rem;text-align:center;color:#64748b;font-size:.82rem;"><i class="fa-solid fa-spinner fa-spin"></i> Checking review priorities…</div>';

    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        const breakdown = stats.subject_breakdown || [];

        if (!breakdown.length) {
            panel.innerHTML = '<div style="padding:1.5rem;text-align:center;color:#64748b;font-size:.85rem;">No subjects registered yet. <a href="#" onclick="showModal(\'dashSubjectModal\'); return false;" style="color:#818cf8;">Add a subject</a></div>';
            return;
        }

        // Sort by mastery ascending (lowest mastery = review first)
        breakdown.sort((a, b) => {
            if (a.total_questions > 0 && b.total_questions === 0) return -1;
            if (b.total_questions > 0 && a.total_questions === 0) return 1;
            return a.mastery_rate - b.mastery_rate;
        });

        panel.innerHTML = '';
        const COLORS = ['#6366f1', '#a855f7', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e'];

        breakdown.forEach((sub, i) => {
            const color = sub.color || COLORS[i % COLORS.length];
            let statusClass, statusLabel, priorityBadge, scheduleTime;
            const weakCount = sub.total_questions - sub.mastered_questions;

            if (sub.total_questions === 0) {
                statusClass = 'new';
                statusLabel = 'No Questions';
                priorityBadge = 'Queue Empty';
                scheduleTime = 'Upload reviewer notes';
            } else if (sub.mastery_rate >= 85) {
                statusClass = 'mastered';
                statusLabel = 'Mastered';
                priorityBadge = `#${i + 1} Review`;
                scheduleTime = 'Retention optimal';
            } else if (sub.mastery_rate >= 50) {
                statusClass = 'partial';
                statusLabel = 'Reviewing';
                priorityBadge = `#${i + 1} Priority`;
                scheduleTime = 'Review scheduled today';
            } else {
                statusClass = 'weak';
                statusLabel = 'Review First';
                priorityBadge = `#${i + 1} Urgent Review`;
                scheduleTime = 'Review due now';
            }

            const row = document.createElement('div');
            row.className = 'review-item';
            row.innerHTML = `
                <div class="review-item-icon" style="background:${color}22;color:${color};">
                    <i class="fa-solid fa-brain"></i>
                </div>
                <div class="review-item-body">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
                        <span class="review-priority-tag ${statusClass}" style="font-size:0.68rem;font-weight:700;letter-spacing:0.4px;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.06);color:${color};">${priorityBadge}</span>
                        <span class="review-score" style="color:${sub.mastery_rate >= 70 ? '#10b981' : sub.mastery_rate >= 40 ? '#f59e0b' : '#f43f5e'};font-weight:700;font-size:0.8rem;">${sub.mastery_rate}%</span>
                    </div>
                    <div class="review-item-title" style="font-weight:600;font-size:0.85rem;">${escHtml(sub.code)}: ${escHtml(sub.name)}</div>
                    <div class="review-item-sub" style="display:flex;align-items:center;gap:6px;margin-top:3px;font-size:0.73rem;">
                        <span class="status-badge ${statusClass}">
                            <i class="fa-solid ${statusClass === 'mastered' ? 'fa-circle-check' : statusClass === 'weak' ? 'fa-triangle-exclamation' : statusClass === 'new' ? 'fa-plus' : 'fa-arrows-rotate'}"></i>
                            ${statusLabel}
                        </span>
                        <span style="color:#94a3b8;">• ${scheduleTime}</span>
                        ${weakCount > 0 ? `<span style="color:#fda4af;font-weight:600;">(${weakCount} weak)</span>` : ''}
                    </div>
                </div>
                <button class="review-action-btn" title="Practice in voice arena" onclick="event.stopPropagation(); startPracticeForSubject(${sub.id});" style="padding:0.35rem 0.75rem;border-radius:8px;background:${color}22;color:${color};border:1px solid ${color}44;font-size:0.75rem;font-weight:600;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;">
                    <i class="fa-solid fa-microphone"></i> Practice
                </button>`;
            
            row.addEventListener('click', () => startPracticeForSubject(sub.id));
            panel.appendChild(row);
        });
    } catch (e) {
        panel.innerHTML = '<div style="padding:1rem;color:#f43f5e;font-size:.82rem;">Failed to load review schedule.</div>';
    }
}

// Helper to launch practice arena for a specific subject
window.startPracticeForSubject = function(subjectId) {
    showView('arena');
    const select = document.getElementById('studySubjectSelect');
    if (select) {
        select.value = subjectId;
    }
    startActiveRecallSession();
};

// ─── VOICE STUDY ARENA LOGIC ─────────────────────────────────────────────────
let arenaAudioEnabled = true;
let arenaInputMode = 'voice';
let isQuizSession = false;
let currentQuizResults = [];

async function startActiveRecallSession() {
    const select = document.getElementById('studySubjectSelect');
    const modeSelect = document.getElementById('studyModeSelect');
    const btnStart = document.getElementById('btnStartSession');

    const subject_id = select ? select.value : 'all';
    const mode       = modeSelect ? modeSelect.value : 'all';

    isQuizSession = (mode === 'quiz5' || mode === 'quiz10');
    currentQuizResults = [];
    const limit = mode === 'quiz5' ? 5 : (mode === 'quiz10' ? 10 : 10);

    if (btnStart) {
        btnStart.disabled = true;
        btnStart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing Session...';
    }

    try {
        const res = await fetch('/api/study/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject_id, mode: isQuizSession ? 'all' : mode, limit })
        });
        const data = await res.json();

        if (!data.questions || data.questions.length === 0) {
            showToast('No questions found for this selection. Upload reviewer notes or select "All Subjects".', 'warning');
            const qText = document.getElementById('qText');
            if (qText) qText.textContent = 'No questions found. Upload your reviewer material in the Review Materials tab to generate flashcards.';
            return;
        }

        // Limit questions if quiz mode
        let questions = data.questions;
        if (isQuizSession) {
            questions = questions.slice(0, limit);
        }

        arenaState.currentSession = questions;
        arenaState.currentQuestionIndex = 0;
        displayCurrentArenaQuestion();
        if (isQuizSession) {
            showToast(`Started Practice Quiz (${questions.length} questions). Good luck!`, 'info');
        }
    } catch (e) {
        showToast('Failed to start session. Check connection.', 'error');
    } finally {
        if (btnStart) {
            btnStart.disabled = false;
            btnStart.innerHTML = '<i class="fa-solid fa-play"></i> Start Session';
        }
    }
}

function displayCurrentArenaQuestion() {
    const q = arenaState.currentSession[arenaState.currentQuestionIndex];
    if (!q) return;

    arenaState.currentQuestion = q;

    setTxt('qSubjectBadge', q.subject_code || 'BSIT');
    setTxt('qTypeBadge', (q.question_type || 'FLASHCARD').toUpperCase());
    setTxt('qDiffBadge', (q.difficulty || 'MEDIUM').toUpperCase());
    const totalCount = arenaState.currentSession.length;
    const counterPrefix = isQuizSession ? 'Quiz Question' : 'Question';
    setTxt('qCounterText', `${counterPrefix} ${arenaState.currentQuestionIndex + 1} of ${totalCount}`);
    setTxt('qText', q.question_text);

    // Reset inputs
    const display = document.getElementById('transcriptionDisplay');
    const btnSubmit = document.getElementById('btnSubmitAnswer');
    const feedback = document.getElementById('feedbackCard');
    const sourceExcerptDrawer = document.getElementById('sourceExcerptDrawer');

    if (display) display.innerText = '';
    if (btnSubmit) btnSubmit.disabled = true;
    if (feedback) feedback.style.display = 'none';
    if (sourceExcerptDrawer) sourceExcerptDrawer.style.display = 'none';

    // Auto read prompt aloud (if audio is enabled)
    if (arenaAudioEnabled && arenaState.autoSpeakQuestion && voice) {
        voice.speak(q.question_text);
    }
}

async function evaluateCurrentAnswer() {
    const display = document.getElementById('transcriptionDisplay');
    const spokenAnswer = display ? display.innerText.trim() : '';
    if (!spokenAnswer || !arenaState.currentQuestion) return;

    if (voice) {
        voice.stopListening();
        voice.stopSpeaking();
    }

    const btnSubmit = document.getElementById('btnSubmitAnswer');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Evaluating Semantic Answer...';
    }

    const audioLengthSelect = document.getElementById('arenaAudioLength');
    const audioLength = audioLengthSelect ? audioLengthSelect.value : 'concise';

    try {
        const res = await fetch('/api/study/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_id: arenaState.currentQuestion.id,
                spoken_answer: spokenAnswer,
                is_voice_input: (arenaInputMode === 'voice'),
                audio_length: audioLength
            })
        });

        const result = await res.json();
        
        // Track quiz result if in quiz mode
        if (isQuizSession) {
            currentQuizResults.push({
                question: arenaState.currentQuestion.question_text,
                score: result.score,
                is_passed: result.is_passed,
                expected_answer: result.expected_answer,
                student_answer: spokenAnswer
            });
        }

        renderEvaluationFeedback(result);
        renderReviewSchedule(); // update review queue
    } catch (e) {
        showToast('Evaluation failed. Check server connection.', 'error');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-check-circle"></i> Evaluate Answer';
        }
    }
}

function renderEvaluationFeedback(res) {
    const feedbackCard = document.getElementById('feedbackCard');
    if (!feedbackCard) return;

    feedbackCard.style.display = 'flex';
    feedbackCard.className = res.is_passed ? 'card feedback-card glass-panel' : 'card feedback-card glass-panel failed';

    const verdictLabel = document.getElementById('verdictLabel');
    const verdictIcon  = document.getElementById('verdictIcon');
    const voiceMemoText = document.getElementById('voiceMemoText');
    const calloutExpected = document.getElementById('calloutExpectedAnswer');
    const scoreNumber = document.getElementById('scoreNumber');
    const scoreTitle  = document.getElementById('scoreTitle');
    const scoreSubtitle = document.getElementById('scoreSubtitle');
    const feedbackTextContent = document.getElementById('feedbackTextContent');

    if (res.is_passed) {
        if (verdictLabel) verdictLabel.textContent = "CORRECT!";
        if (verdictIcon)  verdictIcon.className = "fa-solid fa-circle-check";
        if (scoreTitle)   scoreTitle.textContent = res.is_mastered ? 'Concept Mastered!' : 'Great Answer!';
        if (scoreSubtitle) scoreSubtitle.textContent = 'Accurately articulated the concepts in your notes';
    } else {
        if (verdictLabel) verdictLabel.textContent = "WRONG";
        if (verdictIcon)  verdictIcon.className = "fa-solid fa-circle-xmark";
        if (scoreTitle)   scoreTitle.textContent = 'Incorrect / Needs Review';
        if (scoreSubtitle) scoreSubtitle.textContent = 'Re-queued for active recall practice';
    }

    const memo = res.voice_memo || (res.is_passed ? `Correct! ${res.feedback}` : `Wrong. The correct answer is: ${res.expected_answer}. ${res.feedback}`);
    if (voiceMemoText) voiceMemoText.textContent = `"${memo}"`;
    arenaState.lastVoiceMemo = memo;

    if (calloutExpected) calloutExpected.textContent = res.expected_answer;
    if (scoreNumber) scoreNumber.textContent = Math.round(res.score);
    if (feedbackTextContent) feedbackTextContent.textContent = res.feedback;

    // Source Grounding details for AI Verification (86.7% survey finding)
    const sourceTitleEl = document.getElementById('feedbackSourceTitle');
    const sourceSnippetEl = document.getElementById('feedbackSourceSnippet');
    const defaultDocTitle = (arenaState.currentQuestion && arenaState.currentQuestion.material_title) || 'Uploaded BSIT Lecture Notes';
    const defaultSnippet = (arenaState.currentQuestion && arenaState.currentQuestion.source_snippet) || 'Verified grounded in student-provided reviewer.';

    if (sourceTitleEl) sourceTitleEl.textContent = res.source_material_title || defaultDocTitle;
    if (sourceSnippetEl) sourceSnippetEl.textContent = res.source_material_snippet || defaultSnippet;

    // Missing concepts tags
    const missingBox = document.getElementById('missingConceptsBox');
    const missingList = document.getElementById('missingConceptsList');
    if (res.missing_concepts && res.missing_concepts.length > 0 && missingBox && missingList) {
        missingBox.style.display = 'block';
        missingList.innerHTML = res.missing_concepts.map(c => `<span class="concept-tag">${escHtml(c)}</span>`).join('');
    } else if (missingBox) {
        missingBox.style.display = 'none';
    }

    // Speak voice memo only if arenaAudioEnabled is true
    if (arenaAudioEnabled && voice) {
        setTimeout(() => voice.speak(memo), 250);
    }
}

function moveToNextQuestion() {
    arenaState.currentQuestionIndex++;
    if (arenaState.currentQuestionIndex < arenaState.currentSession.length) {
        displayCurrentArenaQuestion();
    } else {
        if (isQuizSession) {
            renderPracticeQuizSummary();
        } else {
            showToast('Active recall session complete! Excellent practice.', 'success');
            if (arenaAudioEnabled && voice) voice.speak("Congratulations! You have completed all questions in this active recall practice session.");
            setTxt('qText', "Session Complete! You've reviewed all queued questions. Click 'Start Session' to practice again.");
            const feedback = document.getElementById('feedbackCard');
            if (feedback) feedback.style.display = 'none';
        }
    }
}

function renderPracticeQuizSummary() {
    const totalQ = currentQuizResults.length;
    if (totalQ === 0) return;

    const totalScore = currentQuizResults.reduce((acc, r) => acc + r.score, 0);
    const avgScore = Math.round(totalScore / totalQ);
    const passedCount = currentQuizResults.filter(r => r.is_passed).length;

    setTxt('quizScoreNumber', `${avgScore}%`);
    const heading = document.getElementById('quizVerdictHeading');
    const sub = document.getElementById('quizSummarySub');

    if (avgScore >= 80) {
        if (heading) { heading.textContent = 'Outstanding Mastery! 🏆'; heading.style.color = 'var(--success)'; }
        if (sub) sub.textContent = `You passed ${passedCount} of ${totalQ} questions. Exceptional retention!`;
    } else if (avgScore >= 70) {
        if (heading) { heading.textContent = 'Quiz Passed! 👍'; heading.style.color = 'var(--primary-light)'; }
        if (sub) sub.textContent = `You passed ${passedCount} of ${totalQ} questions. Good grasp of concepts.`;
    } else {
        if (heading) { heading.textContent = 'Review Recommended 📚'; heading.style.color = 'var(--warning)'; }
        if (sub) sub.textContent = `Passed ${passedCount} of ${totalQ}. Missed questions are saved to Spaced Repetition.`;
    }

    const breakdown = document.getElementById('quizQuestionsBreakdown');
    if (breakdown) {
        breakdown.innerHTML = currentQuizResults.map((r, i) => `
            <div style="background:rgba(255,255,255,0.03);border:1px solid ${r.is_passed ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'};border-radius:6px;padding:6px 10px;font-size:0.8rem;display:flex;justify-content:space-between;align-items:center;">
                <div style="text-overflow:ellipsis;overflow:hidden;white-space:nowrap;max-width:320px;">
                    <i class="fa-solid ${r.is_passed ? 'fa-check' : 'fa-xmark'}" style="color:${r.is_passed ? '#10b981' : '#f43f5e'};margin-right:6px;"></i>
                    <strong>Q${i+1}:</strong> ${escHtml(r.question)}
                </div>
                <span style="font-weight:700;color:${r.is_passed ? '#10b981' : '#f43f5e'};">${Math.round(r.score)}%</span>
            </div>
        `).join('');
    }

    const modal = document.getElementById('quizSummaryModal');
    if (modal) modal.style.display = 'flex';
    if (arenaAudioEnabled && voice) {
        voice.speak(`Practice quiz finished. Your score is ${avgScore} percent.`);
    }
}

// ─── REVIEW MATERIALS & NOTES ────────────────────────────────────────────────
async function loadMaterials() {
    const grid = document.getElementById('materialsGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-state" style="padding:2rem;text-align:center;color:var(--text-3);"><i class="fa-solid fa-spinner fa-spin"></i> Loading course reviewers...</div>';

    try {
        const res = await fetch('/api/materials');
        const materials = await res.json();

        if (materials.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:span 3;text-align:center;padding:3rem 1rem;color:var(--text-3);">
                    <i class="fa-solid fa-folder-open" style="font-size:2.5rem;color:var(--primary-light);margin-bottom:0.75rem;display:block;"></i>
                    <h3 style="color:#fff;margin-bottom:0.4rem;">No Review Materials Uploaded Yet</h3>
                    <p style="font-size:0.85rem;margin-bottom:1rem;">Upload your course handouts or lecture notes (PDF/TXT) to begin generating flashcards.</p>
                    <button class="btn btn-primary btn-sm" onclick="showModal('uploadModal');"><i class="fa-solid fa-plus"></i> Upload First Reviewer</button>
                </div>`;
            return;
        }

        grid.innerHTML = materials.map(m => `
            <div class="card glass-panel material-card" style="display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                        <span class="badge" style="background:rgba(99,102,241,0.15);color:#818cf8;font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:4px;font-weight:700;">${escHtml(m.subject_code)}</span>
                        <span style="font-size:0.75rem;color:var(--text-3);"><i class="fa-solid fa-calendar"></i> ${m.created_at}</span>
                    </div>
                    <h3 style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:0.4rem;">${escHtml(m.title)}</h3>
                    <p style="font-size:0.82rem;color:var(--text-2);line-height:1.5;">${escHtml(m.content_snippet)}</p>
                </div>
                <div style="margin-top:1rem;border-top:1px solid var(--border);padding-top:0.75rem;display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-size:0.75rem;color:var(--text-3);display:flex;gap:10px;">
                        <span><i class="fa-solid fa-file-lines"></i> ${m.word_count} words</span>
                        <span><i class="fa-solid fa-circle-question"></i> ${m.questions_count} flashcards</span>
                    </div>
                    <div style="display:flex;gap:4px;">
                        <button class="btn-icon btn-sm" onclick="viewReviewerContent(${m.id})" title="View Content" style="border:none;background:transparent;color:var(--text-2);cursor:pointer;font-size:0.85rem;">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="btn-icon btn-sm" onclick="synthesizeReviewerQuestions(${m.id})" title="Synthesize Assessment Questions" style="border:none;background:transparent;color:#06b6d4;cursor:pointer;font-size:0.85rem;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </button>
                        <button class="btn-icon btn-sm" onclick="deleteReviewerMaterial(${m.id})" title="Delete" style="border:none;background:transparent;color:#f43f5e;cursor:pointer;font-size:0.85rem;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        grid.innerHTML = '<div style="color:#f43f5e;padding:1rem;">Failed to load materials.</div>';
    }
}

window.viewReviewerContent = async function(id) {
    try {
        const res = await fetch(`/api/materials/${id}`);
        const mat = await res.json();
        setTxt('viewMaterialTitle', `${mat.subject_code}: ${mat.title}`);
        const body = document.getElementById('viewMaterialBody');
        if (body) body.textContent = mat.full_content || mat.content_text;
        showModal('viewMaterialModal');
    } catch (e) {
        showToast('Failed to load reviewer text', 'error');
    }
};

window.synthesizeReviewerQuestions = async function(id) {
    showToast('Synthesizing grounded assessment questions from notes...', 'info');
    try {
        const res = await fetch(`/api/materials/${id}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: 6 })
        });
        const data = await res.json();
        showToast(data.message || 'Assessment questions generated successfully!', 'success');
        loadMaterials();
        loadQuestionBank();
        renderReviewSchedule();
    } catch (e) {
        showToast('Failed to synthesize questions', 'error');
    }
};

window.deleteReviewerMaterial = async function(id) {
    if (!confirm('Are you sure you want to delete this reviewer material and its generated questions?')) return;
    try {
        await fetch(`/api/materials/${id}`, { method: 'DELETE' });
        showToast('Reviewer deleted successfully', 'success');
        loadMaterials();
        renderReviewSchedule();
    } catch (e) {
        showToast('Failed to delete reviewer', 'error');
    }
};

// ─── QUESTION BANK LOGIC ─────────────────────────────────────────────────────
async function loadQuestionBank() {
    const tbody = document.getElementById('questionTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading assessment question bank...</td></tr>';

    const subFilter = document.getElementById('qbSubjectFilter');
    const statusFilter = document.getElementById('qbStatusFilter');
    const subId  = subFilter ? subFilter.value : 'all';
    const status = statusFilter ? statusFilter.value : 'all';

    try {
        const res = await fetch(`/api/questions?subject_id=${subId}&filter=${status}`);
        const questions = await res.json();

        if (questions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 2.5rem; color:var(--text-3);">No questions found. Upload reviewer notes to generate assessment questions automatically.</td></tr>';
            return;
        }

        tbody.innerHTML = questions.map(q => {
            const diff = (q.difficulty || 'moderate').toLowerCase();
            const diffColor = diff === 'easy' ? '#10b981' : diff === 'hard' ? '#f43f5e' : '#f59e0b';
            const diffBg    = diff === 'easy' ? 'rgba(16,185,129,0.12)' : diff === 'hard' ? 'rgba(244,63,94,0.12)' : 'rgba(245,158,11,0.12)';
            const hasDetail = !!(q.explanation || q.topic || q.source_reference || (q.choices && q.choices.length));
            const qJson = encodeURIComponent(JSON.stringify(q));
            return `
            <tr>
                <td><span class="badge" style="background:rgba(99,102,241,0.15);color:#818cf8;font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:4px;font-weight:700;">${escHtml(q.subject_code || '')}</span></td>
                <td style="max-width: 260px; font-weight: 500; font-size: 0.87rem; line-height: 1.4;">${escHtml(q.question_text || '')}</td>
                <td style="max-width: 230px; color: var(--text-2); font-size: 0.82rem;">${escHtml(q.expected_answer || '')}</td>
                <td>
                    <span class="badge" style="background:rgba(6,182,212,0.15);color:#06b6d4;font-size:0.72rem;padding:0.15rem 0.4rem;border-radius:4px;display:block;margin-bottom:3px;white-space:nowrap;">${escHtml(q.question_type || '')}</span>
                    <span class="badge" style="background:${diffBg};color:${diffColor};font-size:0.68rem;padding:0.1rem 0.35rem;border-radius:4px;font-weight:600;">${escHtml((q.difficulty || 'Moderate'))}</span>
                </td>
                <td><strong style="color: ${q.last_score >= 70 ? 'var(--success)' : 'var(--danger)'};">${q.last_score}%</strong></td>
                <td>
                    <span class="badge ${q.is_mastered ? 'status-badge mastered' : 'status-badge weak'}" style="font-size:0.72rem;">
                        ${q.is_mastered ? 'Mastered' : 'Needs Practice'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                        ${hasDetail ? `<button title="View Assessment Details" onclick="viewQuestionAssessmentDetail(JSON.parse(decodeURIComponent('${qJson}')))" style="border:none;background:rgba(99,102,241,0.15);cursor:pointer;color:#818cf8;border-radius:6px;padding:4px 7px;font-size:0.8rem;">
                            <i class="fa-solid fa-eye"></i>
                        </button>` : ''}
                        <button title="Toggle Mastery" onclick="toggleMastery(${q.id}, ${!q.is_mastered})" style="border:none;background:transparent;cursor:pointer;color:var(--text-2);font-size:0.85rem;">
                            <i class="fa-solid ${q.is_mastered ? 'fa-circle-xmark' : 'fa-circle-check'}"></i>
                        </button>
                        <button title="Delete" onclick="deleteQuestion(${q.id})" style="border:none;background:transparent;cursor:pointer;color:var(--danger);font-size:0.85rem;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:var(--danger);padding:1.5rem;">Failed to load question bank.</td></tr>';
    }
}

window.toggleMastery = async function(id, newStatus) {
    try {
        await fetch(`/api/questions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_mastered: newStatus })
        });
        showToast('Mastery status updated', 'success');
        loadQuestionBank();
        renderReviewSchedule();
    } catch (e) {
        showToast('Failed to update status', 'error');
    }
};

window.deleteQuestion = async function(id) {
    if (!confirm('Are you sure you want to delete this study question?')) return;
    try {
        await fetch(`/api/questions/${id}`, { method: 'DELETE' });
        showToast('Question deleted', 'success');
        loadQuestionBank();
        renderReviewSchedule();
    } catch (e) {
        showToast('Failed to delete question', 'error');
    }
};

// ─── STATS & ANALYTICS ───────────────────────────────────────────────────────
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();

        setTxt('statMasteryRate', (stats.mastery_rate || 0) + '%');
        setTxt('statMasteredCount', stats.mastered_questions || 0);
        setTxt('statWeakCount', stats.weak_questions || 0);
        setTxt('statTotalAttempts', stats.total_attempts || 0);

        setTxt('weeklyGoalPct', (stats.mastery_rate || 0) + '%');
        const fill = document.getElementById('weeklyProgressFill');
        if (fill) fill.style.width = (stats.mastery_rate || 0) + '%';

        // Subject breakdown in Analytics
        const container = document.getElementById('subjectProgressContainer');
        if (container && stats.subject_breakdown) {
            container.innerHTML = stats.subject_breakdown.map(sub => `
                <div class="sub-prog-card" style="padding:1rem;background:rgba(255,255,255,0.02);border-radius:10px;border:1px solid var(--border);margin-bottom:0.75rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                        <span style="font-weight:600;font-size:0.9rem;">${escHtml(sub.code)}: ${escHtml(sub.name)}</span>
                        <div style="display:flex;align-items:center;gap:0.75rem;">
                            <span style="font-weight:700;color:${sub.mastery_rate >= 70 ? 'var(--success)' : 'var(--warning)'};font-size:0.88rem;">${sub.mastery_rate}%</span>
                            <button class="btn-icon btn-sm" onclick="deleteSubjectDash(event, ${sub.id}, '${escHtml(sub.code)}')" title="Remove Subject ${escHtml(sub.code)}" style="border:none;background:transparent;color:var(--danger);cursor:pointer;font-size:0.8rem;">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="progress-bar-wrap" style="height:6px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden;margin-bottom:0.4rem;">
                        <div class="progress-bar-fill" style="width: ${sub.mastery_rate}%;height:100%;background:${sub.color || '#6366f1'};border-radius:100px;"></div>
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-3);">
                        ${sub.mastered_questions} of ${sub.total_questions} flashcards mastered
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {}
}

function renderAnalytics() {
    loadStats();
    const heatmap = document.getElementById('activityHeatmap');
    if (!heatmap) return;
    heatmap.innerHTML = '';
    const days = 28;
    for (let i = 0; i < days; i++) {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        const lvl = Math.floor(Math.random() * 4);
        if (lvl > 0) cell.classList.add(`level-${lvl}`);
        cell.title = `Study Activity Level ${lvl}`;
        heatmap.appendChild(cell);
    }
}

// ─── SCHEDULE & CALENDAR ─────────────────────────────────────────────────────
function renderCalendar() {
    const label = document.getElementById('calMonthLabel');
    const daysEl = document.getElementById('calDays');
    if (!daysEl) return;
    daysEl.innerHTML = '';

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (label) label.textContent = `${months[calMonth]} ${calYear}`;

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
    const startOffset = (firstDay + 6) % 7; // Monday start

    for (let i = 0; i < startOffset; i++) {
        const blank = document.createElement('span');
        blank.className = 'cal-day empty';
        daysEl.appendChild(blank);
    }

    const today = new Date();
    for (let d = 1; d <= totalDays; d++) {
        const span = document.createElement('span');
        span.className = 'cal-day';
        span.textContent = d;

        if (d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()) {
            span.classList.add('today');
        }
        daysEl.appendChild(span);
    }
}

function renderScheduleGrid(filterCode = 'all') {
    const tbody = document.getElementById('timetableBody');
    if (!tbody) return;

    // Highlight today's column
    const today = new Date();
    const todayDow = (today.getDay() + 6) % 7; // 0=Mon..5=Sat, 6=Sun
    // Set day-date sub labels
    for (let d = 0; d < 6; d++) {
        const labelEl = document.getElementById(`schedDay${d}Date`);
        if (labelEl) {
            const dt = new Date(today);
            const offset = d - todayDow;
            dt.setDate(today.getDate() + offset);
            labelEl.textContent = `${dt.getMonth()+1}/${dt.getDate()}`;
        }
        const th = document.querySelector(`th.day-header-cell[data-day="${d}"]`);
        if (th) th.classList.toggle('today-col', d === todayDow);
    }

    tbody.innerHTML = '';

    // Filtered schedule based on subject filter
    const filteredSchedules = filterCode === 'all'
        ? schedules
        : schedules.filter(s => s.code === filterCode || s.title.includes(filterCode));

    PERIOD_MAP.forEach((period, pIdx) => {
        // Insert midday break row between 3rd & 4th period
        if (pIdx === 3) {
            const breakRow = document.createElement('tr');
            breakRow.className = 'timetable-break-row';
            breakRow.innerHTML = `<td colspan="7"><span class="break-indicator"><i class="fa-solid fa-mug-hot"></i> Midday Break &mdash; 12:00 – 01:00 PM</span></td>`;
            tbody.appendChild(breakRow);
        }

        const tr = document.createElement('tr');

        // Time slot cell
        const timeTd = document.createElement('td');
        timeTd.className = 'time-slot-cell';
        timeTd.innerHTML = `
            <div class="time-badge-primary">${period.label}</div>
            <div class="time-badge-period">${period.period}</div>`;
        tr.appendChild(timeTd);

        // Day cells (Mon=0 to Sat=5)
        for (let d = 0; d < 6; d++) {
            const td = document.createElement('td');
            td.className = 'timetable-cell';
            const slot = filteredSchedules.find(s => s.day === d && s.period === period.id);

            if (slot) {
                const isDrill = slot.type === 'Recall Drill';
                const subjectId = subjects.find(sub =>
                    slot.code && (sub.code === slot.code || slot.title.includes(sub.code))
                )?.id || null;

                td.innerHTML = `
                    <div class="timetable-slot-card ${slot.color}">
                        <div class="slot-card-top">
                            <span class="slot-code-badge">${escHtml(slot.code || '─')}</span>
                            <span class="slot-type-badge">${escHtml(slot.type || 'Lecture')}</span>
                        </div>
                        <div class="slot-title">${escHtml(slot.title)}</div>
                        <div class="slot-location"><i class="fa-solid fa-location-dot"></i> ${escHtml(slot.room)}</div>
                        <div class="slot-actions">
                            ${isDrill
                                ? `<button class="btn-slot-practice" onclick="startActiveRecallSession();showView('arena');"><i class="fa-solid fa-microphone"></i> Start Drill</button>`
                                : (subjectId
                                    ? `<button class="btn-slot-practice" onclick="startPracticeForSubject(${subjectId});"><i class="fa-solid fa-microphone"></i> Practice</button>`
                                    : `<button class="btn-slot-practice" onclick="showView('arena');"><i class="fa-solid fa-microphone"></i> Practice</button>`)
                            }
                            <button class="btn-slot-delete" onclick="deleteScheduleSlot('${slot.id}');" title="Remove slot"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>`;
            } else {
                td.innerHTML = `
                    <div class="timetable-empty-add" onclick="prefillScheduleModal(${d}, '${period.id}');" title="Add class slot">
                        <i class="fa-solid fa-plus"></i>&nbsp; Add
                    </div>`;
            }
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    });
}

// ─── SCHEDULE SLOT CRUD ───────────────────────────────────────────────────────
window.deleteScheduleSlot = function(id) {
    schedules = schedules.filter(s => s.id !== id);
    saveJSON(SCHED_KEY, schedules);
    renderScheduleGrid();
    showToast('Schedule slot removed.', 'info');
};

window.prefillScheduleModal = function(day, periodId) {
    const dayEl = document.getElementById('schedDaySelect');
    const periodEl = document.getElementById('schedPeriodSelect');
    if (dayEl) dayEl.value = day;
    if (periodEl) periodEl.value = periodId;
    openAddScheduleModal();
};

window.openAddScheduleModal = function() {
    populateScheduleModalSubjects();
    const modal = document.getElementById('addScheduleModal');
    if (modal) modal.style.display = 'flex';
};

window.closeAddScheduleModal = function() {
    const modal = document.getElementById('addScheduleModal');
    if (modal) modal.style.display = 'none';
};

function populateScheduleModalSubjects() {
    const sel = document.getElementById('schedSubjectSelect');
    const ttSel = document.getElementById('timetableSubjectFilter');
    if (!sel) return;
    sel.innerHTML = subjects.map(s =>
        `<option value="${s.code}">${escHtml(s.code)} – ${escHtml(s.name)}</option>`
    ).join('');
    sel.innerHTML += '<option value="Drill">Active Recall Drill</option>';

    if (ttSel && ttSel.options.length <= 1) {
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.code;
            opt.textContent = `${s.code} – ${s.name}`;
            ttSel.appendChild(opt);
        });
    }
}

window.filterTimetableBySubject = function() {
    const sel = document.getElementById('timetableSubjectFilter');
    renderScheduleGrid(sel ? sel.value : 'all');
};

// Add Schedule form handler (wired in initEventListeners)
function initScheduleFormHandler() {
    const form = document.getElementById('addScheduleForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = document.getElementById('schedSubjectSelect').value;
        const day = parseInt(document.getElementById('schedDaySelect').value, 10);
        const period = document.getElementById('schedPeriodSelect').value;
        const room = document.getElementById('schedRoomInput').value.trim();
        const type = document.getElementById('schedTypeSelect').value;
        const color = document.getElementById('schedColorSelect').value;

        const subject = subjects.find(s => s.code === code);
        const title = subject ? `${subject.code} – ${subject.name}` : (code === 'Drill' ? 'Active Recall Drill' : code);

        // Check for conflicts
        const conflict = schedules.find(s => s.day === day && s.period === period);
        if (conflict) {
            showToast(`Conflict: ${conflict.title} is already scheduled in that slot.`, 'warning');
            return;
        }

        const newSlot = { id: uid(), day, period, title, color, room, type, code };
        schedules.push(newSlot);
        saveJSON(SCHED_KEY, schedules);
        closeAddScheduleModal();
        form.reset();
        renderScheduleGrid();
        showToast(`${title} added to timetable!`, 'success');
    });
}

// ─── TASK TRACKING ───────────────────────────────────────────────────────────
const TASK_VIEW_KEY = 'sb_task_view_mode';
let taskViewMode    = localStorage.getItem(TASK_VIEW_KEY) || 'table';
let taskSearchQuery = '';

const TASK_TYPE_CONFIG = {
    study:      { label: 'Study Session', icon: 'fa-book-open',      color: '#818cf8', bg: 'rgba(99,102,241,0.12)' },
    quiz:       { label: 'Quiz Prep',     icon: 'fa-circle-question',color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
    assignment: { label: 'Assignment',    icon: 'fa-pen-to-square',  color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    exam:       { label: 'Exam Prep',     icon: 'fa-graduation-cap', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
    project:    { label: 'Project',       icon: 'fa-laptop-code',    color: '#34d399', bg: 'rgba(52,211,153,0.12)' }
};

const TASK_PRIORITY_CONFIG = {
    high:   { label: 'High',   icon: 'fa-arrow-up',   color: '#fb7185', bg: 'rgba(244,63,94,0.12)' },
    medium: { label: 'Medium', icon: 'fa-minus',      color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
    low:    { label: 'Low',    icon: 'fa-arrow-down', color: '#34d399', bg: 'rgba(16,185,129,0.12)' }
};

function seedDefaultTasks(subjectList) {
    if (tasks.length > 0) return;
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    const addDays = n => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };

    tasks = [
        { id: uid(), title: 'Prepare Verbal Review for IT 101', subject: 'IT 101', type: 'study', dueDate: fmt(today), priority: 'high', status: 'todo', notes: 'Master CPU definitions & computer fundamentals' },
        { id: uid(), title: 'Discrete Structures Logic Exercises', subject: 'IT 103', type: 'assignment', dueDate: addDays(2), priority: 'medium', status: 'inprogress', notes: 'Truth table review & set theory equations' },
        { id: uid(), title: 'Programming Control Structures Drill', subject: 'IT 102', type: 'quiz', dueDate: addDays(4), priority: 'high', status: 'todo', notes: 'Loops, conditional statements & functions' },
        { id: uid(), title: 'Read Systems Architecture Course Notes', subject: 'IT 101', type: 'study', dueDate: addDays(-1), priority: 'low', status: 'done', notes: 'Completed chapter 1 & 2 summaries' },
    ];
    saveJSON(TASKS_KEY, tasks);
}

function parseDueDateInfo(dueStr) {
    if (!dueStr) return { formatted: 'No deadline', tag: '', isOverdue: false, isToday: false, badgeClass: '' };
    try {
        const parts = dueStr.split('-');
        if (parts.length !== 3) return { formatted: dueStr, tag: '', isOverdue: false, isToday: false, badgeClass: '' };
        const due = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);

        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const formatted = `${monthNames[due.getMonth()]} ${due.getDate()}, ${due.getFullYear()}`;

        if (diffDays < 0) {
            return { formatted, tag: `${Math.abs(diffDays)}d overdue`, isOverdue: true, isToday: false, badgeClass: 'overdue' };
        } else if (diffDays === 0) {
            return { formatted, tag: 'Due Today', isOverdue: false, isToday: true, badgeClass: 'today' };
        } else if (diffDays === 1) {
            return { formatted, tag: 'Tomorrow', isOverdue: false, isToday: false, badgeClass: 'soon' };
        } else {
            return { formatted, tag: `In ${diffDays}d`, isOverdue: false, isToday: false, badgeClass: 'upcoming' };
        }
    } catch (e) {
        return { formatted: dueStr, tag: '', isOverdue: false, isToday: false, badgeClass: '' };
    }
}

function renderTaskStats() {
    const total = tasks.length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const inprogress = tasks.filter(t => t.status === 'inprogress').length;
    const done = tasks.filter(t => t.status === 'done').length;

    setTxt('taskStatTotal', total);
    setTxt('taskStatTodo', todo);
    setTxt('taskStatInProgress', inprogress);
    setTxt('taskStatDone', done);

    // Update filter counts
    setTxt('filterCountAll', total);
    setTxt('filterCountTodo', todo);
    setTxt('filterCountInProgress', inprogress);
    setTxt('filterCountDone', done);

    // Update active highlight on stat cards
    ['statCardTotal', 'statCardTodo', 'statCardInProgress', 'statCardDone'].forEach(id => {
        document.getElementById(id)?.classList.remove('active-filter');
    });
    if (taskFilter === 'all')        document.getElementById('statCardTotal')?.classList.add('active-filter');
    else if (taskFilter === 'todo')  document.getElementById('statCardTodo')?.classList.add('active-filter');
    else if (taskFilter === 'inprogress') document.getElementById('statCardInProgress')?.classList.add('active-filter');
    else if (taskFilter === 'done')  document.getElementById('statCardDone')?.classList.add('active-filter');
}

function getFilteredTasks() {
    const subFilter = document.getElementById('taskSubjectFilter')?.value || 'all';
    const prioFilter = document.getElementById('taskPriorityFilter')?.value || 'all';
    const q = (taskSearchQuery || '').toLowerCase().trim();

    return tasks.filter(t => {
        if (taskFilter !== 'all' && t.status !== taskFilter) return false;
        if (subFilter !== 'all' && t.subject !== subFilter) return false;
        if (prioFilter !== 'all' && t.priority !== prioFilter) return false;
        if (q) {
            const titleMatch = (t.title || '').toLowerCase().includes(q);
            const notesMatch = (t.notes || '').toLowerCase().includes(q);
            const subMatch   = (t.subject || '').toLowerCase().includes(q);
            if (!titleMatch && !notesMatch && !subMatch) return false;
        }
        return true;
    });
}

function renderTaskTable() {
    const tbody = document.getElementById('taskTableBody');
    const emptyState = document.getElementById('taskEmptyState');
    const tableWrapper = document.querySelector('.task-table-wrapper');
    if (!tbody) return;

    const filtered = getFilteredTasks();
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            const msgEl = document.getElementById('taskEmptyMsg');
            if (msgEl) {
                if (taskSearchQuery) {
                    msgEl.textContent = `No tasks matching "${taskSearchQuery}".`;
                } else if (taskFilter !== 'all') {
                    msgEl.textContent = `No tasks currently in "${taskFilter}" status.`;
                } else {
                    msgEl.textContent = 'All tasks caught up! Create your next assignment or study goal.';
                }
            }
        }
        return;
    }

    if (tableWrapper) tableWrapper.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    filtered.forEach(t => {
        const tr = document.createElement('tr');
        if (t.status === 'done') tr.classList.add('task-row-done');

        // Checkbox status toggle
        let statusIcon = '<i class="fa-regular fa-circle"></i>';
        let statusTitle = 'Click to advance status';
        if (t.status === 'inprogress') {
            statusIcon = '<i class="fa-solid fa-circle-half-stroke"></i>';
            statusTitle = 'In Progress (click to complete)';
        } else if (t.status === 'done') {
            statusIcon = '<i class="fa-solid fa-circle-check"></i>';
            statusTitle = 'Completed (click to reopen)';
        }

        // Type
        const typeCfg = TASK_TYPE_CONFIG[t.type] || { label: t.type || 'Study', icon: 'fa-book', color: '#818cf8', bg: 'rgba(99,102,241,0.12)' };
        // Priority
        const prioCfg = TASK_PRIORITY_CONFIG[t.priority] || { label: t.priority || 'Medium', icon: 'fa-minus', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' };
        // Due Date
        const due = parseDueDateInfo(t.dueDate);

        tr.innerHTML = `
            <td style="text-align: center;">
                <button type="button" class="task-status-toggle status-${t.status}" onclick="toggleTaskDone('${t.id}')" title="${statusTitle}">
                    ${statusIcon}
                </button>
            </td>
            <td>
                <div class="task-title-cell">
                    <span class="task-name-text">${escHtml(t.title)}</span>
                    ${t.notes ? `<span class="task-notes-snippet"><i class="fa-regular fa-note-sticky"></i> ${escHtml(t.notes)}</span>` : ''}
                </div>
            </td>
            <td>
                <span class="task-subj-badge">
                    <i class="fa-solid fa-book-bookmark"></i> ${escHtml(t.subject || 'General')}
                </span>
            </td>
            <td>
                <span class="task-type-badge" style="background:${typeCfg.bg};color:${typeCfg.color};border:1px solid ${typeCfg.color}33;">
                    <i class="fa-solid ${typeCfg.icon}"></i> ${typeCfg.label}
                </span>
            </td>
            <td>
                <div class="task-due-cell">
                    <span class="task-due-date"><i class="fa-regular fa-calendar"></i> ${due.formatted}</span>
                    ${due.tag ? `<span class="task-due-badge ${due.badgeClass}">${due.tag}</span>` : ''}
                </div>
            </td>
            <td>
                <span class="priority-pill ${t.priority || 'medium'}">
                    <i class="fa-solid ${prioCfg.icon}"></i> ${prioCfg.label}
                </span>
            </td>
            <td>
                <div class="task-actions-cell">
                    ${t.status !== 'done' ? `
                    <button type="button" class="task-action-btn advance" onclick="advanceTaskStatus('${t.id}')" title="Advance status">
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>` : ''}
                    <button type="button" class="task-action-btn edit" onclick="openEditTaskModal('${t.id}')" title="Edit task">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button type="button" class="task-action-btn delete" onclick="deleteTaskItem('${t.id}')" title="Delete task">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTaskBoardCards() {
    const cols = {
        todo: document.getElementById('cards-todo'),
        inprogress: document.getElementById('cards-inprogress'),
        done: document.getElementById('cards-done')
    };
    if (!cols.todo) return;

    Object.values(cols).forEach(c => c.innerHTML = '');

    const filtered = getFilteredTasks();

    ['todo', 'inprogress', 'done'].forEach(st => {
        const countEl = document.getElementById(`count-${st}`);
        const count = filtered.filter(t => t.status === st).length;
        if (countEl) countEl.textContent = count;
    });

    filtered.forEach(t => {
        const card = document.createElement('div');
        card.className = `task-board-card priority-${t.priority || 'medium'}`;
        const prioCfg = TASK_PRIORITY_CONFIG[t.priority] || { label: t.priority || 'Medium', icon: 'fa-minus', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' };
        const due = parseDueDateInfo(t.dueDate);

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:6px;">
                <span class="task-subj-badge" style="font-size:0.7rem;padding:2px 7px;">${escHtml(t.subject || 'General')}</span>
                <span class="priority-pill ${t.priority || 'medium'}" style="font-size:0.68rem;padding:2px 6px;">
                    <i class="fa-solid ${prioCfg.icon}"></i> ${prioCfg.label}
                </span>
            </div>
            <div style="font-weight:700;font-size:0.88rem;color:#fff;margin-bottom:4px;line-height:1.3;${t.status === 'done' ? 'text-decoration:line-through;color:var(--text-3);' : ''}">${escHtml(t.title)}</div>
            ${t.notes ? `<p style="font-size:0.75rem;color:var(--text-3);margin-bottom:8px;line-height:1.3;"><i class="fa-regular fa-note-sticky"></i> ${escHtml(t.notes)}</p>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);font-size:0.75rem;color:var(--text-3);">
                <div style="display:flex;align-items:center;gap:4px;">
                    <i class="fa-regular fa-calendar"></i> <span>${due.formatted}</span>
                    ${due.tag ? `<span class="task-due-badge ${due.badgeClass}" style="margin-left:4px;">${due.tag}</span>` : ''}
                </div>
                <div style="display:flex;gap:4px;">
                    ${t.status !== 'done' ? `
                    <button class="task-action-btn advance" onclick="advanceTaskStatus('${t.id}')" title="Move status">
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>` : ''}
                    <button class="task-action-btn edit" onclick="openEditTaskModal('${t.id}')" title="Edit task">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="task-action-btn delete" onclick="deleteTaskItem('${t.id}')" title="Delete task">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>`;
        if (cols[t.status]) cols[t.status].appendChild(card);
    });
}

function renderTasks() {
    renderTaskStats();
    renderTaskTable();
    renderTaskBoardCards();
}

window.renderTaskBoard = function() {
    renderTasks();
};

window.setTaskViewMode = function(mode) {
    taskViewMode = mode;
    localStorage.setItem(TASK_VIEW_KEY, mode);

    const btnTable = document.getElementById('btnTaskViewTable');
    const btnBoard = document.getElementById('btnTaskViewBoard');
    const tableContainer = document.getElementById('taskTableView');
    const boardContainer = document.getElementById('taskBoardView');

    if (btnTable && btnBoard) {
        btnTable.classList.toggle('active', mode === 'table');
        btnBoard.classList.toggle('active', mode === 'board');
    }

    if (tableContainer && boardContainer) {
        if (mode === 'table') {
            tableContainer.style.display = 'block';
            boardContainer.style.display = 'none';
        } else {
            tableContainer.style.display = 'none';
            boardContainer.style.display = 'block';
        }
    }
    renderTasks();
};

window.filterTasksByStatus = function(status) {
    taskFilter = status;
    document.querySelectorAll('.task-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === status);
    });
    renderTasks();
};

window.toggleTaskDone = function(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    if (t.status === 'done') {
        t.status = 'todo';
        showToast(`Moved "${t.title}" back to To-Do.`, 'info');
    } else {
        t.status = 'done';
        showToast(`Completed: "${t.title}"! 🎉`, 'success');
    }
    saveJSON(TASKS_KEY, tasks);
    renderTasks();
};

window.advanceTaskStatus = function(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    if (t.status === 'todo') {
        t.status = 'inprogress';
        showToast(`"${t.title}" moved to In Progress ⏳`, 'info');
    } else if (t.status === 'inprogress') {
        t.status = 'done';
        showToast(`"${t.title}" marked completed! 🎉`, 'success');
    }
    saveJSON(TASKS_KEY, tasks);
    renderTasks();
};

window.deleteTaskItem = function(id) {
    const t = tasks.find(x => x.id === id);
    const title = t ? t.title : 'Task';
    tasks = tasks.filter(x => x.id !== id);
    saveJSON(TASKS_KEY, tasks);
    renderTasks();
    showToast(`Deleted "${title}".`, 'info');
};

window.openEditTaskModal = function(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;

    setTxt('taskModalTitle', 'Edit Task');
    const editIdEl = document.getElementById('taskEditId');
    const titleEl = document.getElementById('taskTitleInput');
    const subjEl = document.getElementById('taskSubjectInput');
    const typeEl = document.getElementById('taskTypeInput');
    const dueEl = document.getElementById('taskDueDateInput');
    const prioEl = document.getElementById('taskPriorityInput');
    const notesEl = document.getElementById('taskNotesInput');

    if (editIdEl) editIdEl.value = t.id;
    if (titleEl)  titleEl.value = t.title || '';
    if (subjEl)   subjEl.value = t.subject || '';
    if (typeEl)   typeEl.value = t.type || 'study';
    if (dueEl)    dueEl.value = t.dueDate || '';
    if (prioEl)   prioEl.value = t.priority || 'medium';
    if (notesEl)  notesEl.value = t.notes || '';

    showModal('taskModal');
};

window.clearTaskSearch = function() {
    const inp = document.getElementById('taskSearchInput');
    const clearBtn = document.getElementById('btnTaskSearchClear');
    if (inp) inp.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    taskSearchQuery = '';
    renderTasks();
};

// ─── ACHIEVEMENTS ────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
    { title: 'Computer Fundamentals\nCertificate', color: 'gold',   emoji: '🥇', btn: 'gold-btn' },
    { title: 'Programming Logic\nCertificate',     color: 'purple', emoji: '🏆', btn: 'purple-btn' },
    { title: 'Data Management\nBadge',             color: 'blue',   emoji: '🎖️',  btn: 'blue-btn' },
    { title: 'Active Recall\nExcellence',          color: 'green',  emoji: '⭐', btn: 'green-btn' },
];

function renderAchievements() {
    const grid = document.getElementById('achievementsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
        const div = document.createElement('div');
        div.className = `achievement-card ${a.color}`;
        div.innerHTML = `
            <div class="achievement-text">
                <h4>${a.title.replace('\n','<br>')}</h4>
                <button class="achievement-btn ${a.btn}" onclick="showView('analytics');">View</button>
            </div>
            <div class="achievement-emoji">${a.emoji}</div>`;
        grid.appendChild(div);
    });
}

function initWelcomeBanner() {
    const today = new Date();
    const days  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months= ['January','February','March','April','May','June','July','August','September','October','November','December'];
    setTxt('welcomeDate', `${days[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}`);
}

// ─── EVENT LISTENERS WIRING ──────────────────────────────────────────────────
function initEventListeners() {
    // 1. Auth Form Handlers
    const loginForm = document.getElementById('authLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('authLoginId').value.trim();
            const pwd = document.getElementById('authLoginPassword').value.trim();
            const errEl = document.getElementById('authLoginError');

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ student_id_or_email: id, password: pwd })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login failed');

                currentStudent = data.student;
                updateStudentUI(data.student);
                hideModal('authModal');
                showToast(data.message || 'Logged in successfully!', 'success');
                loginForm.reset();
                await loadSubjects();
                renderDashboard();
                renderReviewSchedule();
            } catch (err) {
                if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
            }
        });
    }

    const regForm = document.getElementById('authRegisterForm');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name:       document.getElementById('authRegName')?.value.trim() || '',
                email:      document.getElementById('authRegEmail')?.value.trim() || '',
                year_level: document.getElementById('authRegYearLevel')?.value.trim() || 'BSIT',
                password:   document.getElementById('authRegPassword')?.value.trim() || ''
            };
            const errEl = document.getElementById('authRegError');

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Registration failed');

                currentStudent = data.student;
                updateStudentUI(data.student);
                hideModal('authModal');
                showToast(data.message || 'Account created successfully!', 'success');
                regForm.reset();
                await loadSubjects();
                renderDashboard();
                renderReviewSchedule();
            } catch (err) {
                if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
            }
        });
    }

    document.getElementById('btnQuickDemoLogin')?.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/auth/demo-login', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Demo login failed');
            currentStudent = data.student;
            updateStudentUI(data.student);
            hideModal('authModal');
            showToast(data.message || 'Logged in as Demo Student', 'success');
            await loadSubjects();
            renderDashboard();
            renderReviewSchedule();
        } catch (err) {
            showToast(err.message || 'Error logging in', 'error');
        }
    });

    // 2. Arena Handlers
    document.getElementById('btnStartSession')?.addEventListener('click', startActiveRecallSession);
    document.getElementById('btnSubmitAnswer')?.addEventListener('click', evaluateCurrentAnswer);
    document.getElementById('btnNextQuestion')?.addEventListener('click', moveToNextQuestion);
    document.getElementById('btnRetryQuestion')?.addEventListener('click', () => {
        const feedback = document.getElementById('feedbackCard');
        if (feedback) feedback.style.display = 'none';
        const display = document.getElementById('transcriptionDisplay');
        if (display) display.innerText = '';
        if (arenaState.currentQuestion && voice) {
            voice.speak(arenaState.currentQuestion.question_text);
        }
    });
    document.getElementById('btnSkipQuestion')?.addEventListener('click', moveToNextQuestion);
    document.getElementById('btnSpeakQuestion')?.addEventListener('click', () => {
        if (arenaState.currentQuestion && voice) {
            voice.speak(arenaState.currentQuestion.question_text);
        }
    });
    document.getElementById('btnSpeakVoiceMemo')?.addEventListener('click', () => {
        if (arenaState.lastVoiceMemo && voice) {
            voice.speak(arenaState.lastVoiceMemo);
        }
    });

    // Mic Trigger — toggles listening cleanly and resets transcript buffer
    document.getElementById('btnMicTrigger')?.addEventListener('click', async () => {
        if (!voice) { showToast('Voice system not initialized. Use Chrome or Edge.', 'warning'); return; }
        if (voice.isListening) {
            voice.stopListening();
        } else {
            // Reset accumulated transcript for a fresh answer
            if (voice.recognition) voice.accumulatedTranscript = '';
            await voice.startListening();
        }
    });

    // Also wire addScheduleForm
    initScheduleFormHandler();

    document.getElementById('btnClearTranscription')?.addEventListener('click', () => {
        const d = document.getElementById('transcriptionDisplay');
        if (d) d.innerText = '';
        const btn = document.getElementById('btnSubmitAnswer');
        if (btn) btn.disabled = true;
    });

    document.getElementById('transcriptionDisplay')?.addEventListener('input', function() {
        const btn = document.getElementById('btnSubmitAnswer');
        if (btn) btn.disabled = this.innerText.trim().length === 0;
    });

    // Keyboard Typing Shortcut (Ctrl+Enter to evaluate - Section II 80% preference)
    document.getElementById('transcriptionDisplay')?.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            evaluateCurrentAnswer();
        }
    });

    // Dual Search: Subject/Topic List Filter (Section III 40% tie)
    document.getElementById('headerSubjectFilter')?.addEventListener('change', function() {
        const subjId = this.value;
        const arenaSubj = document.getElementById('studySubjectSelect');
        if (arenaSubj) arenaSubj.value = subjId;
        const qbSubj = document.getElementById('qbSubjectFilter');
        if (qbSubj) {
            qbSubj.value = subjId;
            if (currentView === 'questions') loadQuestionBank();
        }
        if (currentView === 'arena') {
            startActiveRecallSession();
        } else if (subjId !== 'all') {
            showView('arena');
        }
    });

    // 3. Modals & Subject Management
    document.getElementById('btnDashAddSubject')?.addEventListener('click', () => showModal('dashSubjectModal'));
    
    document.getElementById('dashSubjectForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('dashSubjCode').value.trim();
        const name = document.getElementById('dashSubjName').value.trim();
        const color = document.getElementById('dashSubjColor').value;
        const description = document.getElementById('dashSubjDesc').value.trim();

        try {
            const res = await fetch('/api/subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, name, color, description })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create subject');

            showToast(`Subject ${data.code}: ${data.name} created successfully!`, 'success');
            hideModal('dashSubjectModal');
            document.getElementById('dashSubjectForm').reset();
            await loadSubjects(data.id);
            renderDashboard();
            renderReviewSchedule();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // 4. File Upload (Reviewer Dropzone) — now supports PDF, DOCX, TXT, and scanned images
    const dropzone = document.getElementById('fileDropzone');
    const fileInput = document.getElementById('materialFileInput');
    const fileChosenName = document.getElementById('fileChosenName');

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (ev) => { ev.preventDefault(); dropzone.style.borderColor = 'rgba(99,102,241,0.7)'; });
        dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'rgba(99,102,241,0.4)'; });
        dropzone.addEventListener('drop', (ev) => {
            ev.preventDefault();
            dropzone.style.borderColor = 'rgba(99,102,241,0.4)';
            const f = ev.dataTransfer.files[0];
            if (f) { fileInput.files = ev.dataTransfer.files; if (fileChosenName) fileChosenName.textContent = f.name; }
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0 && fileChosenName) fileChosenName.textContent = fileInput.files[0].name;
        });
    }

    const uploadForm = document.getElementById('uploadMaterialForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btnSubmitMaterial');
            const qType = document.getElementById('uploadQuestionType')?.value || 'any';
            const qDiff = document.getElementById('uploadDifficulty')?.value || 'moderate';
            const qCount = document.getElementById('uploadQuestionCount')?.value || '8';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing &amp; Synthesizing Assessment Questions...';
            }

            const formData = new FormData();
            formData.append('subject_id', document.getElementById('uploadSubject').value);
            formData.append('title', document.getElementById('uploadTitle').value.trim());
            formData.append('question_type', qType);
            formData.append('difficulty', qDiff);
            formData.append('question_count', qCount);

            if (fileInput && fileInput.files.length > 0) {
                formData.append('file', fileInput.files[0]);
            } else {
                const manualText = document.getElementById('manualNotesText')?.value.trim();
                if (manualText) formData.append('content_text', manualText);
            }

            try {
                const res = await fetch('/api/materials', { method: 'POST', body: formData });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to process material');

                const qCount = data.auto_generated_questions || 0;
                showToast(`Reviewer saved! ${qCount} assessment question${qCount !== 1 ? 's' : ''} synthesized.`, 'success');
                hideModal('uploadModal');
                uploadForm.reset();
                if (fileChosenName) fileChosenName.textContent = 'No file selected';
                loadMaterials();
                loadQuestionBank();
                renderReviewSchedule();
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Process &amp; Synthesize Assessment Questions';
                }
            }
        });
    }

    // 5. Custom Question Form
    const addQForm = document.getElementById('addQuestionForm');
    if (addQForm) {
        addQForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const concepts = document.getElementById('customQConcepts').value.split(',').map(c => c.trim()).filter(Boolean);
            const payload = {
                subject_id: document.getElementById('customQSubject').value,
                question_text: document.getElementById('customQText').value.trim(),
                expected_answer: document.getElementById('customQAnswer').value.trim(),
                key_concepts: concepts,
                question_type: document.getElementById('customQType').value,
                difficulty: document.getElementById('customQDiff').value
            };

            try {
                const res = await fetch('/api/questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Failed to create study question');
                showToast('Flashcard added to question bank!', 'success');
                hideModal('addQuestionModal');
                addQForm.reset();
                loadQuestionBank();
                renderReviewSchedule();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    // Question Bank Filters
    document.getElementById('qbSubjectFilter')?.addEventListener('change', loadQuestionBank);
    document.getElementById('qbStatusFilter')?.addEventListener('change', loadQuestionBank);

    // Tasks & Search
    document.getElementById('btnAddTask')?.addEventListener('click', () => {
        document.getElementById('taskForm')?.reset();
        const editIdEl = document.getElementById('taskEditId');
        if (editIdEl) editIdEl.value = '';
        const titleEl = document.getElementById('taskModalTitle');
        if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-plus-circle"></i> New Task';
        showModal('taskModal');
    });

    document.getElementById('taskForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const editId = document.getElementById('taskEditId')?.value;
        const title = document.getElementById('taskTitleInput').value.trim();
        const subject = document.getElementById('taskSubjectInput').value;
        const type = document.getElementById('taskTypeInput').value;
        const dueDate = document.getElementById('taskDueDateInput').value;
        const priority = document.getElementById('taskPriorityInput').value;
        const notes = document.getElementById('taskNotesInput').value.trim();

        if (!title) return;

        if (editId) {
            const t = tasks.find(x => x.id === editId);
            if (t) {
                t.title = title;
                t.subject = subject;
                t.type = type;
                t.dueDate = dueDate;
                t.priority = priority;
                t.notes = notes;
                showToast(`Task "${title}" updated successfully!`, 'success');
            }
        } else {
            tasks.unshift({ id: uid(), title, subject, type, dueDate, priority, status: 'todo', notes });
            showToast('Task added successfully', 'success');
        }

        saveJSON(TASKS_KEY, tasks);
        hideModal('taskModal');
        document.getElementById('taskForm').reset();
        const editIdEl = document.getElementById('taskEditId');
        if (editIdEl) editIdEl.value = '';
        renderTasks();
    });

    document.querySelectorAll('.task-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.task-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            taskFilter = btn.dataset.filter;
            renderTasks();
        });
    });

    document.getElementById('taskSubjectFilter')?.addEventListener('change', renderTasks);
    document.getElementById('taskPriorityFilter')?.addEventListener('change', renderTasks);

    const taskSearch = document.getElementById('taskSearchInput');
    const taskSearchClear = document.getElementById('btnTaskSearchClear');
    taskSearch?.addEventListener('input', (e) => {
        taskSearchQuery = e.target.value;
        if (taskSearchClear) taskSearchClear.style.display = taskSearchQuery ? 'block' : 'none';
        renderTasks();
    });

    document.getElementById('calPrev')?.addEventListener('click', () => {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        renderCalendar();
    });
    document.getElementById('calNext')?.addEventListener('click', () => {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
        renderCalendar();
    });

    // Global Search
    document.getElementById('globalSearch')?.addEventListener('input', function() {
        const q = this.value.toLowerCase().trim();
        if (!q) return;
        const matchedSubject = subjects.find(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
        if (matchedSubject) {
            startPracticeForSubject(matchedSubject.id);
        }
    });

    // Notifications
    const btnNotif = document.getElementById('btnNotifications');
    const notifPanel = document.getElementById('notifPanel');
    const backdrop = document.getElementById('backdropOverlay');
    btnNotif?.addEventListener('click', e => {
        e.stopPropagation();
        if (notifPanel) {
            const visible = notifPanel.style.display !== 'none';
            notifPanel.style.display = visible ? 'none' : 'block';
            if (backdrop) backdrop.style.display = visible ? 'none' : 'block';
            if (!visible) renderNotifPanel();
        }
    });
    backdrop?.addEventListener('click', () => {
        if (notifPanel) notifPanel.style.display = 'none';
        if (backdrop) backdrop.style.display = 'none';
    });
    document.getElementById('btnMarkAllRead')?.addEventListener('click', () => {
        notifications.forEach(n => n.read = true);
        saveJSON(NOTIF_KEY, notifications);
        renderNotifPanel();
        updateNotifBadge();
    });
}

// ─── VOICE SETTINGS ──────────────────────────────────────────────────────────
window.openSettingsModal = function() {
    populateVoices();
    showModal('settingsModal');
};

function populateVoices() {
    const sel = document.getElementById('voiceSelect');
    if (!sel || !voice || !voice.voices || voice.voices.length === 0) return;

    sel.innerHTML = voice.voices.map((v, i) => `
        <option value="${i}" ${v === voice.selectedVoice ? 'selected' : ''}>
            ${v.name} (${v.lang})
        </option>
    `).join('');
}

// (Legacy voice settings handlers consolidated into unified Voice Reader Preferences at bottom of file)

// ─── NOTIFICATION & TOAST HELPERS ────────────────────────────────────────────
function renderNotifPanel() {
    const list = document.getElementById('notifList');
    if (!list) return;
    list.innerHTML = '';
    if (notifications.length === 0) {
        list.innerHTML = '<div style="padding:1rem;color:var(--text-3);font-size:0.8rem;text-align:center;">No notifications</div>';
        return;
    }
    notifications.forEach(n => {
        const div = document.createElement('div');
        div.className = `notif-item ${n.read ? '' : 'unread'}`;
        div.innerHTML = `
            <div class="notif-dot ${n.read ? 'read' : ''}"></div>
            <div class="notif-item-body">
                <div class="notif-item-title">${escHtml(n.title)}</div>
                <div class="notif-item-time">${escHtml(n.time)}</div>
            </div>`;
        div.addEventListener('click', () => {
            n.read = true;
            saveJSON(NOTIF_KEY, notifications);
            renderNotifPanel();
            updateNotifBadge();
        });
        list.appendChild(div);
    });
}

function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const unread = notifications.filter(n => !n.read).length;
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error')   icon = 'fa-circle-xmark';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
window.showModal = function(id) {
    if (id === 'noteScannerModal' && typeof openNoteScannerModal === 'function') {
        openNoteScannerModal();
        return;
    }
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex';
        if (id === 'settingsModal' && typeof renderVoiceReaderGrid === 'function') {
            renderVoiceReaderGrid();
        }
    }
};
window.hideModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
function escHtml(str = '') {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ─── SURVEY-INFORMED CONTROLLER FUNCTIONS ─────────────────────────────────────

// 1. Mobile Sidebar Toggle (66.7% Smartphone / 60% Mobile App Format)
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('backdropOverlay');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('mobile-open');
    if (overlay) overlay.style.display = isOpen ? 'block' : 'none';
};

window.closeAllOpenOverlays = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');
    const overlay = document.getElementById('backdropOverlay');
    if (overlay) overlay.style.display = 'none';
};

// 2. Audio Narration Toggle (Audio as Optional Mode - Mean 2.87 Finding)
window.toggleArenaAudio = function() {
    arenaAudioEnabled = !arenaAudioEnabled;
    const label = document.getElementById('arenaAudioLabel');
    const icon = document.getElementById('arenaAudioIcon');
    if (label) label.textContent = arenaAudioEnabled ? 'Audio: ON' : 'Audio: Silent';
    if (icon) icon.className = arenaAudioEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    if (!arenaAudioEnabled && voice) {
        voice.stopSpeaking();
    }
    showToast(arenaAudioEnabled ? 'Voice feedback activated (TTS on)' : 'Silent Study Mode enabled (Visual feedback only)', 'info');
};

// 3. Multimodal Input Switcher (Typing + Speaking 80.0% Survey Preference)
window.setArenaInputMode = function(mode) {
    arenaInputMode = mode;
    const btnVoice = document.getElementById('btnModalityVoice');
    const btnKb = document.getElementById('btnModalityKeyboard');
    const micStage = document.getElementById('arenaMicStage');
    const display = document.getElementById('transcriptionDisplay');
    const label = document.getElementById('transcriptionHeaderLabel');

    if (mode === 'keyboard') {
        if (btnVoice) btnVoice.classList.remove('active');
        if (btnKb) btnKb.classList.add('active');
        if (micStage) micStage.style.opacity = '0.3';
        if (display) {
            display.setAttribute('placeholder', 'Type your active recall answer here... Press Ctrl+Enter to evaluate.');
            display.focus();
        }
        if (label) label.innerHTML = '<i class="fa-solid fa-keyboard"></i> Direct Keyboard Typing Mode:';
        // Stop listening if switching away from voice
        if (voice && voice.isListening) voice.stopListening();
        showToast('Keyboard mode active. Type and press Ctrl+Enter to submit.', 'info');
    } else {
        if (btnVoice) btnVoice.classList.add('active');
        if (btnKb) btnKb.classList.remove('active');
        if (micStage) micStage.style.opacity = '1';
        if (display) display.setAttribute('placeholder', 'Your spoken answer appears here in real-time. You can also type or edit directly...');
        if (label) label.innerHTML = '<i class="fa-solid fa-comment-dots"></i> Speech-to-Text Transcription:';
        showToast('Voice mode active. Click the microphone button to start speaking.', 'info');
        // Reset transcript buffer so new answer starts fresh
        if (voice && voice.recognition) voice.accumulatedTranscript = '';
    }
};

// 4. Grounded AI Source Verification (86.7% Critical Trust Finding)
window.toggleSourceExcerpt = function() {
    const drawer = document.getElementById('sourceExcerptDrawer');
    const btnLabel = document.getElementById('toggleExcerptBtnLabel');
    if (!drawer) return;
    const isHidden = drawer.style.display === 'none';
    drawer.style.display = isHidden ? 'block' : 'none';
    if (btnLabel) btnLabel.textContent = isHidden ? 'Hide Notes Excerpt' : 'Compare with Original Notes Excerpt';
};

window.openQuestionSourceVerification = function() {
    if (!arenaState.currentQuestion) return;
    const q = arenaState.currentQuestion;
    setTxt('modalVerifDocTitle', q.material_title || 'Uploaded Course Notes');
    setTxt('modalVerifQuestion', q.question_text);
    setTxt('modalVerifAnswer', q.expected_answer);
    setTxt('modalVerifExcerpt', q.source_snippet || 'Verified strictly grounded in student-uploaded reviewer.');
    const modal = document.getElementById('sourceVerificationModal');
    if (modal) modal.style.display = 'flex';
};

window.closeSourceVerificationModal = function() {
    const modal = document.getElementById('sourceVerificationModal');
    if (modal) modal.style.display = 'none';
};

// 5. Multimodal Ask Study Question Tool (Voice + Keyboard - Section II 80% Preference)
let currentAskAnswerMemo = '';

window.openAskStudyModal = function() {
    const modal = document.getElementById('askStudyQuestionModal');
    if (modal) modal.style.display = 'flex';
    const subjSelect = document.getElementById('askModalSubject');
    if (subjSelect && subjSelect.options.length <= 1) {
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.code} – ${s.name}`;
            subjSelect.appendChild(opt);
        });
    }
};

window.closeAskStudyModal = function() {
    const modal = document.getElementById('askStudyQuestionModal');
    if (modal) modal.style.display = 'none';
    if (voice) {
        voice.stopListening();
        voice.stopSpeaking();
    }
};

window.triggerAskVoiceInput = function() {
    if (!voice) {
        showToast('Voice recognition not initialized', 'warning');
        return;
    }
    const btnLabel = document.getElementById('askVoiceBtnLabel');
    if (voice.isListening) {
        voice.stopListening();
        if (btnLabel) btnLabel.textContent = 'Speak Question';
    } else {
        if (btnLabel) btnLabel.textContent = 'Listening...';
        voice.startListening((text, isFinal) => {
            const input = document.getElementById('askQuestionInput');
            if (input) input.value = text;
            if (isFinal && btnLabel) btnLabel.textContent = 'Speak Question';
        });
    }
};

window.submitAskStudyQuestion = async function() {
    const input = document.getElementById('askQuestionInput');
    const query = input ? input.value.trim() : '';
    if (!query) {
        showToast('Please type or speak a question first', 'warning');
        return;
    }

    const subjSelect = document.getElementById('askModalSubject');
    const subject_id = subjSelect ? subjSelect.value : 'all';
    const submitBtn = document.getElementById('btnSubmitAskQuestion');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching Notes...';
    }

    try {
        const res = await fetch('/api/study/ask-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, subject_id })
        });
        const data = await res.json();

        const container = document.getElementById('askAnswerContainer');
        const textEl = document.getElementById('askAnswerText');
        const srcEl = document.getElementById('askAnswerSource');

        if (container) container.style.display = 'block';
        if (textEl) textEl.textContent = data.answer;
        if (srcEl) srcEl.textContent = data.source_title || 'Uploaded Reviewer Notes';

        currentAskAnswerMemo = data.voice_memo || data.answer;

        // Auto speak if audio is enabled
        if (arenaAudioEnabled && voice) {
            voice.speak(currentAskAnswerMemo);
        }
    } catch (e) {
        showToast('Failed to retrieve answer from notes', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Get Grounded Answer';
        }
    }
};

window.speakCurrentAskAnswer = function() {
    if (currentAskAnswerMemo && voice) {
        voice.speak(currentAskAnswerMemo);
    }
};

// 6. Study Reminders & Cadence Configuration (Several Times a Day - Section III 60% Finding)
window.openRemindersModal = function() {
    const modal = document.getElementById('studyRemindersModal');
    if (modal) modal.style.display = 'flex';
};

window.closeRemindersModal = function() {
    const modal = document.getElementById('studyRemindersModal');
    if (modal) modal.style.display = 'none';
};

window.saveReminderPreferences = async function() {
    const radios = document.getElementsByName('reminderCadence');
    let cadence = 'several_times_a_day';
    for (const r of radios) {
        if (r.checked) cadence = r.value;
    }

    try {
        const res = await fetch('/api/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cadence, enabled: true })
        });
        const data = await res.json();
        showToast('Active recall study reminders saved successfully!', 'success');
        closeRemindersModal();
    } catch (e) {
        showToast('Failed to save reminder preferences', 'error');
    }
};

window.requestReminderPermission = function() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('Browser notifications enabled! You will receive study reminders.', 'success');
                const btn = document.getElementById('btnRequestNotificationPerm');
                if (btn) { btn.textContent = 'Enabled ✓'; btn.disabled = true; }
            } else {
                showToast('Notification permission was not granted.', 'warning');
            }
        });
    } else {
        showToast('Browser notifications are not supported in this environment.', 'info');
    }
};

window.triggerTestReminder = function() {
    const notifTitle = 'StudyBuddy: Active Recall Review';
    const notifBody = 'Time for your afternoon review! 3 unmastered flashcards in IT 102 Computer Programming 1 need practice.';

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notifTitle, {
            body: notifBody,
            icon: '/static/img/icon.png'
        });
    }

    showToast(`🔔 Reminder: ${notifBody}`, 'info');
    if (arenaAudioEnabled && voice) {
        voice.speak("Study reminder: It is time for active recall practice.");
    }
};

// 7. Practice Quiz Summary Controls (66.7% Quiz Progress Metric Finding)
window.closeQuizSummaryModal = function() {
    const modal = document.getElementById('quizSummaryModal');
    if (modal) modal.style.display = 'none';
};

window.reviewQuizWeakQuestions = function() {
    closeQuizSummaryModal();
    const modeSelect = document.getElementById('studyModeSelect');
    if (modeSelect) modeSelect.value = 'weak';
    startActiveRecallSession();
    showToast('Loading Spaced Repetition queue for missed quiz questions...', 'info');
};

// ─── CLEAR COMPLETED TASKS HELPER ────────────────────────────────────────────
window.clearCompletedTasks = function() {
    const prevLen = tasks.length;
    tasks = tasks.filter(t => t.status !== 'done');
    saveJSON(TASKS_KEY, tasks);
    renderTasks();
    const removed = prevLen - tasks.length;
    showToast(`Cleared ${removed} completed task${removed !== 1 ? 's' : ''}.`, removed > 0 ? 'success' : 'info');
};

// ─── RECENT STUDY ATTEMPTS LOADER (ANALYTICS) ────────────────────────────────
async function loadRecentAttempts() {
    const tbody = document.getElementById('attemptsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text-3);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';

    try {
        const res = await fetch('/api/study/attempts?limit=25');
        const attempts = await res.json();

        if (!Array.isArray(attempts) || attempts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-3);"><i class="fa-solid fa-microphone-slash" style="font-size:1.5rem;display:block;margin-bottom:8px;"></i>No practice sessions recorded yet. Start a verbal active recall session!</td></tr>';
            return;
        }

        tbody.innerHTML = attempts.map(a => {
            const scoreColor = a.score >= 80 ? '#10b981' : a.score >= 60 ? '#f59e0b' : '#f43f5e';
            const passed = a.score >= 70;
            return `
                <tr>
                    <td style="font-size:0.78rem;color:var(--text-3);white-space:nowrap;">${escHtml(a.created_at)}</td>
                    <td style="font-size:0.8rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(a.question_text)}">${escHtml(a.question_text)}</td>
                    <td style="font-size:0.78rem;color:var(--text-2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(a.student_answer)}">${escHtml(a.student_answer)}</td>
                    <td style="text-align:center;">
                        <span style="font-size:0.7rem;padding:2px 7px;border-radius:4px;background:${a.is_voice_input ? 'rgba(6,182,212,0.15)' : 'rgba(99,102,241,0.15)'};color:${a.is_voice_input ? '#06b6d4' : '#818cf8'};font-weight:700;">
                            <i class="fa-solid ${a.is_voice_input ? 'fa-microphone' : 'fa-keyboard'}"></i> ${a.is_voice_input ? 'Voice' : 'Keyboard'}
                        </span>
                    </td>
                    <td style="text-align:center;font-weight:700;color:${scoreColor};">${Math.round(a.score)}%</td>
                    <td style="text-align:center;">
                        <span style="font-size:0.7rem;padding:2px 8px;border-radius:4px;background:${passed ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'};color:${passed ? '#10b981' : '#f43f5e'};font-weight:700;">
                            ${passed ? '✓ Passed' : '✗ Needs Review'}
                        </span>
                    </td>
                </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--danger);">Failed to load practice logs.</td></tr>';
    }
}

// ─── VOICE READER PICKER ──────────────────────────────────────────────────────
function renderVoiceReaderGrid() {
    if (!voice) return;
    const grid = document.getElementById('voiceReaderGrid');
    if (!grid) return;

    if (voice.synth && (!voice.voices || voice.voices.length === 0)) {
        voice.voices = voice.synth.getVoices();
    }

    const readers = voice.getReaders();
    const currentId = voice.currentReaderId;

    grid.innerHTML = readers.map(r => `
        <div class="voice-reader-card ${r.id === currentId ? 'active' : ''}"
             id="readerCard_${r.id}"
             style="--reader-color: ${r.color};"
             onclick="selectVoiceReader('${r.id}')">
            <div class="reader-glow-bar"></div>
            <div class="reader-avatar">${r.avatar}</div>
            <div class="reader-name">${r.name}</div>
            <div class="reader-title"><i class="fa-solid ${r.icon}"></i> ${r.title}</div>
            <div class="reader-tagline">${r.tagline}</div>
            <div class="reader-card-footer">
                <button class="reader-preview-btn" onclick="event.stopPropagation(); previewVoiceReader('${r.id}')">
                    <i class="fa-solid fa-play" id="previewIcon_${r.id}"></i> Preview
                </button>
                ${r.id === currentId ? `<span class="reader-active-badge" style="background:${r.color}"><i class="fa-solid fa-check"></i> Active</span>` : ''}
            </div>
        </div>
    `).join('');

    // Show/hide custom tuner
    const tuner = document.getElementById('customReaderTuner');
    if (tuner) tuner.style.display = currentId === 'custom_reader' ? 'block' : 'none';

    // Populate voice select for custom reader
    if (voice && voice.voices) {
        const sel = document.getElementById('voiceSelect');
        if (sel) {
            sel.innerHTML = voice.voices.map(v => `<option value="${v.name}" ${voice.selectedVoice && voice.selectedVoice.name === v.name ? 'selected' : ''}>${v.name} (${v.lang})</option>`).join('');
        }
    }
}

window.selectVoiceReader = function(readerId) {
    if (!voice) return;
    const r = voice.setVoiceReader(readerId);
    renderVoiceReaderGrid();
    // Update sidebar voice pill if it exists
    const pillName = document.getElementById('sidebarReaderName');
    const pillAvatar = document.getElementById('sidebarReaderAvatar');
    if (r) {
        if (pillName) pillName.textContent = r.name;
        if (pillAvatar) pillAvatar.textContent = r.avatar;
    }
    showToast(`Voice Reader switched to ${r.name} — ${r.title}`, 'success');
};

window.previewVoiceReader = function(readerId) {
    if (!voice) { showToast('Voice not initialized.', 'warning'); return; }
    const icon = document.getElementById(`previewIcon_${readerId}`);
    if (icon) { icon.className = 'fa-solid fa-spinner fa-spin'; }
    voice.previewReader(readerId, () => {
        if (icon) icon.className = 'fa-solid fa-play';
    });
};

window.openSettingsModal = function() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'flex';
        renderVoiceReaderGrid();
    }
};

function loadSettings() {
    // Populate voice select for custom reader
    if (voice && voice.voices && voice.voices.length > 0) {
        const sel = document.getElementById('voiceSelect');
        if (sel) {
            sel.innerHTML = voice.voices.map(v => `<option value="${v.name}" ${voice.selectedVoice && voice.selectedVoice.name === v.name ? 'selected' : ''}>${v.name} (${v.lang})</option>`).join('');
            sel.addEventListener('change', () => {
                const selected = voice.voices.find(v => v.name === sel.value);
                if (selected) voice.selectedVoice = selected;
            });
        }
    }

    const rateSlider = document.getElementById('voiceRateSlider');
    const rateVal = document.getElementById('voiceRateVal');
    const pitchSlider = document.getElementById('voicePitchSlider');
    const pitchVal = document.getElementById('voicePitchVal');

    if (rateSlider) {
        rateSlider.value = voice ? voice.customRate : 1.0;
        if (rateVal) rateVal.textContent = parseFloat(rateSlider.value).toFixed(2) + '×';
        rateSlider.addEventListener('input', () => {
            if (rateVal) rateVal.textContent = parseFloat(rateSlider.value).toFixed(2) + '×';
        });
    }
    if (pitchSlider) {
        pitchSlider.value = voice ? voice.customPitch : 1.0;
        if (pitchVal) pitchVal.textContent = parseFloat(pitchSlider.value).toFixed(2);
        pitchSlider.addEventListener('input', () => {
            if (pitchVal) pitchVal.textContent = parseFloat(pitchSlider.value).toFixed(2);
        });
    }

    const btnTestCustom = document.getElementById('btnTestCustomVoice');
    if (btnTestCustom) {
        btnTestCustom.addEventListener('click', () => {
            if (!voice) return;
            const rate = rateSlider ? parseFloat(rateSlider.value) : 1.0;
            const pitch = pitchSlider ? parseFloat(pitchSlider.value) : 1.0;
            voice.setVoiceReader('custom_reader', rate, pitch);
            voice.previewReader('custom_reader');
        });
    }

    const btnSave = document.getElementById('btnSaveSettings');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const rate = rateSlider ? parseFloat(rateSlider.value) : 1.0;
            const pitch = pitchSlider ? parseFloat(pitchSlider.value) : 1.0;
            if (voice && voice.currentReaderId === 'custom_reader') {
                voice.setVoiceReader('custom_reader', rate, pitch);
            }
            const apiKeyInput = document.getElementById('geminiApiKey');
            if (apiKeyInput && apiKeyInput.value.trim()) {
                fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ gemini_api_key: apiKeyInput.value.trim() }) });
            }
            document.getElementById('settingsModal').style.display = 'none';
            showToast('Voice reader preferences saved!', 'success');
        });
    }

    const btnReset = document.getElementById('btnResetDemoData');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            if (!confirm('Reset ALL subjects, materials & questions to default BSIT demo data?')) return;
            try {
                await fetch('/api/reset-data', { method: 'POST' });
                await loadSubjects();
                showToast('Demo curriculum restored successfully!', 'success');
                document.getElementById('settingsModal').style.display = 'none';
            } catch (e) {
                showToast('Reset failed. Please try again.', 'danger');
            }
        });
    }
}

// ─── FLASHCARDS CONTROLLER (VISUAL ACTIVE RECALL SEPARATE FROM ARENA) ────────
const flashcardState = {
    deck: [],
    currentIndex: 0,
    isFlipped: false
};

function populateFlashcardSubjects() {
    const sel = document.getElementById('fcSubjectFilter');
    if (!sel) return;
    const currentVal = sel.value || 'all';
    sel.innerHTML = '<option value="all">All Subjects</option>' +
        subjects.map(s => `<option value="${s.id}" ${String(s.id) === currentVal ? 'selected' : ''}>${escHtml(s.code)} - ${escHtml(s.name)}</option>`).join('');
}

async function loadFlashcardDeck() {
    const subjSel = document.getElementById('fcSubjectFilter');
    const modeSel = document.getElementById('fcModeFilter');
    const subj = subjSel ? subjSel.value : 'all';
    const mode = modeSel ? modeSel.value : 'all';

    const cardEl = document.getElementById('flashcardElement');
    if (cardEl) cardEl.classList.remove('is-flipped');
    flashcardState.isFlipped = false;

    try {
        const res = await fetch(`/api/questions?subject_id=${encodeURIComponent(subj)}&filter=${encodeURIComponent(mode)}`);
        const questions = await res.json();
        
        if (!Array.isArray(questions) || questions.length === 0) {
            flashcardState.deck = [];
            flashcardState.currentIndex = 0;
            renderEmptyFlashcard();
            return;
        }

        flashcardState.deck = questions;
        flashcardState.currentIndex = 0;
        renderCurrentFlashcard();
    } catch (e) {
        console.error('Failed to load flashcard deck:', e);
        flashcardState.deck = [];
        renderEmptyFlashcard();
    }
}

function renderEmptyFlashcard() {
    const frontQ = document.getElementById('fcFrontQuestion');
    const backA = document.getElementById('fcBackAnswer');
    const counter = document.getElementById('fcCounterText');
    const progress = document.getElementById('fcProgressBar');
    const badge = document.getElementById('fcSubjectBadge');
    const mastered = document.getElementById('fcMasteredStats');
    const tags = document.getElementById('fcConceptTags');

    if (frontQ) frontQ.innerHTML = '<i class="fa-solid fa-layer-group" style="font-size:2rem;color:var(--text-3);display:block;margin-bottom:12px;"></i>No flashcards found for this selection.<br><span style="font-size:0.9rem;color:var(--text-2);font-weight:400;margin-top:8px;display:block;">Use the <strong>Note Scanner</strong> above to automatically generate a study reviewer from your lecture notes!</span>';
    if (backA) backA.textContent = 'No answer available.';
    if (counter) counter.textContent = 'Card 0 of 0';
    if (progress) progress.style.width = '0%';
    if (badge) badge.textContent = 'Empty Deck';
    if (mastered) mastered.textContent = '0 Mastered';
    if (tags) tags.innerHTML = '';
}

function renderCurrentFlashcard() {
    const deck = flashcardState.deck;
    if (!deck || deck.length === 0) {
        renderEmptyFlashcard();
        return;
    }

    const idx = flashcardState.currentIndex;
    const q = deck[idx];
    if (!q) return;

    // Reset card flip
    const cardEl = document.getElementById('flashcardElement');
    if (cardEl) cardEl.classList.remove('is-flipped');
    flashcardState.isFlipped = false;

    // Subject badge
    const badge = document.getElementById('fcSubjectBadge');
    if (badge) {
        badge.textContent = q.subject_code || (q.subject ? q.subject.code : 'Flashcard');
    }

    // Counter and Progress Bar
    const counter = document.getElementById('fcCounterText');
    if (counter) counter.textContent = `Card ${idx + 1} of ${deck.length}`;

    const progress = document.getElementById('fcProgressBar');
    if (progress) {
        const pct = Math.round(((idx + 1) / deck.length) * 100);
        progress.style.width = `${pct}%`;
    }

    // Mastered Count
    const mastered = document.getElementById('fcMasteredStats');
    if (mastered) {
        const mCount = deck.filter(c => c.is_mastered).length;
        mastered.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${mCount} of ${deck.length} Mastered`;
    }

    // Front Question
    const frontQ = document.getElementById('fcFrontQuestion');
    if (frontQ) {
        const cleanQ = (q.question_text || '').replace(/^Flashcard:\s*/i, '');
        frontQ.textContent = cleanQ;
    }

    // Difficulty and Practice Count
    const diffBadge = document.getElementById('fcDifficultyBadge');
    if (diffBadge) {
        const d = (q.difficulty || 'medium').toLowerCase();
        diffBadge.textContent = d.toUpperCase();
        diffBadge.style.color = d === 'easy' ? '#10b981' : d === 'hard' ? '#f43f5e' : '#f59e0b';
        diffBadge.style.background = d === 'easy' ? 'rgba(16,185,129,0.15)' : d === 'hard' ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)';
    }

    const timesBadge = document.getElementById('fcTimesBadge');
    if (timesBadge) {
        timesBadge.innerHTML = `<i class="fa-solid fa-repeat"></i> Practiced ${q.times_practiced || 0} times`;
    }

    // Back Answer
    const backA = document.getElementById('fcBackAnswer');
    if (backA) {
        backA.textContent = q.expected_answer || 'No model answer provided.';
    }

    // Concept Tags
    const tagsContainer = document.getElementById('fcConceptTags');
    if (tagsContainer) {
        const concepts = q.key_concepts || [];
        if (concepts.length > 0) {
            tagsContainer.innerHTML = concepts.map(c => `<span class="fc-concept-tag">${escHtml(c)}</span>`).join('');
        } else {
            tagsContainer.innerHTML = '<span style="font-size:0.75rem;color:var(--text-3);">Concept grounded in lecture note definitions</span>';
        }
    }
}

window.flipFlashcard = function() {
    const cardEl = document.getElementById('flashcardElement');
    if (!cardEl) return;
    flashcardState.isFlipped = !flashcardState.isFlipped;
    cardEl.classList.toggle('is-flipped', flashcardState.isFlipped);
};

window.navigateFlashcard = function(delta) {
    const deck = flashcardState.deck;
    if (!deck || deck.length === 0) return;

    let newIdx = flashcardState.currentIndex + delta;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= deck.length) newIdx = deck.length - 1;

    if (newIdx !== flashcardState.currentIndex) {
        flashcardState.currentIndex = newIdx;
        renderCurrentFlashcard();
    }
};

window.shuffleFlashcards = function() {
    const deck = flashcardState.deck;
    if (!deck || deck.length <= 1) return;

    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    flashcardState.currentIndex = 0;
    renderCurrentFlashcard();
    showToast('Deck shuffled!', 'info');
};

window.rateCurrentFlashcard = async function(rating) {
    const deck = flashcardState.deck;
    if (!deck || deck.length === 0) return;

    const q = deck[flashcardState.currentIndex];
    if (!q) return;

    try {
        const res = await fetch('/api/study/flashcard-rate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_id: q.id, rating })
        });
        const data = await res.json();

        // Update local object
        q.times_practiced = (q.times_practiced || 0) + 1;
        q.is_mastered = data.is_mastered;
        q.last_score = data.score;

        const ratingLabels = {
            'again': '🔴 Marked as Again (< 1 min)',
            'hard':  '🟠 Marked as Hard (Review in 2 days)',
            'good':  '🔵 Marked as Good (+85% Mastery)',
            'easy':  '🟢 Mastered Effortlessly (+100%)'
        };
        showToast(ratingLabels[rating] || 'Card graded!', rating === 'again' ? 'warning' : 'success');

        // Automatically advance to next card after 250ms
        setTimeout(() => {
            if (flashcardState.currentIndex < deck.length - 1) {
                navigateFlashcard(1);
            } else {
                renderCurrentFlashcard();
                showToast('You reached the end of this flashcard deck! 🎉', 'success');
            }
        }, 280);

    } catch (e) {
        console.error('Failed to rate flashcard:', e);
        showToast('Failed to save flashcard rating.', 'danger');
    }
};

window.speakCurrentFlashcard = function() {
    if (!voice) { showToast('Voice system not ready.', 'warning'); return; }
    const deck = flashcardState.deck;
    if (!deck || deck.length === 0) return;

    const q = deck[flashcardState.currentIndex];
    if (!q) return;

    const textToSpeak = flashcardState.isFlipped ? q.expected_answer : q.question_text.replace(/^Flashcard:\s*/i, '');
    voice.speak(textToSpeak);
};

// Global Keyboard Shortcuts for Flashcards
document.addEventListener('keydown', (e) => {
    if (currentView !== 'flashcards') return;
    
    // Ignore if focus is in an input or textarea
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.code === 'Space') {
        e.preventDefault();
        flipFlashcard();
    } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        navigateFlashcard(1);
    } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        navigateFlashcard(-1);
    } else if (e.key === '1') {
        rateCurrentFlashcard('again');
    } else if (e.key === '2') {
        rateCurrentFlashcard('hard');
    } else if (e.key === '3') {
        rateCurrentFlashcard('good');
    } else if (e.key === '4') {
        rateCurrentFlashcard('easy');
    }
});

// ─── NOTE SCANNER CONTROLLER (AUTO-GENERATE REVIEWER FROM LECTURE NOTES) ──────
let scannedResultData = null;

window.openNoteScannerModal = function() {
    const modal = document.getElementById('noteScannerModal');
    if (!modal) return;

    // Populate subject select
    const subjSel = document.getElementById('scannerSubjectSelect');
    if (subjSel) {
        subjSel.innerHTML = subjects.map(s => `<option value="${s.id}">${escHtml(s.code)} - ${escHtml(s.name)}</option>`).join('');
    }

    // Reset fields
    const form = document.getElementById('noteScannerForm');
    if (form) form.style.display = 'block';
    const loading = document.getElementById('scannerLoading');
    if (loading) loading.style.display = 'none';
    const results = document.getElementById('scannerResults');
    if (results) results.style.display = 'none';

    // Default to text paste mode
    setScannerInputMode('text');

    modal.style.display = 'flex';
    document.getElementById('scannerNotesText')?.focus();
};

// Toggle input mode: 'text' (paste) vs 'file' (upload/scanned image)
window.setScannerInputMode = function(mode) {
    const textSection = document.getElementById('scannerTextSection');
    const fileSection = document.getElementById('scannerFileSection');
    const btnText = document.getElementById('btnScannerModeText');
    const btnFile = document.getElementById('btnScannerModeFile');
    const notesTextArea = document.getElementById('scannerNotesText');

    if (mode === 'file') {
        if (textSection) textSection.style.display = 'none';
        if (fileSection) fileSection.style.display = 'block';
        if (btnText) { btnText.classList.remove('btn-primary'); btnText.classList.add('btn-outline'); }
        if (btnFile) { btnFile.classList.remove('btn-outline'); btnFile.classList.add('btn-primary'); }
        if (notesTextArea) notesTextArea.removeAttribute('required');

        // Init file dropzone for scanner
        const scannerDropzone = document.getElementById('scannerFileDropzone');
        const scannerFileInput = document.getElementById('scannerFileInput');
        const scannerFileLabel = document.getElementById('scannerFileChosenName');
        if (scannerDropzone && scannerFileInput) {
            scannerDropzone.onclick = () => scannerFileInput.click();
            scannerDropzone.ondragover = (ev) => { ev.preventDefault(); scannerDropzone.style.borderColor = 'rgba(192,132,252,0.7)'; };
            scannerDropzone.ondragleave = () => { scannerDropzone.style.borderColor = 'rgba(192,132,252,0.45)'; };
            scannerDropzone.ondrop = (ev) => {
                ev.preventDefault();
                scannerDropzone.style.borderColor = 'rgba(192,132,252,0.45)';
                const f = ev.dataTransfer.files[0];
                if (f) { scannerFileInput.files = ev.dataTransfer.files; if (scannerFileLabel) scannerFileLabel.textContent = f.name; }
            };
            scannerFileInput.onchange = () => {
                if (scannerFileInput.files.length > 0 && scannerFileLabel) scannerFileLabel.textContent = scannerFileInput.files[0].name;
            };
        }
    } else {
        if (textSection) textSection.style.display = 'block';
        if (fileSection) fileSection.style.display = 'none';
        if (btnText) { btnText.classList.remove('btn-outline'); btnText.classList.add('btn-primary'); }
        if (btnFile) { btnFile.classList.remove('btn-primary'); btnFile.classList.add('btn-outline'); }
        if (notesTextArea) notesTextArea.setAttribute('required', 'required');
    }
};

// Live character counter for Note Scanner
document.getElementById('scannerNotesText')?.addEventListener('input', function() {
    const count = this.value.length;
    const label = document.getElementById('scannerCharCount');
    if (label) label.textContent = count + ' characters';
});

// Submit Note Scanner - supports both text paste and file/image upload
document.getElementById('noteScannerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const subjectId    = document.getElementById('scannerSubjectSelect')?.value;
    const title        = document.getElementById('scannerTopicTitle')?.value.trim();
    const count        = document.getElementById('scannerQuestionCount')?.value || '8';
    const questionType = document.getElementById('scannerQuestionType')?.value || 'any';
    const difficulty   = document.getElementById('scannerDifficulty')?.value || 'moderate';

    const fileSection  = document.getElementById('scannerFileSection');
    const scannerFile  = document.getElementById('scannerFileInput');
    const isFileMode   = fileSection && fileSection.style.display !== 'none';
    const notesText    = document.getElementById('scannerNotesText')?.value.trim();

    if (isFileMode) {
        if (!scannerFile || scannerFile.files.length === 0) {
            showToast('Please select a file to upload for scanning.', 'warning');
            return;
        }
    } else {
        if (!notesText || notesText.length < 25) {
            showToast('Please paste at least a paragraph of lecture notes or definitions to scan.', 'warning');
            return;
        }
    }

    const form    = document.getElementById('noteScannerForm');
    const loading = document.getElementById('scannerLoading');
    const results = document.getElementById('scannerResults');

    if (form) form.style.display = 'none';
    if (loading) loading.style.display = 'block';
    if (results) results.style.display = 'none';

    try {
        let res, data;

        if (isFileMode && scannerFile && scannerFile.files.length > 0) {
            const formData = new FormData();
            formData.append('file', scannerFile.files[0]);
            formData.append('subject_id', subjectId || '');
            formData.append('title', title || '');
            formData.append('question_count', count);
            formData.append('question_type', questionType);
            formData.append('difficulty', difficulty);
            res = await fetch('/api/notes/scan-to-reviewer', { method: 'POST', body: formData });
        } else {
            res = await fetch('/api/notes/scan-to-reviewer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notes_text: notesText,
                    subject_id: subjectId,
                    title: title,
                    question_count: parseInt(count),
                    question_type: questionType,
                    difficulty: difficulty
                })
            });
        }

        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to synthesize assessment questions.');

        scannedResultData = data;

        if (loading) loading.style.display = 'none';
        if (results) results.style.display = 'block';

        const successCount = document.getElementById('scannerSuccessCount');
        if (successCount) {
            successCount.textContent = (data.questions_count || 0) + ' Assessment Questions Synthesized!';
        }

        const previewBox = document.getElementById('scannerReviewerPreview');
        if (previewBox) {
            previewBox.textContent = data.reviewer_text || '';
        }

        showToast(data.message || 'Assessment reviewer synthesized successfully!', 'success');

        loadMaterials();
        loadQuestionBank();
        loadSubjects();

    } catch (err) {
        if (loading) loading.style.display = 'none';
        if (form) form.style.display = 'block';
        showToast(err.message || 'Error processing notes. Please try again.', 'danger');
    }
});

window.copyScannedReviewerText = function() {
    var previewBox = document.getElementById('scannerReviewerPreview');
    if (!previewBox) return;
    var text = previewBox.textContent;
    if (!text) { showToast('No reviewer text to copy.', 'warning'); return; }
    navigator.clipboard.writeText(text).then(function() {
        showToast('Assessment reviewer copied to clipboard!', 'success');
    }).catch(function() {
        showToast('Could not copy. Please select and copy manually.', 'warning');
    });
};

window.startFlashcardsFromScan = function() {
    document.getElementById('noteScannerModal').style.display = 'none';
    if (scannedResultData && scannedResultData.material) {
        var sel = document.getElementById('fcSubjectFilter');
        if (sel) sel.value = String(scannedResultData.material.subject_id);
    }
    showView('flashcards');
    showToast('Loaded your synthesized assessment deck into Flashcards!', 'success');
};

window.startVoiceArenaFromScan = function() {
    document.getElementById('noteScannerModal').style.display = 'none';
    if (scannedResultData && scannedResultData.material) {
        var sel = document.getElementById('studySubjectSelect');
        if (sel) sel.value = String(scannedResultData.material.subject_id);
    }
    showView('arena');
    showToast('Loaded your synthesized assessment questions into Verbal Practice Arena!', 'success');
};

// VIEW QUESTION ASSESSMENT DETAIL MODAL
window.viewQuestionAssessmentDetail = function(q) {
    var modal = document.getElementById('viewQuestionAssessmentModal');
    if (!modal) return;

    function setEl(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val || '—';
    }

    setEl('vqaSubjectBadge', q.subject_code || 'SUBJECT');
    setEl('vqaTypeBadge', q.question_type || 'Short Answer');
    setEl('vqaDiffBadge', (q.difficulty || 'Moderate').charAt(0).toUpperCase() + (q.difficulty || 'moderate').slice(1));
    setEl('vqaTopic', q.topic || 'General Concept');
    setEl('vqaQuestion', q.question_text || '');
    setEl('vqaAnswer', q.expected_answer || '');
    setEl('vqaExplanation', q.explanation || 'Grounded in the uploaded course reviewer.');
    setEl('vqaSourceRef', q.source_reference || 'Uploaded course reviewer notes');

    var diffBadge = document.getElementById('vqaDiffBadge');
    if (diffBadge) {
        var d = (q.difficulty || 'moderate').toLowerCase();
        diffBadge.style.background = d === 'easy' ? 'rgba(16,185,129,0.2)' : d === 'hard' ? 'rgba(244,63,94,0.2)' : 'rgba(245,158,11,0.2)';
        diffBadge.style.color = d === 'easy' ? '#10b981' : d === 'hard' ? '#f43f5e' : '#f59e0b';
    }

    var choicesContainer = document.getElementById('vqaChoicesContainer');
    var choicesList = document.getElementById('vqaChoicesList');
    var choices = q.choices || [];

    if (choicesContainer && choicesList) {
        if (choices && choices.length > 0) {
            var correctAns = (q.expected_answer || '').trim();
            var html = '';
            for (var ci = 0; ci < choices.length; ci++) {
                var c = choices[ci];
                var isCorrect = c.trim() === correctAns || correctAns.startsWith(c.substring(0, 2));
                var bg = isCorrect ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)';
                var bd = isCorrect ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)';
                var cl = isCorrect ? '#10b981' : 'var(--text-1)';
                var chkIcon = isCorrect ? '<i class="fa-solid fa-check" style="margin-right:5px;"></i>' : '';
                html += '<div style="padding:7px 12px;border-radius:6px;font-size:0.88rem;font-weight:500;background:' +
                    bg + ';border:1px solid ' + bd + ';color:' + cl + '">' + chkIcon + escHtml(c) + '</div>';
            }
            choicesList.innerHTML = html;
            choicesContainer.style.display = 'block';
        } else {
            choicesContainer.style.display = 'none';
        }
    }

    modal.style.display = 'flex';
};
