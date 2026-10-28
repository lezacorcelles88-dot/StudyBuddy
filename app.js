/**
 * StudyBuddy: Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate Voice Controller
    const voice = new VoiceController();
    const canvas = document.getElementById('voiceVisualizer');
    if (canvas) {
        voice.attachVisualizer(canvas);
    }

    // Application State
    const state = {
        subjects: [],
        currentSession: null,
        currentQuestionIndex: 0,
        currentQuestion: null,
        autoSpeakQuestion: true
    };

    // DOM Elements - Navigation & Status
    const voiceStatusPill = document.getElementById('voiceStatusPill');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const visualizerLabel = document.getElementById('visualizerLabel');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // DOM Elements - Arena
    const studySubjectSelect = document.getElementById('studySubjectSelect');
    const studyModeSelect = document.getElementById('studyModeSelect');
    const btnStartSession = document.getElementById('btnStartSession');
    
    const qSubjectBadge = document.getElementById('qSubjectBadge');
    const qTypeBadge = document.getElementById('qTypeBadge');
    const qDiffBadge = document.getElementById('qDiffBadge');
    const qCounterText = document.getElementById('qCounterText');
    const qText = document.getElementById('qText');
    const btnSpeakQuestion = document.getElementById('btnSpeakQuestion');
    const btnSkipQuestion = document.getElementById('btnSkipQuestion');

    const micStage = document.querySelector('.mic-stage');
    const btnMicTrigger = document.getElementById('btnMicTrigger');
    const micInstruction = document.getElementById('micInstruction');
    const transcriptionDisplay = document.getElementById('transcriptionDisplay');
    const btnClearTranscription = document.getElementById('btnClearTranscription');
    const btnSubmitAnswer = document.getElementById('btnSubmitAnswer');

    const feedbackCard = document.getElementById('feedbackCard');
    const scoreDial = document.getElementById('scoreDial');
    const scoreNumber = document.getElementById('scoreNumber');
    const scoreTitle = document.getElementById('scoreTitle');
    const scoreSubtitle = document.getElementById('scoreSubtitle');
    const feedbackTextContent = document.getElementById('feedbackTextContent');
    const missingConceptsBox = document.getElementById('missingConceptsBox');
    const missingConceptsList = document.getElementById('missingConceptsList');
    const btnSpeakFeedback = document.getElementById('btnSpeakFeedback');
    const btnSpeakVoiceMemo = document.getElementById('btnSpeakVoiceMemo');
    const btnRetryQuestion = document.getElementById('btnRetryQuestion');
    const btnNextQuestion = document.getElementById('btnNextQuestion');

    // DOM Elements - Student Account
    const btnOpenStudentModal = document.getElementById('btnOpenStudentModal');
    const studentAvatarText = document.getElementById('studentAvatarText');
    const studentHeaderName = document.getElementById('studentHeaderName');
    const studentHeaderId = document.getElementById('studentHeaderId');
    const studentAccountModal = document.getElementById('studentAccountModal');
    const btnCloseStudentModal = document.getElementById('btnCloseStudentModal');
    const btnCloseStudentModalBtn = document.getElementById('btnCloseStudentModalBtn');
    const studentTabBtns = document.querySelectorAll('.student-tab-btn');
    const studentPanels = document.querySelectorAll('.student-panel');
    const studentLoginForm = document.getElementById('studentLoginForm');
    const studentRegisterForm = document.getElementById('studentRegisterForm');
    const profileLargeAvatar = document.getElementById('profileLargeAvatar');
    const profileFullName = document.getElementById('profileFullName');
    const profileStudentId = document.getElementById('profileStudentId');
    const profileEmail = document.getElementById('profileEmail');
    const profileYearLevel = document.getElementById('profileYearLevel');
    const profileAttemptsCount = document.getElementById('profileAttemptsCount');
    const profileMasteredCount = document.getElementById('profileMasteredCount');

    // DOM Elements - Modals
    const addSubjectModal = document.getElementById('addSubjectModal');
    const btnOpenAddSubjectModal = document.getElementById('btnOpenAddSubjectModal');
    const btnTriggerAddSubjectFromMat = document.getElementById('btnTriggerAddSubjectFromMat');
    const btnQuickAddSubject = document.getElementById('btnQuickAddSubject');
    const btnCloseSubjectModal = document.getElementById('btnCloseSubjectModal');
    const btnCancelAddSubject = document.getElementById('btnCancelAddSubject');
    const addSubjectForm = document.getElementById('addSubjectForm');
    const newSubjectCode = document.getElementById('newSubjectCode');
    const newSubjectName = document.getElementById('newSubjectName');
    const newSubjectDesc = document.getElementById('newSubjectDesc');
    const newSubjectColor = document.getElementById('newSubjectColor');
    const btnSubmitSubject = document.getElementById('btnSubmitSubject');

    const uploadModal = document.getElementById('uploadModal');
    const btnOpenUploadModal = document.getElementById('btnOpenUploadModal');
    const btnTriggerUploadModal = document.getElementById('btnTriggerUploadModal');
    const btnCloseUploadModal = document.getElementById('btnCloseUploadModal');
    const btnCancelUpload = document.getElementById('btnCancelUpload');
    const uploadMaterialForm = document.getElementById('uploadMaterialForm');
    const uploadSubject = document.getElementById('uploadSubject');
    const fileDropzone = document.getElementById('fileDropzone');
    const materialFileInput = document.getElementById('materialFileInput');
    const fileChosenName = document.getElementById('fileChosenName');
    const uploadTabBtns = document.querySelectorAll('.upload-tab-btn');
    const uploadFilePanel = document.getElementById('uploadFilePanel');
    const uploadTextPanel = document.getElementById('uploadTextPanel');

    const settingsModal = document.getElementById('settingsModal');
    const btnOpenSettings = document.getElementById('btnOpenSettings');
    const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const voiceSelect = document.getElementById('voiceSelect');
    const voiceRateSlider = document.getElementById('voiceRateSlider');
    const voiceRateVal = document.getElementById('voiceRateVal');
    const voicePitchSlider = document.getElementById('voicePitchSlider');
    const voicePitchVal = document.getElementById('voicePitchVal');
    const btnTestVoice = document.getElementById('btnTestVoice');
    const geminiApiKey = document.getElementById('geminiApiKey');
    const btnResetDemoData = document.getElementById('btnResetDemoData');

    const addQuestionModal = document.getElementById('addQuestionModal');
    const btnOpenAddQuestionModal = document.getElementById('btnOpenAddQuestionModal');
    const btnCloseQuestionModal = document.getElementById('btnCloseQuestionModal');
    const btnCancelAddQuestion = document.getElementById('btnCancelAddQuestion');
    const addQuestionForm = document.getElementById('addQuestionForm');
    const customQSubject = document.getElementById('customQSubject');

    const viewMaterialModal = document.getElementById('viewMaterialModal');
    const btnCloseViewModal = document.getElementById('btnCloseViewModal');
    const btnCloseViewModalBtn = document.getElementById('btnCloseViewModalBtn');
    const viewMaterialTitle = document.getElementById('viewMaterialTitle');
    const viewMaterialBody = document.getElementById('viewMaterialBody');
    const btnGenFromViewer = document.getElementById('btnGenFromViewer');
    let currentViewingMaterialId = null;

    // Badges & Counters
    const materialsCountBadge = document.getElementById('materialsCountBadge');
    const questionsCountBadge = document.getElementById('questionsCountBadge');
    const weakCountBadge = document.getElementById('weakCountBadge');

    /* ================= VOICE CALLBACKS ================= */
    voice.onStateChange = (statusState, err) => {
        voiceStatusPill.className = 'voice-status-pill ' + statusState;
        if (statusState === 'speaking') {
            statusText.textContent = 'Speaking...';
            visualizerLabel.textContent = 'System Vocalizing (Text-to-Speech)';
            micStage.classList.remove('listening');
        } else if (statusState === 'listening') {
            statusText.textContent = 'Listening to student...';
            visualizerLabel.textContent = 'Microphone Active - Speak Your Answer Now';
            micStage.classList.add('listening');
            micInstruction.textContent = 'Listening... Speak clearly into your microphone';
        } else if (statusState === 'error') {
            statusText.textContent = 'Mic Error';
            visualizerLabel.textContent = 'Microphone error: ' + (err || 'Check permissions');
            micStage.classList.remove('listening');
            micInstruction.textContent = 'Microphone permission denied or not detected';
        } else {
            statusText.textContent = 'Voice Ready';
            visualizerLabel.textContent = 'Ready for active recall';
            micStage.classList.remove('listening');
            micInstruction.textContent = 'Click the microphone to start speaking your answer';
        }
    };

    voice.onTranscriptionUpdate = (text, isFinal) => {
        if (text) {
            transcriptionDisplay.innerText = text;
            btnSubmitAnswer.disabled = false;
        }
    };

    /* ================= TAB NAVIGATION ================= */
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetEl = document.getElementById(targetTab);
            if (targetEl) targetEl.classList.add('active');

            if (targetTab === 'tab-materials') loadMaterials();
            if (targetTab === 'tab-questions') loadQuestionBank();
            if (targetTab === 'tab-weak') loadWeakQueue();
            if (targetTab === 'tab-analytics') loadStats();
        });
    });

    /* ================= STUDENT ACCOUNT LOGIC ================= */
    async function loadCurrentStudent() {
        try {
            const res = await fetch('/api/auth/current-user');
            const data = await res.json();
            if (data.logged_in && data.student) {
                state.currentStudent = data.student;
                const initials = data.student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                
                if (studentAvatarText) studentAvatarText.textContent = initials;
                if (studentHeaderName) studentHeaderName.textContent = data.student.name;
                if (studentHeaderId) studentHeaderId.textContent = `${data.student.student_id} • ${data.student.year_level}`;

                if (profileLargeAvatar) profileLargeAvatar.textContent = initials;
                if (profileFullName) profileFullName.textContent = data.student.name;
                if (profileStudentId) profileStudentId.textContent = data.student.student_id;
                if (profileEmail) profileEmail.textContent = data.student.email;
                if (profileYearLevel) profileYearLevel.textContent = data.student.year_level;
                if (profileAttemptsCount) profileAttemptsCount.textContent = data.student.attempts_count || 0;
            }
        } catch (e) {
            console.error('Failed to load student info', e);
        }
    }

    if (btnOpenStudentModal) {
        btnOpenStudentModal.addEventListener('click', () => {
            loadCurrentStudent();
            studentAccountModal.style.display = 'flex';
        });
    }

    if (btnCloseStudentModal) btnCloseStudentModal.addEventListener('click', () => studentAccountModal.style.display = 'none');
    if (btnCloseStudentModalBtn) btnCloseStudentModalBtn.addEventListener('click', () => studentAccountModal.style.display = 'none');

    studentTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            studentTabBtns.forEach(b => b.classList.remove('active'));
            studentPanels.forEach(p => p.style.display = 'none');

            btn.classList.add('active');
            const mode = btn.getAttribute('data-student-mode');
            if (mode === 'profile') document.getElementById('panelStudentProfile').style.display = 'block';
            if (mode === 'login') document.getElementById('panelStudentLogin').style.display = 'block';
            if (mode === 'register') document.getElementById('panelStudentRegister').style.display = 'block';
        });
    });

    if (studentLoginForm) {
        studentLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifier = document.getElementById('loginIdentifier').value.trim();
            const password = document.getElementById('loginPassword').value.trim();

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ student_id_or_email: identifier, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login failed');

                showToast(data.message, 'success');
                studentAccountModal.style.display = 'none';
                studentLoginForm.reset();
                await loadCurrentStudent();
                await loadStats();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    if (studentRegisterForm) {
        studentRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name: document.getElementById('regFullName')?.value.trim() || '',
                email: document.getElementById('regEmail')?.value.trim() || '',
                year_level: document.getElementById('regYearLevel')?.value.trim() || 'Student',
                password: document.getElementById('regPassword')?.value.trim() || ''
            };

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Registration failed');

                showToast(data.message, 'success');
                studentAccountModal.style.display = 'none';
                studentRegisterForm.reset();
                await loadCurrentStudent();
                await loadStats();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    /* ================= INITIAL DATA LOADING ================= */
    async function initApp() {
        await loadCurrentStudent();
        await loadSubjects();
        await loadStats();
        await loadSettings();
        populateVoices();
    }

    async function loadSubjects(selectedId = null) {
        try {
            const res = await fetch('/api/subjects');
            state.subjects = await res.json();
            
            // Populate select dropdowns
            const subjectSelects = [studySubjectSelect, uploadSubject, customQSubject, document.getElementById('qbSubjectFilter')];
            subjectSelects.forEach(select => {
                if (!select) return;
                const isFilter = select.id === 'studySubjectSelect' || select.id === 'qbSubjectFilter';
                const currentVal = select.value;
                select.innerHTML = isFilter ? '<option value="all">All 1st-Year BSIT Subjects</option>' : '';
                
                state.subjects.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub.id;
                    opt.textContent = `${sub.code}: ${sub.name}`;
                    select.appendChild(opt);
                });

                if (selectedId) {
                    select.value = selectedId;
                } else if (currentVal && Array.from(select.options).some(o => o.value == currentVal)) {
                    select.value = currentVal;
                }
            });

            // Populate existing subjects list in Add Subject modal
            const existingList = document.getElementById('existingSubjectsList');
            const countLabel = document.getElementById('existingSubjectCount');
            if (countLabel) countLabel.textContent = `${state.subjects.length} subjects`;
            if (existingList) {
                if (state.subjects.length === 0) {
                    existingList.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);padding:0.4rem;">No subjects yet. Create one above!</div>';
                } else {
                    existingList.innerHTML = state.subjects.map(s => `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.6rem;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex;align-items:center;gap:0.5rem;overflow:hidden;">
                                <span class="badge badge-subject" style="background:${s.color || '#6366f1'}22;color:${s.color || '#818cf8'};font-size:0.75rem;padding:0.15rem 0.45rem;">${s.code}</span>
                                <span style="font-size:0.82rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${s.name}</span>
                            </div>
                            <button type="button" class="btn btn-icon btn-sm" onclick="window.deleteSubject(${s.id}, '${s.code}')" title="Remove ${s.code}" style="color:var(--danger);padding:0.25rem 0.5rem;font-size:0.8rem;">
                                <i class="fa-solid fa-trash"></i> Remove
                            </button>
                        </div>
                    `).join('');
                }
            }
        } catch (e) {
            console.error('Failed to load subjects', e);
        }
    }

    window.deleteSubject = async (id, code = '') => {
        const confirmMsg = code 
            ? `Are you sure you want to remove subject "${code}"?\n\nThis will permanently delete all associated reviewer materials, questions, and practice history.`
            : `Are you sure you want to remove this subject and all its materials/questions?`;
        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to remove subject');
            
            showToast(data.message || `Subject ${code} removed successfully`, 'success');
            await loadSubjects();
            await loadStats();
            await loadMaterials();
            await loadQuestionBank();
        } catch (e) {
            showToast(e.message || 'Failed to remove subject', 'error');
        }
    };

    async function loadStats() {
        try {
            const res = await fetch('/api/stats');
            const stats = await res.json();

            materialsCountBadge.textContent = stats.total_materials;
            questionsCountBadge.textContent = stats.total_questions;
            weakCountBadge.textContent = stats.weak_questions;

            // Analytics Panel
            const elRate = document.getElementById('statMasteryRate');
            const elMastered = document.getElementById('statMasteredCount');
            const elWeak = document.getElementById('statWeakCount');
            const elAttempts = document.getElementById('statTotalAttempts');
            
            if (elRate) elRate.textContent = stats.mastery_rate + '%';
            if (elMastered) elMastered.textContent = stats.mastered_questions;
            if (elWeak) elWeak.textContent = stats.weak_questions;
            if (elAttempts) elAttempts.textContent = stats.total_attempts;

            // Subject breakdown with Remove Subject button
            const container = document.getElementById('subjectProgressContainer');
            if (container && stats.subject_breakdown) {
                container.innerHTML = stats.subject_breakdown.map(sub => `
                    <div class="sub-prog-card">
                        <div class="sub-prog-header">
                            <span class="sub-prog-name">${sub.code}: ${sub.name}</span>
                            <div style="display:flex;align-items:center;gap:0.6rem;">
                                <span class="sub-prog-pct">${sub.mastery_rate}%</span>
                                <button class="btn btn-icon btn-sm" onclick="window.deleteSubject(${sub.id}, '${sub.code}')" title="Remove Subject ${sub.code}" style="color:var(--danger);font-size:0.75rem;padding:0.2rem 0.4rem;">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${sub.mastery_rate}%;"></div>
                        </div>
                        <div class="sub-prog-counts">
                            ${sub.mastered_questions} of ${sub.total_questions} questions mastered
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error('Failed to load stats', e);
        }
    }

    /* ================= STUDY ARENA LOGIC ================= */
    btnStartSession.addEventListener('click', async () => {
        const subject_id = studySubjectSelect.value;
        const mode = studyModeSelect.value;

        btnStartSession.disabled = true;
        btnStartSession.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing Session...';

        try {
            const res = await fetch('/api/study/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject_id, mode, limit: 10 })
            });
            const data = await res.json();

            if (!data.questions || data.questions.length === 0) {
                showToast('No questions found for this subject/mode. Upload reviewer notes or select "All Subjects".', 'warning');
                return;
            }

            state.currentSession = data.questions;
            state.currentQuestionIndex = 0;
            displayCurrentQuestion();
            showToast(`Voice study session started with ${data.questions.length} questions!`, 'success');
        } catch (e) {
            showToast('Failed to start study session', 'error');
        } finally {
            btnStartSession.disabled = false;
            btnStartSession.innerHTML = '<i class="fa-solid fa-play"></i> Start Voice Session';
        }
    });

    function displayCurrentQuestion() {
        if (!state.currentSession || state.currentSession.length === 0) return;
        
        state.currentQuestion = state.currentSession[state.currentQuestionIndex];
        const q = state.currentQuestion;

        qSubjectBadge.textContent = q.subject_code || 'BSIT';
        qTypeBadge.textContent = q.question_type ? q.question_type.toUpperCase() : 'CONCEPTUAL';
        qDiffBadge.textContent = (q.difficulty || 'MEDIUM').toUpperCase();
        qCounterText.textContent = `Question ${state.currentQuestionIndex + 1} of ${state.currentSession.length}`;
        qText.textContent = q.question_text;

        // Reset inputs & feedback
        transcriptionDisplay.innerText = '';
        btnSubmitAnswer.disabled = true;
        feedbackCard.style.display = 'none';

        // Auto speak question if enabled
        if (state.autoSpeakQuestion) {
            voice.speak(q.question_text);
        }
    }

    btnSpeakQuestion.addEventListener('click', () => {
        if (state.currentQuestion) {
            voice.speak(state.currentQuestion.question_text);
        }
    });

    btnSkipQuestion.addEventListener('click', () => {
        moveToNextQuestion();
    });

    // Mic Trigger
    btnMicTrigger.addEventListener('click', () => {
        voice.toggleListening();
    });

    btnClearTranscription.addEventListener('click', () => {
        transcriptionDisplay.innerText = '';
        btnSubmitAnswer.disabled = true;
    });

    transcriptionDisplay.addEventListener('input', () => {
        btnSubmitAnswer.disabled = transcriptionDisplay.innerText.trim().length === 0;
    });

    // Submit Answer & Evaluate
    btnSubmitAnswer.addEventListener('click', async () => {
        const spokenAnswer = transcriptionDisplay.innerText.trim();
        if (!spokenAnswer || !state.currentQuestion) return;

        voice.stopListening();
        voice.stopSpeaking();

        btnSubmitAnswer.disabled = true;
        btnSubmitAnswer.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Evaluating Semantic Answer...';

        try {
            const res = await fetch('/api/study/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question_id: state.currentQuestion.id,
                    spoken_answer: spokenAnswer,
                    is_voice_input: true
                })
            });

            const result = await res.json();
            renderFeedback(result);
            loadStats(); // refresh mastery counts
        } catch (e) {
            showToast('Evaluation failed. Check server connection.', 'error');
        } finally {
            btnSubmitAnswer.disabled = false;
            btnSubmitAnswer.innerHTML = '<i class="fa-solid fa-check-circle"></i> Evaluate Answer';
        }
    });

    function renderFeedback(res) {
        feedbackCard.style.display = 'flex';
        feedbackCard.className = res.is_passed ? 'card feedback-card glass-panel' : 'card feedback-card glass-panel failed';

        // Verdict Elements
        const verdictLabel = document.getElementById('verdictLabel');
        const verdictIcon = document.getElementById('verdictIcon');
        const voiceMemoText = document.getElementById('voiceMemoText');
        const calloutExpectedAnswer = document.getElementById('calloutExpectedAnswer');

        if (res.is_passed) {
            verdictLabel.textContent = "CORRECT!";
            verdictIcon.className = "fa-solid fa-circle-check";
            scoreTitle.textContent = res.is_mastered ? 'Concept Mastered!' : 'Great Answer!';
            scoreSubtitle.textContent = 'Accurately articulated the concepts in your notes';
        } else {
            verdictLabel.textContent = "WRONG";
            verdictIcon.className = "fa-solid fa-circle-xmark";
            scoreTitle.textContent = 'Incorrect / Needs Review';
            scoreSubtitle.textContent = 'Re-queued for active recall practice';
        }

        const memo = res.voice_memo || (res.is_passed ? `Correct! ${res.feedback}` : `Wrong. The correct answer is: ${res.expected_answer}. ${res.feedback}`);
        if (voiceMemoText) voiceMemoText.textContent = `"${memo}"`;
        state.lastVoiceMemo = memo;

        if (calloutExpectedAnswer) {
            calloutExpectedAnswer.textContent = res.expected_answer;
        }

        scoreNumber.textContent = Math.round(res.score);
        feedbackTextContent.textContent = res.feedback;
        
        // Missing concepts tags
        if (res.missing_concepts && res.missing_concepts.length > 0) {
            missingConceptsBox.style.display = 'block';
            missingConceptsList.innerHTML = res.missing_concepts.map(c => `
                <span class="concept-tag">${c}</span>
            `).join('');
        } else {
            missingConceptsBox.style.display = 'none';
        }

        // CRITICAL INTERACTIVE VOICE MEMO:
        // Speaks "Correct! ..." or "Wrong. The correct answer is: ..." aloud!
        voice.speak(memo);

        // Smooth scroll to feedback
        feedbackCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (btnSpeakVoiceMemo) {
        btnSpeakVoiceMemo.addEventListener('click', () => {
            if (state.lastVoiceMemo) voice.speak(state.lastVoiceMemo);
        });
    }

    if (btnSpeakFeedback) {
        btnSpeakFeedback.addEventListener('click', () => {
            const text = feedbackTextContent.textContent;
            if (text) voice.speak(text);
        });
    }


    btnRetryQuestion.addEventListener('click', () => {
        feedbackCard.style.display = 'none';
        transcriptionDisplay.innerText = '';
        btnSubmitAnswer.disabled = true;
        voice.speak(state.currentQuestion.question_text);
    });

    btnNextQuestion.addEventListener('click', () => {
        moveToNextQuestion();
    });

    function moveToNextQuestion() {
        if (!state.currentSession) return;
        state.currentQuestionIndex++;
        if (state.currentQuestionIndex < state.currentSession.length) {
            displayCurrentQuestion();
        } else {
            showToast('Study session complete! Excellent active recall practice.', 'success');
            voice.speak("Congratulations! You have completed all questions in this active recall study session. Check your analytics dashboard to see your updated subject mastery.");
            qText.textContent = "Session Complete! You've reviewed all queued questions. Click 'Start Voice Session' to practice again.";
            feedbackCard.style.display = 'none';
        }
    }

    /* ================= REVIEW MATERIALS ================= */
    async function loadMaterials() {
        const grid = document.getElementById('materialsGrid');
        grid.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading course reviewers...</div>';

        try {
            const res = await fetch('/api/materials');
            const materials = await res.json();
            
            if (materials.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-folder-open empty-icon"></i>
                        <h3>No Review Materials Uploaded Yet</h3>
                        <p>Upload your 1st-Year BSIT handouts or lecture notes (PDF/TXT) to begin generating study questions.</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = materials.map(m => `
                <div class="card glass-panel material-card">
                    <div>
                        <div class="mat-top">
                            <span class="badge badge-subject">${m.subject_code}</span>
                            <span class="mat-date"><i class="fa-solid fa-calendar"></i> ${m.created_at}</span>
                        </div>
                        <h3 class="mat-title">${m.title}</h3>
                        <p class="mat-snippet">${m.content_snippet}</p>
                    </div>
                    <div class="mat-footer">
                        <div class="mat-stats">
                            <span><i class="fa-solid fa-file-lines"></i> ${m.word_count} words</span>
                            <span><i class="fa-solid fa-circle-question"></i> ${m.questions_count} questions</span>
                        </div>
                        <div class="mat-actions">
                            <button class="btn btn-icon btn-sm" onclick="window.viewMaterial(${m.id})" title="View Content">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="window.generateQuestionsFromMat(${m.id})" title="Synthesize Questions">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> Synthesize
                            </button>
                            <button class="btn btn-icon btn-sm" onclick="window.deleteMaterial(${m.id})" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            grid.innerHTML = '<div class="error-msg">Failed to load materials.</div>';
        }
    }

    window.viewMaterial = async (id) => {
        try {
            const res = await fetch(`/api/materials/${id}`);
            const mat = await res.json();
            currentViewingMaterialId = id;
            viewMaterialTitle.textContent = `${mat.subject_code}: ${mat.title}`;
            viewMaterialBody.textContent = mat.full_content;
            viewMaterialModal.style.display = 'flex';
        } catch (e) {
            showToast('Failed to view reviewer', 'error');
        }
    };

    window.generateQuestionsFromMat = async (id) => {
        showToast('Synthesizing grounded questions with AI engine...', 'info');
        try {
            const res = await fetch(`/api/materials/${id}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: 5 })
            });
            const data = await res.json();
            showToast(data.message, 'success');
            loadMaterials();
            loadStats();
        } catch (e) {
            showToast('Failed to generate questions', 'error');
        }
    };

    window.deleteMaterial = async (id) => {
        if (!confirm('Are you sure you want to delete this reviewer and its associated questions?')) return;
        try {
            await fetch(`/api/materials/${id}`, { method: 'DELETE' });
            showToast('Material deleted', 'success');
            loadMaterials();
            loadStats();
        } catch (e) {
            showToast('Failed to delete', 'error');
        }
    };

    btnGenFromViewer.addEventListener('click', () => {
        if (currentViewingMaterialId) {
            window.generateQuestionsFromMat(currentViewingMaterialId);
            viewMaterialModal.style.display = 'none';
        }
    });

    btnCloseViewModal.addEventListener('click', () => viewMaterialModal.style.display = 'none');
    btnCloseViewModalBtn.addEventListener('click', () => viewMaterialModal.style.display = 'none');

    // ================= ADD SUBJECT MODAL =================
    const openAddSubject = () => {
        if (addSubjectForm) addSubjectForm.reset();
        if (addSubjectModal) addSubjectModal.style.display = 'flex';
        if (newSubjectCode) setTimeout(() => newSubjectCode.focus(), 50);
    };

    if (btnOpenAddSubjectModal) btnOpenAddSubjectModal.addEventListener('click', openAddSubject);
    if (btnTriggerAddSubjectFromMat) btnTriggerAddSubjectFromMat.addEventListener('click', openAddSubject);
    if (btnQuickAddSubject) btnQuickAddSubject.addEventListener('click', openAddSubject);
    if (btnCloseSubjectModal) btnCloseSubjectModal.addEventListener('click', () => addSubjectModal.style.display = 'none');
    if (btnCancelAddSubject) btnCancelAddSubject.addEventListener('click', () => addSubjectModal.style.display = 'none');

    if (addSubjectForm) {
        addSubjectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            btnSubmitSubject.disabled = true;
            btnSubmitSubject.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Subject...';

            const payload = {
                code: newSubjectCode.value.trim(),
                name: newSubjectName.value.trim(),
                description: newSubjectDesc ? newSubjectDesc.value.trim() : '',
                color: newSubjectColor ? newSubjectColor.value : '#6366f1'
            };

            try {
                const res = await fetch('/api/subjects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to create subject');

                showToast(`Subject ${data.code}: ${data.name} created successfully!`, 'success');
                addSubjectModal.style.display = 'none';
                addSubjectForm.reset();

                // Reload all subject dropdowns and auto-select new subject
                await loadSubjects(data.id);
                await loadStats();
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btnSubmitSubject.disabled = false;
                btnSubmitSubject.innerHTML = '<i class="fa-solid fa-check"></i> Create Subject';
            }
        });
    }

    // Material Upload Modal
    const openUpload = () => {
        uploadMaterialForm.reset();
        fileChosenName.textContent = 'No file selected';
        uploadModal.style.display = 'flex';
    };
    btnOpenUploadModal.addEventListener('click', openUpload);
    btnTriggerUploadModal.addEventListener('click', openUpload);
    btnCloseUploadModal.addEventListener('click', () => uploadModal.style.display = 'none');
    btnCancelUpload.addEventListener('click', () => uploadModal.style.display = 'none');

    // Dropzone logic
    fileDropzone.addEventListener('click', () => materialFileInput.click());
    materialFileInput.addEventListener('change', () => {
        if (materialFileInput.files.length > 0) {
            fileChosenName.textContent = materialFileInput.files[0].name;
        }
    });

    uploadTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            uploadTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.getAttribute('data-upload-mode');
            if (mode === 'file') {
                uploadFilePanel.style.display = 'block';
                uploadTextPanel.style.display = 'none';
            } else {
                uploadFilePanel.style.display = 'none';
                uploadTextPanel.style.display = 'block';
            }
        });
    });

    uploadMaterialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btnSubmitMaterial');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing & Generating Questions...';

        const formData = new FormData();
        formData.append('subject_id', uploadSubject.value);
        formData.append('title', document.getElementById('uploadTitle').value);
        formData.append('auto_generate', 'true');

        const isFileMode = uploadFilePanel.style.display !== 'none';
        if (isFileMode && materialFileInput.files.length > 0) {
            formData.append('file', materialFileInput.files[0]);
        } else {
            formData.append('content_text', document.getElementById('materialTextInput').value);
        }

        try {
            const res = await fetch('/api/materials', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');

            showToast(`Reviewer saved! ${data.auto_generated_questions || 0} questions generated.`, 'success');
            uploadModal.style.display = 'none';
            loadMaterials();
            loadStats();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Process Reviewer';
        }
    });

    /* ================= QUESTION BANK ================= */
    const qbSubjectFilter = document.getElementById('qbSubjectFilter');
    const qbStatusFilter = document.getElementById('qbStatusFilter');
    qbSubjectFilter.addEventListener('change', loadQuestionBank);
    qbStatusFilter.addEventListener('change', loadQuestionBank);

    async function loadQuestionBank() {
        const tbody = document.getElementById('questionTableBody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading question bank...</td></tr>';

        const subId = qbSubjectFilter.value;
        const status = qbStatusFilter.value;

        try {
            const res = await fetch(`/api/questions?subject_id=${subId}&filter=${status}`);
            const questions = await res.json();

            if (questions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 2rem;">No questions found. Upload a reviewer to generate questions automatically.</td></tr>';
                return;
            }

            tbody.innerHTML = questions.map(q => `
                <tr>
                    <td><span class="badge badge-subject">${q.subject_code}</span></td>
                    <td style="max-width: 280px; font-weight: 500;">${q.question_text}</td>
                    <td style="max-width: 280px; color: var(--text-secondary); font-size: 0.85rem;">${q.expected_answer}</td>
                    <td><span class="badge badge-type">${q.question_type}</span></td>
                    <td><strong style="color: ${q.last_score >= 70 ? 'var(--success)' : 'var(--danger)'};">${q.last_score}%</strong></td>
                    <td>
                        <span class="badge ${q.is_mastered ? 'badge-diff' : 'badge-type'}" style="${q.is_mastered ? '' : 'background: rgba(244,63,94,0.15); color: #fda4af;'}">
                            ${q.is_mastered ? 'Mastered' : 'Needs Practice'}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 0.4rem;">
                            <button class="btn btn-icon btn-sm" onclick="window.toggleMastery(${q.id}, ${!q.is_mastered})" title="Toggle Mastery">
                                <i class="fa-solid ${q.is_mastered ? 'fa-circle-xmark' : 'fa-circle-check'}"></i>
                            </button>
                            <button class="btn btn-icon btn-sm" onclick="window.deleteQuestion(${q.id})" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center error-msg">Failed to load question bank.</td></tr>';
        }
    }

    window.toggleMastery = async (id, newStatus) => {
        try {
            await fetch(`/api/questions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_mastered: newStatus })
            });
            showToast('Mastery status updated', 'success');
            loadQuestionBank();
            loadStats();
        } catch (e) {
            showToast('Failed to update status', 'error');
        }
    };

    window.deleteQuestion = async (id) => {
        if (!confirm('Delete this question?')) return;
        try {
            await fetch(`/api/questions/${id}`, { method: 'DELETE' });
            showToast('Question deleted', 'success');
            loadQuestionBank();
            loadStats();
        } catch (e) {
            showToast('Failed to delete', 'error');
        }
    };

    btnOpenAddQuestionModal.addEventListener('click', () => addQuestionModal.style.display = 'flex');
    btnCloseQuestionModal.addEventListener('click', () => addQuestionModal.style.display = 'none');
    btnCancelAddQuestion.addEventListener('click', () => addQuestionModal.style.display = 'none');

    addQuestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const concepts = document.getElementById('customQConcepts').value.split(',').map(c => c.trim()).filter(Boolean);
        
        try {
            const res = await fetch('/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject_id: customQSubject.value,
                    question_text: document.getElementById('customQText').value,
                    expected_answer: document.getElementById('customQAnswer').value,
                    key_concepts: concepts,
                    question_type: document.getElementById('customQType').value,
                    difficulty: document.getElementById('customQDiff').value
                })
            });
            if (!res.ok) throw new Error('Failed to create question');
            showToast('Custom study question added!', 'success');
            addQuestionModal.style.display = 'none';
            addQuestionForm.reset();
            loadQuestionBank();
            loadStats();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    /* ================= SPACED REPETITION / WEAK QUEUE ================= */
    async function loadWeakQueue() {
        const container = document.getElementById('weakItemsList');
        container.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Checking spaced repetition queue...</div>';

        try {
            const res = await fetch('/api/study/weak-queue');
            const items = await res.json();

            if (items.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-circle-check empty-icon" style="color: var(--success);"></i>
                        <h3>All Caught Up!</h3>
                        <p>No questions currently in the repetition queue. All reviewed items scored above 70%!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = items.map(q => `
                <div class="card glass-panel weak-item-card">
                    <div class="weak-item-left">
                        <div class="weak-item-meta">
                            <span class="badge badge-subject">${q.subject_code}</span>
                            <span>Last score: <strong style="color: var(--danger);">${q.last_score}%</strong></span>
                            <span>Times practiced: ${q.times_practiced}</span>
                        </div>
                        <h3 class="weak-item-q">${q.question_text}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-secondary);">Source Answer: ${q.expected_answer.substring(0, 140)}...</p>
                    </div>
                    <div>
                        <button class="btn btn-warning btn-sm" onclick="window.drillSingleQuestion(${q.id})">
                            <i class="fa-solid fa-microphone"></i> Practice Now
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = '<div class="error-msg">Failed to load repetition queue.</div>';
        }
    }

    const btnPracticeAllWeak = document.getElementById('btnPracticeAllWeak');
    btnPracticeAllWeak.addEventListener('click', () => {
        // Switch to arena tab and set mode to weak
        studyModeSelect.value = 'weak';
        document.querySelector('.tab-btn[data-tab="tab-arena"]').click();
        btnStartSession.click();
    });

    window.drillSingleQuestion = async (id) => {
        try {
            const res = await fetch(`/api/questions/${id}`);
            const q = await res.json();
            state.currentSession = [q];
            state.currentQuestionIndex = 0;
            document.querySelector('.tab-btn[data-tab="tab-arena"]').click();
            displayCurrentQuestion();
        } catch (e) {
            showToast('Failed to start single question drill', 'error');
        }
    };

    /* ================= SETTINGS & VOICES ================= */
    btnOpenSettings.addEventListener('click', () => settingsModal.style.display = 'flex');
    btnCloseSettingsModal.addEventListener('click', () => settingsModal.style.display = 'none');

    function populateVoices() {
        const voices = voice.voices;
        if (!voices || voices.length === 0) return;

        voiceSelect.innerHTML = voices.map((v, i) => `
            <option value="${i}" ${v === voice.selectedVoice ? 'selected' : ''}>
                ${v.name} (${v.lang})
            </option>
        `).join('');
    }

    voiceSelect.addEventListener('change', () => {
        const idx = parseInt(voiceSelect.value);
        if (voice.voices[idx]) {
            voice.selectedVoice = voice.voices[idx];
        }
    });

    voiceRateSlider.addEventListener('input', () => {
        voiceRateVal.textContent = voiceRateSlider.value + 'x';
        voice.rate = parseFloat(voiceRateSlider.value);
    });

    voicePitchSlider.addEventListener('input', () => {
        voicePitchVal.textContent = voicePitchSlider.value;
        voice.pitch = parseFloat(voicePitchSlider.value);
    });

    btnTestVoice.addEventListener('click', () => {
        voice.speak("Hello Rhea! This is StudyBuddy, your voice-based study assistant for first-year BSIT subjects.");
    });

    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.voice_rate) {
                voiceRateSlider.value = data.voice_rate;
                voiceRateVal.textContent = data.voice_rate + 'x';
                voice.rate = data.voice_rate;
            }
            if (data.voice_pitch) {
                voicePitchSlider.value = data.voice_pitch;
                voicePitchVal.textContent = data.voice_pitch;
                voice.pitch = data.voice_pitch;
            }
            state.autoSpeakQuestion = data.auto_speak_question;
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    }

    btnSaveSettings.addEventListener('click', async () => {
        const payload = {
            voice_rate: voiceRateSlider.value,
            voice_pitch: voicePitchSlider.value,
        };
        const key = geminiApiKey.value.trim();
        if (key) {
            payload.gemini_api_key = key;
        }

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            showToast('Settings saved successfully', 'success');
            settingsModal.style.display = 'none';
        } catch (e) {
            showToast('Failed to save settings', 'error');
        }
    });

    btnResetDemoData.addEventListener('click', async () => {
        if (!confirm('This will restore all default 1st-Year BSIT subjects, notes, and study questions. Proceed?')) return;
        try {
            const res = await fetch('/api/reset-data', { method: 'POST' });
            const data = await res.json();
            showToast(data.message, 'success');
            settingsModal.style.display = 'none';
            await loadSubjects();
            await loadStats();
            document.querySelector('.tab-btn[data-tab="tab-arena"]').click();
        } catch (e) {
            showToast('Failed to reset demo data', 'error');
        }
    });

    /* ================= TOAST NOTIFICATION HELPER ================= */
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-circle-xmark';
        if (type === 'warning') icon = 'fa-triangle-exclamation';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Initialize application
    initApp();
});
