# StudyBuddy: A Voice-Based Study Assistance System for First-Year BSIT Students

**Researcher:** Rhea Dumagat  
**Program:** Bachelor of Science in Information Technology (BSIT)  
**Project Category:** Capstone Project / Applied Educational AI  

---

## 📌 Project Overview
**StudyBuddy** is a voice-interactive, context-grounded active recall study web application designed specifically for first-year BSIT college students. Solitary silent note reading often creates a false sense of competence; StudyBuddy transforms passive reviewing into active spoken verbalization (the Feynman Technique / Protégé Effect).

Students upload course reviewers or lecture handouts (PDF or plain text), and the system automatically synthesizes bounded study questions. Using hands-free **Text-to-Speech (TTS)** and **Speech-to-Text (STT)**, students answer verbally. The system scores spoken responses against source materials, provides instructor-style verbal and visual feedback, and re-queues incomplete answers for spaced repetition.

---

## 🚀 Key Features

1. **🎙️ Voice Study Arena (Hands-Free Active Recall):**
   - High-fidelity **Text-to-Speech (TTS)** that reads study questions and evaluation feedback aloud.
   - Real-time **Speech-to-Text (STT)** microphone input powered by the native browser Web Speech API (zero API latency, zero cost).
   - Animated **Audio Canvas Visualizer** displaying dynamic waveforms when vocalizing or listening.
   - Real-time editable speech transcription with instant retry.

2. **📚 Review Material Ingestion & Document Grounding:**
   - Supports upload of lecture handouts (PDF and TXT) or direct text pasting.
   - Categorized by foundational first-year BSIT subjects (*IT 101 Intro to Computing*, *IT 102 Computer Programming 1*, *IT 103 Discrete Structures*).
   - Prevents AI hallucinations by strictly grounding questions and rubrics on student-uploaded text.

3. **🤖 Automated Question Synthesis & Semantic Answer Grader:**
   - Synthesizes definitions, conceptual questions, syntax drills, and identification items.
   - Evaluates spoken answers for core concept coverage, keyword presence, and semantic similarity.
   - Identifies specific missing key terms and explains what was left out.
   - Includes an intelligent built-in semantic parser that works **100% offline** without API keys, plus optional support for **Google Gemini 1.5 Flash API**.

4. **🔁 Adaptive Spaced Repetition (Weak Topics Queue):**
   - Automatically tracks question mastery (`times_practiced`, `times_correct`, `last_score`).
   - Flags questions scored `< 70%` and routes them into a dedicated Repetition Queue for targeted drill practice.

5. **📊 Mastery Analytics & Progress Dashboard:**
   - Real-time percentage mastery tracking per subject.
   - Detailed visual breakdown complying with **ISO/IEC 25010** software quality standards.

---

## 🛠️ Technology Stack

- **Backend:** Python 3.14 + Flask
- **Database:** SQLite (default for zero-setup execution, seamlessly switchable to MySQL via `DATABASE_URL`)
- **ORM:** Flask-SQLAlchemy / SQLAlchemy 2.0
- **Document Parsing:** `pypdf`
- **Frontend:** HTML5, Modern Vanilla CSS3 (Custom Glassmorphism Design System), JavaScript (ES6+)
- **Audio & Speech:** Browser Web Speech API (`SpeechSynthesis` & `webkitSpeechRecognition`)
- **AI Engine:** Grounded Heuristic NLP Engine + Optional Google Gemini 1.5 API Integration

---

## 💻 Quick Start & Running the Project

### 1. Requirements
Ensure Python is installed on your computer.

### 2. Install Dependencies
Open your terminal or command prompt in this directory:
```bash
pip install -r requirements.txt
```

### 3. Launch the Application
Run:
```bash
python app.py
```

### 4. Access the Web App
Open your web browser (Google Chrome or Microsoft Edge recommended for full microphone speech recognition support) and navigate to:
```
http://127.0.0.1:5000
```

---

## 📁 Project Directory Structure

```
StudyBuddy/
├── app.py                   # Main Flask application and REST API endpoints
├── models.py                # Database models (Subject, Material, Question, Attempt)
├── ai_engine.py             # Grounded question synthesis and semantic grader
├── pdf_processor.py         # PDF text extraction and document cleaning
├── seed_data.py             # Pre-seeded 1st-year BSIT sample reviewers and questions
├── requirements.txt         # Python package dependencies
├── CAPSTONE_PROPOSAL.md     # Full Chapter 1 Title Proposal & Capstone Defense Document
├── README.md                # Project documentation and guide
├── templates/
│   └── index.html           # Single-page interface (Arena, Materials, Questions, Analytics)
└── static/
    ├── css/
    │   └── style.css        # Glassmorphic dark theme, animations, and responsive styles
    └── js/
        ├── voice_controller.js # Web Speech API & audio waveform visualizer engine
        └── app.js           # UI logic, API connector, and study session controller
```

---

## 🎓 Capstone Defense Reference
For complete Chapter 1 documentation (Background of the Study, Statement of the Problem, Objectives, Conceptual Framework IPO Model, Scope & Delimitation, and Definition of Terms), please refer to [`CAPSTONE_PROPOSAL.md`](CAPSTONE_PROPOSAL.md).
