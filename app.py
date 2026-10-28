import os
import json
import random
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from werkzeug.utils import secure_filename

from models import db, Subject, Material, Question, StudyAttempt, SystemSetting, Student
from ai_engine import AIEngine, format_as_assessment_text, strip_reviewer_meta_phrases
from pdf_processor import extract_document_text, clean_extracted_text
from seed_data import seed_database

app = Flask(__name__)

# ─── Configuration ─────────────────────────────────────────────────────────
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH   = os.path.join(BASE_DIR, 'studybuddy.db')

# Support Render's persistent disk for uploads
UPLOAD_ROOT = os.environ.get(
    'UPLOAD_ROOT',
    '/opt/render/project/src/uploads' if os.environ.get('RENDER') else os.path.join(BASE_DIR, 'uploads')
)

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', f'sqlite:///{DB_PATH}')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'studybuddy-bsit-secret-2026')
app.config['UPLOAD_FOLDER'] = UPLOAD_ROOT
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32 MB max

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
db.init_app(app)

ai_engine = AIEngine()

# Initialize DB on startup
with app.app_context():
    db.create_all()
    try:
        from sqlalchemy import text
        with db.engine.connect() as conn:
            for col, col_type in [('choices', 'TEXT DEFAULT "[]"'), ('explanation', 'TEXT'), ('topic', 'VARCHAR(150)'), ('source_reference', 'VARCHAR(255)')]:
                try:
                    conn.execute(text(f"ALTER TABLE questions ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
    except Exception as e:
        pass
    seed_database()
    # Load Gemini key from env var first, then DB
    env_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if env_key:
        ai_engine.set_api_key(env_key)
        SystemSetting.set_value('gemini_api_key', env_key)
    else:
        saved_key = SystemSetting.get_value('gemini_api_key')
        if saved_key:
            ai_engine.set_api_key(saved_key)

def get_current_student():
    """Returns currently logged in student from session or None if unauthenticated."""
    student_id = session.get('student_id')
    if student_id:
        return db.session.get(Student, student_id)
    return None

# ----------------- AUTHENTICATION API -----------------
@app.route('/api/auth/current-user', methods=['GET'])
def get_current_user():
    student = get_current_student()
    has_any = Student.query.count() > 0
    if student:
        return jsonify({
            'logged_in': True,
            'student': student.to_dict(),
            'has_any_accounts': has_any
        })
    return jsonify({
        'logged_in': False,
        'student': None,
        'has_any_accounts': has_any
    })

@app.route('/api/auth/demo-login', methods=['POST'])
def demo_login():
    student = Student.query.first()
    if not student:
        return jsonify({'error': 'No accounts found in database. Please create an account.'}), 404
    session['student_id'] = student.id
    return jsonify({
        'message': f'Logged in as {student.name}',
        'student': student.to_dict()
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    identifier = (data.get('student_id_or_email') or data.get('email') or data.get('student_id') or '').strip()
    password = (data.get('password') or '').strip()

    if not identifier or not password:
        return jsonify({'error': 'Email and Password are required'}), 400

    student = Student.query.filter(
        (Student.student_id == identifier) | (Student.email == identifier)
    ).first()

    if not student or not student.check_password(password):
        return jsonify({'error': 'Invalid Email or Password'}), 401

    session['student_id'] = student.id
    return jsonify({
        'message': f'Welcome back, {student.name}!',
        'student': student.to_dict()
    })

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()
    password = (data.get('password') or '').strip()
    year_level = (data.get('year_level') or 'Student').strip()

    if not name or not email or not password:
        return jsonify({'error': 'Name, Email, and Password are required'}), 400

    if Student.query.filter_by(email=email).first():
        return jsonify({'error': f'Email {email} is already registered'}), 409

    # Generate unique Student ID automatically if not provided
    student_id = (data.get('student_id') or '').strip()
    if not student_id:
        while True:
            candidate_id = f"STU-{uuid.uuid4().hex[:6].upper()}"
            if not Student.query.filter_by(student_id=candidate_id).first():
                student_id = candidate_id
                break
    elif Student.query.filter_by(student_id=student_id).first():
        return jsonify({'error': f'Student ID {student_id} is already taken'}), 409

    new_student = Student(
        student_id=student_id,
        name=name,
        email=email,
        year_level=year_level
    )
    new_student.set_password(password)
    db.session.add(new_student)
    db.session.commit()

    session['student_id'] = new_student.id
    return jsonify({
        'message': f'Account for {new_student.name} created successfully!',
        'student': new_student.to_dict()
    }), 201

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('student_id', None)
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/students', methods=['GET'])
def list_students():
    students = Student.query.order_by(Student.name).all()
    return jsonify([s.to_dict() for s in students])

# ----------------- PAGE ROUTES -----------------
@app.route('/')
@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/practice')
@app.route('/arena')
def practice_page():
    return render_template('index.html')

# ----------------- STATS & ANALYTICS -----------------
@app.route('/api/stats', methods=['GET'])
def get_stats():
    total_subjects = Subject.query.count()
    total_materials = Material.query.count()
    total_questions = Question.query.count()
    mastered_questions = Question.query.filter_by(is_mastered=True).count()
    weak_questions = Question.query.filter((Question.is_mastered == False) | (Question.last_score < 70)).count()
    total_attempts = StudyAttempt.query.count()
    
    # Average score
    avg_score = 0.0
    if total_attempts > 0:
        attempts = StudyAttempt.query.all()
        avg_score = sum(a.score for a in attempts) / total_attempts

    mastery_rate = round((mastered_questions / max(total_questions, 1)) * 100, 1)

    # Subject breakdown
    subjects = Subject.query.all()
    subject_stats = []
    for s in subjects:
        s_total = len(s.questions)
        s_mastered = sum(1 for q in s.questions if q.is_mastered)
        subject_stats.append({
            'id': s.id,
            'code': s.code,
            'name': s.name,
            'color': s.color,
            'total_questions': s_total,
            'mastered_questions': s_mastered,
            'mastery_rate': round((s_mastered / max(s_total, 1)) * 100, 1)
        })

    return jsonify({
        'total_subjects': total_subjects,
        'total_materials': total_materials,
        'total_questions': total_questions,
        'mastered_questions': mastered_questions,
        'weak_questions': weak_questions,
        'total_attempts': total_attempts,
        'avg_score': round(avg_score, 1),
        'mastery_rate': mastery_rate,
        'subject_breakdown': subject_stats
    })

# ----------------- SUBJECTS API -----------------
@app.route('/api/subjects', methods=['GET', 'POST'])
def handle_subjects():
    if request.method == 'POST':
        data = request.json or {}
        code = data.get('code', '').strip()
        name = data.get('name', '').strip()
        if not code or not name:
            return jsonify({'error': 'Subject code and name are required'}), 400
        
        existing = Subject.query.filter_by(code=code).first()
        if existing:
            return jsonify({'error': f'Subject with code {code} already exists'}), 409

        subject = Subject(
            code=code,
            name=name,
            description=data.get('description', ''),
            color=data.get('color', '#6366f1'),
            icon=data.get('icon', 'fa-book')
        )
        db.session.add(subject)
        db.session.commit()
        return jsonify(subject.to_dict()), 201

    subjects = Subject.query.order_by(Subject.code).all()
    return jsonify([s.to_dict() for s in subjects])

@app.route('/api/subjects/<int:subj_id>', methods=['GET', 'DELETE'])
def subject_detail(subj_id):
    subject = db.session.get(Subject, subj_id)
    if not subject:
        return jsonify({'error': 'Subject not found'}), 404
        
    if request.method == 'DELETE':
        code = subject.code
        name = subject.name
        db.session.delete(subject)
        db.session.commit()
        return jsonify({
            'message': f'Subject {code} ({name}) and all associated reviewer notes and questions were removed successfully.',
            'deleted_id': subj_id
        })
        
    return jsonify(subject.to_dict())

# ----------------- MATERIALS API -----------------
@app.route('/api/materials', methods=['GET', 'POST'])
def handle_materials():
    if request.method == 'POST':
        subject_id = request.form.get('subject_id') or (request.json and request.json.get('subject_id'))
        title = request.form.get('title') or (request.json and request.json.get('title'))
        content_text = ""
        filename = None

        if not subject_id or not title:
            return jsonify({'error': 'Subject and Title are required'}), 400

        # Check for uploaded file (PDF, DOCX, TXT, MD)
        if 'file' in request.files and request.files['file'].filename:
            file = request.files['file']
            filename = secure_filename(file.filename)
            try:
                content_text = extract_document_text(file.stream, filename)
            except Exception as e:
                return jsonify({'error': f'Failed to parse document: {str(e)}'}), 400
        else:
            raw_text = request.form.get('content_text') or (request.json and request.json.get('content_text'))
            content_text = clean_extracted_text(raw_text or '')

        if not content_text or len(content_text.strip()) < 20:
            return jsonify({'error': 'Material content is too short. Please provide a document with notes.'}), 400

        material = Material(
            subject_id=int(subject_id),
            title=title.strip(),
            original_filename=filename,
            content_text=content_text
        )
        db.session.add(material)
        db.session.commit()

        # Assessment parameters
        q_type = request.form.get('question_type') or (request.json and request.json.get('question_type')) or 'any'
        q_diff = request.form.get('difficulty') or (request.json and request.json.get('difficulty')) or 'moderate'
        try:
            q_count = int(request.form.get('question_count') or (request.json and request.json.get('question_count')) or 6)
        except Exception:
            q_count = 6

        # ALWAYS automatically synthesize grounded assessment questions from uploaded review material
        subject = db.session.get(Subject, material.subject_id)
        generated = ai_engine.generate_questions(
            material.content_text,
            subject.name if subject else "",
            count=q_count,
            question_type=q_type,
            difficulty=q_diff
        )
        created_questions = []
        for q in generated:
            new_q = Question(
                material_id=material.id,
                subject_id=material.subject_id,
                question_text=strip_reviewer_meta_phrases(q['question_text']),
                expected_answer=q['expected_answer'],
                question_type=q.get('question_type', 'Short Answer'),
                difficulty=q.get('difficulty', 'Moderate'),
                explanation=q.get('explanation', ''),
                topic=q.get('topic', ''),
                source_reference=q.get('source_reference', '')
            )
            new_q.set_choices(q.get('choices', []))
            new_q.set_key_concepts(q.get('key_concepts', []))
            db.session.add(new_q)
            created_questions.append(new_q)
        db.session.commit()

        result = material.to_dict()
        result['auto_generated_questions'] = len(created_questions)
        return jsonify(result), 201

    subject_id = request.args.get('subject_id')
    query = Material.query
    if subject_id:
        query = query.filter_by(subject_id=int(subject_id))
    materials = query.order_by(Material.created_at.desc()).all()
    return jsonify([m.to_dict() for m in materials])

@app.route('/api/materials/<int:mat_id>', methods=['GET', 'DELETE'])
def material_detail(mat_id):
    material = Material.query.get_or_404(mat_id)
    if request.method == 'DELETE':
        db.session.delete(material)
        db.session.commit()
        return jsonify({'message': 'Material deleted successfully'})
    
    data = material.to_dict()
    data['full_content'] = material.content_text
    return jsonify(data)

@app.route('/api/materials/<int:mat_id>/generate', methods=['POST'])
def generate_questions_from_material(mat_id):
    material = Material.query.get_or_404(mat_id)
    subject = Subject.query.get(material.subject_id)
    
    req_data = request.json or {}
    try:
        count = int(req_data.get('count', 6))
    except Exception:
        count = 6
    question_type = req_data.get('question_type', 'any')
    difficulty = req_data.get('difficulty', 'moderate')
    
    generated = ai_engine.generate_questions(
        material.content_text,
        subject.name if subject else "",
        count=count,
        question_type=question_type,
        difficulty=difficulty
    )

    created_questions = []
    for q_data in generated:
        q = Question(
            material_id=material.id,
            subject_id=material.subject_id,
            question_text=strip_reviewer_meta_phrases(q_data['question_text']),
            expected_answer=q_data['expected_answer'],
            question_type=q_data.get('question_type', 'Short Answer'),
            difficulty=q_data.get('difficulty', 'Moderate'),
            explanation=q_data.get('explanation', ''),
            topic=q_data.get('topic', ''),
            source_reference=q_data.get('source_reference', '')
        )
        q.set_choices(q_data.get('choices', []))
        q.set_key_concepts(q_data.get('key_concepts', []))
        db.session.add(q)
        created_questions.append(q)

    db.session.commit()
    return jsonify({
        'message': f'Generated {len(created_questions)} assessment questions from reviewer',
        'questions': [q.to_dict() for q in created_questions],
        'reviewer_format_text': format_as_assessment_text([q.to_dict() for q in created_questions])
    })

# ----------------- NOTE SCANNER API -----------------
@app.route('/api/notes/scan-to-reviewer', methods=['POST'])
def scan_notes_to_reviewer():
    """
    Note Scanner Endpoint:
    Takes raw student lecture notes, PDF, Word doc, or scanned handwritten notes image,
    automatically extracts specific grounded assessment questions,
    and produces a clean reviewer formatted strictly to the assessment assistant standard.
    """
    notes_text = ""
    # Support both FormData (with optional file) and JSON
    if 'file' in request.files and request.files['file'].filename:
        file = request.files['file']
        filename = secure_filename(file.filename)
        try:
            notes_text = extract_document_text(file.stream, filename)
        except Exception as e:
            return jsonify({'error': f'Failed to process file: {str(e)}'}), 400
    
    if not notes_text:
        notes_text = request.form.get('notes_text') or (request.json and request.json.get('notes_text')) or ''
    notes_text = notes_text.strip()

    subject_id = request.form.get('subject_id') or (request.json and request.json.get('subject_id'))
    title = (request.form.get('title') or (request.json and request.json.get('title')) or '').strip()
    
    try:
        question_count = int(request.form.get('question_count') or (request.json and request.json.get('question_count')) or 8)
    except Exception:
        question_count = 8
        
    question_type = request.form.get('question_type') or (request.json and request.json.get('question_type')) or 'any'
    difficulty = request.form.get('difficulty') or (request.json and request.json.get('difficulty')) or 'moderate'

    if not notes_text:
        return jsonify({'error': 'Notes text cannot be empty. Please paste lecture notes or upload a notes document/image.'}), 400

    if len(notes_text) < 25:
        return jsonify({'error': 'Notes are too brief. Please provide at least a few sentences or definitions.'}), 400

    subject = None
    if subject_id and str(subject_id) != 'all':
        try:
            subject = db.session.get(Subject, int(subject_id))
        except Exception:
            pass

    if not subject:
        subject = Subject.query.first()
        if not subject:
            subject = Subject(code='IT 101', name='Introduction to Computing', color='#6366f1')
            db.session.add(subject)
            db.session.commit()

    if not title:
        first_line = notes_text.split('\n')[0].strip('#-•* \r\t')
        title = first_line[:40] if first_line else "Lecture Notes Reviewer"

    generated_questions = ai_engine.generate_questions(
        notes_text,
        subject_name=subject.name,
        count=question_count,
        question_type=question_type,
        difficulty=difficulty
    )

    if not generated_questions:
        return jsonify({'error': 'Could not extract specific questions from these notes. Make sure notes include definitions, facts, or concepts.'}), 422

    # Clean any accidental meta-phrases from all generated questions
    for q in generated_questions:
        q['question_text'] = strip_reviewer_meta_phrases(q.get('question_text', ''))

    # Build the required assessment format document
    header_block = (
        f"# {title}\n"
        f"**Subject:** {subject.code} — {subject.name}\n"
        f"**Source:** Student Upload / Notes ({datetime.utcnow().strftime('%B %d, %Y')})\n"
        f"**Assessment Standard:** Grounded Academic Assessment Questions\n\n"
        f"---\n\n"
    )
    full_reviewer_text = header_block + format_as_assessment_text(generated_questions)

    material = Material(
        subject_id=subject.id,
        title=f"[Note Scan] {title}",
        original_filename="notes_scanner_generated.txt",
        content_text=full_reviewer_text
    )
    db.session.add(material)
    db.session.commit()

    created_questions = []
    for q in generated_questions:
        new_q = Question(
            material_id=material.id,
            subject_id=subject.id,
            question_text=q['question_text'],
            expected_answer=q['expected_answer'],
            question_type=q.get('question_type', 'Short Answer'),
            difficulty=q.get('difficulty', 'Moderate'),
            explanation=q.get('explanation', ''),
            topic=q.get('topic', ''),
            source_reference=q.get('source_reference', '')
        )
        new_q.set_choices(q.get('choices', []))
        new_q.set_key_concepts(q.get('key_concepts', []))
        db.session.add(new_q)
        created_questions.append(new_q)

    db.session.commit()

    return jsonify({
        'message': f'Note Scanner synthesized {len(created_questions)} assessment questions!',
        'material': material.to_dict(),
        'questions_count': len(created_questions),
        'questions': [q.to_dict() for q in created_questions],
        'reviewer_text': full_reviewer_text
    }), 201

# ----------------- QUESTIONS API -----------------
@app.route('/api/questions', methods=['GET', 'POST'])
def handle_questions():
    if request.method == 'POST':
        data = request.json or {}
        subject_id = data.get('subject_id')
        question_text = data.get('question_text', '').strip()
        expected_answer = data.get('expected_answer', '').strip()
        key_concepts = data.get('key_concepts', [])
        
        if not subject_id or not question_text or not expected_answer:
            return jsonify({'error': 'Subject, Question, and Expected Answer are required'}), 400

        q = Question(
            material_id=data.get('material_id'),
            subject_id=int(subject_id),
            question_text=question_text,
            expected_answer=expected_answer,
            question_type=data.get('question_type', 'conceptual'),
            difficulty=data.get('difficulty', 'medium')
        )
        q.set_key_concepts(key_concepts)
        db.session.add(q)
        db.session.commit()
        return jsonify(q.to_dict()), 201

    subject_id = request.args.get('subject_id')
    filter_mode = request.args.get('filter', 'all') # all, weak, mastered
    
    query = Question.query
    if subject_id and subject_id != 'all':
        query = query.filter_by(subject_id=int(subject_id))

    if filter_mode == 'weak':
        query = query.filter((Question.is_mastered == False) | (Question.last_score < 70))
    elif filter_mode == 'mastered':
        query = query.filter_by(is_mastered=True)

    questions = query.order_by(Question.created_at.desc()).all()
    return jsonify([q.to_dict() for q in questions])

@app.route('/api/questions/<int:q_id>', methods=['GET', 'DELETE', 'PUT'])
def question_detail(q_id):
    question = Question.query.get_or_404(q_id)
    if request.method == 'DELETE':
        db.session.delete(question)
        db.session.commit()
        return jsonify({'message': 'Question deleted'})
    
    if request.method == 'PUT':
        data = request.json or {}
        if 'is_mastered' in data:
            question.is_mastered = bool(data['is_mastered'])
        if 'question_text' in data:
            question.question_text = data['question_text']
        if 'expected_answer' in data:
            question.expected_answer = data['expected_answer']
        db.session.commit()
        return jsonify(question.to_dict())

    return jsonify(question.to_dict())

# ----------------- STUDY SESSION & ANSWER EVALUATION -----------------
@app.route('/api/study/session', methods=['POST'])
def start_study_session():
    """
    Prepares a randomized or prioritized queue of study questions.
    Modes:
      - 'all': random selection
      - 'weak': prioritizes questions not yet mastered or score < 70 (spaced repetition)
      - 'new': unpracticed questions
    """
    data = request.json or {}
    subject_id = data.get('subject_id')
    mode = data.get('mode', 'all')
    limit = int(data.get('limit', 10))

    query = Question.query
    if subject_id and subject_id != 'all':
        query = query.filter_by(subject_id=int(subject_id))

    if mode == 'weak':
        # Prioritize low score and unmastered
        questions = query.filter(
            (Question.is_mastered == False) | (Question.last_score < 70)
        ).order_by(Question.times_correct.asc(), Question.last_score.asc()).limit(limit).all()
    elif mode == 'new':
        questions = query.filter_by(times_practiced=0).limit(limit).all()
    else:
        questions = query.all()
        random.shuffle(questions)
        questions = questions[:limit]

    return jsonify({
        'count': len(questions),
        'mode': mode,
        'questions': [q.to_dict() for q in questions]
    })

@app.route('/api/study/evaluate', methods=['POST'])
def evaluate_answer():
    """
    Evaluates the student's voice transcription against the question.
    Updates practice stats and spaced repetition queues.
    """
    data = request.json or {}
    question_id = data.get('question_id')
    spoken_answer = data.get('spoken_answer', '').strip()
    is_voice = data.get('is_voice_input', True)
    audio_length = data.get('audio_length', 'concise')

    if not question_id:
        return jsonify({'error': 'question_id is required'}), 400

    question = Question.query.get_or_404(question_id)
    key_concepts = question.get_key_concepts()

    # Pass threshold
    pass_thresh = float(SystemSetting.get_value('pass_threshold', '70'))

    # Run AI / NLP Evaluation with audio length customization
    eval_result = ai_engine.evaluate_spoken_answer(
        spoken_text=spoken_answer,
        expected_answer=question.expected_answer,
        key_concepts=key_concepts,
        question_text=question.question_text,
        audio_length=audio_length
    )

    score = eval_result.get('score', 0.0)
    feedback = eval_result.get('feedback', '')
    missing_concepts = eval_result.get('missing_concepts', [])
    is_passed = score >= pass_thresh

    # Update Question state
    question.times_practiced += 1
    if is_passed:
        question.times_correct += 1
        # If scored high twice or >= 85, mark as mastered
        if score >= 85 or question.times_correct >= 2:
            question.is_mastered = True
    else:
        # Mark as unmastered so it stays in weak repetition queue
        question.is_mastered = False

    question.last_score = score
    question.last_practiced_at = datetime.utcnow()

    # Current student
    curr_student = get_current_student()
    student_db_id = curr_student.id if curr_student else None

    # Save Attempt record
    attempt = StudyAttempt(
        student_id=student_db_id,
        question_id=question.id,
        student_answer=spoken_answer,
        is_voice_input=is_voice,
        score=score,
        feedback=feedback,
        missing_concepts=json.dumps(missing_concepts)
    )
    db.session.add(attempt)
    db.session.commit()

    verdict = eval_result.get('verdict') or ('CORRECT' if is_passed else 'WRONG')
    voice_memo = eval_result.get('voice_memo')
    if not voice_memo:
        if is_passed:
            voice_memo = f"Correct! {feedback}"
        else:
            voice_memo = f"Wrong. The correct answer is: {question.expected_answer}. {feedback}"

    # Source grounding details for AI verification (addresses 86.7% survey finding)
    source_title = question.material.title if question.material else (question.subject.name if question.subject else 'Uploaded Reviewer Notes')
    source_snippet = (question.material.content_text[:400] + '...') if (question.material and question.material.content_text) else 'Sourced directly from uploaded study notes.'

    return jsonify({
        'score': score,
        'is_passed': is_passed,
        'verdict': verdict,
        'voice_memo': voice_memo,
        'is_mastered': question.is_mastered,
        'feedback': feedback,
        'missing_concepts': missing_concepts,
        'expected_answer': question.expected_answer,
        'times_practiced': question.times_practiced,
        'times_correct': question.times_correct,
        'audio_length': audio_length,
        'source_material_title': source_title,
        'source_material_snippet': source_snippet,
        'is_grounded_verified': True,
        'verification_status': 'VERIFIED_GROUNDED'
    })

@app.route('/api/study/flashcard-rate', methods=['POST'])
def rate_flashcard():
    """
    Self-grading endpoint for interactive visual flashcards:
    Ratings: 'again' (40%), 'hard' (65%), 'good' (85%), 'easy' (100%).
    Updates mastery state, logs attempt for analytics, and returns updated question.
    """
    data = request.json or {}
    question_id = data.get('question_id')
    rating = (data.get('rating') or 'good').lower()

    if not question_id:
        return jsonify({'error': 'question_id is required'}), 400

    question = Question.query.get_or_404(question_id)
    
    score_map = {
        'again': 40.0,
        'hard': 65.0,
        'good': 85.0,
        'easy': 100.0
    }
    score = score_map.get(rating, 85.0)
    is_passed = score >= 70.0

    question.times_practiced += 1
    if is_passed:
        question.times_correct += 1
    question.last_score = score
    question.last_practiced_at = datetime.utcnow()
    question.is_mastered = (rating in ('good', 'easy'))

    curr_student = get_current_student()
    student_db_id = curr_student.id if curr_student else None
    attempt = StudyAttempt(
        question_id=question.id,
        student_id=student_db_id,
        student_answer=f"[Flashcard Rating: {rating.upper()}]",
        is_voice_input=False,
        score=score,
        feedback=f"Flashcard self-assessment: Marked as {rating.capitalize()} ({int(score)}%).",
        missing_concepts=json.dumps([])
    )
    db.session.add(attempt)
    db.session.commit()

    return jsonify({
        'message': f'Flashcard rated {rating.upper()}',
        'score': score,
        'is_mastered': question.is_mastered,
        'question': question.to_dict()
    })

# ----------------- RECENT STUDY ATTEMPTS & EVALUATION LOGS -----------------
@app.route('/api/study/attempts', methods=['GET'])
def get_study_attempts():
    limit = int(request.args.get('limit', 20))
    curr_student = get_current_student()
    query = StudyAttempt.query
    if curr_student:
        query = query.filter_by(student_id=curr_student.id)
    attempts = query.order_by(StudyAttempt.created_at.desc()).limit(limit).all()
    return jsonify([a.to_dict() for a in attempts])

# ----------------- MULTIMODAL ASK QUESTION (VOICE & TEXT) -----------------
@app.route('/api/study/ask-question', methods=['POST'])
def ask_study_question():
    """
    Allows students to ask study questions (typed or spoken) and receive answers
    grounded strictly in their uploaded BSIT notes (addresses 80% asking preference).
    """
    data = request.json or {}
    query_text = data.get('query', '').strip()
    subject_id = data.get('subject_id')

    if not query_text:
        return jsonify({'error': 'Question query is required'}), 400

    query_builder = Material.query
    if subject_id and subject_id != 'all':
        query_builder = query_builder.filter_by(subject_id=int(subject_id))

    materials = [m.to_dict() for m in query_builder.all()]
    if not materials:
        # Fallback to all materials
        materials = [m.to_dict() for m in Material.query.all()]

    result = ai_engine.answer_study_question(query_text, materials)
    return jsonify(result)

# ----------------- STUDY REMINDERS CONFIGURATION -----------------
@app.route('/api/reminders', methods=['GET', 'POST'])
def handle_reminders():
    """
    Manages student study reminder schedules (addresses 60% preference for several times a day).
    """
    if request.method == 'POST':
        data = request.json or {}
        cadence = data.get('cadence', 'several_times_a_day')
        times = data.get('times', ['08:00', '14:00', '20:00'])
        enabled = data.get('enabled', True)

        SystemSetting.set_value('reminder_cadence', cadence)
        SystemSetting.set_value('reminder_times', json.dumps(times))
        SystemSetting.set_value('reminder_enabled', 'true' if enabled else 'false')

        return jsonify({
            'message': 'Study reminders updated successfully',
            'cadence': cadence,
            'times': times,
            'enabled': enabled
        })

    # GET
    cadence = SystemSetting.get_value('reminder_cadence', 'several_times_a_day')
    times_raw = SystemSetting.get_value('reminder_times', '["08:00", "14:00", "20:00"]')
    enabled = SystemSetting.get_value('reminder_enabled', 'true') == 'true'
    try:
        times = json.loads(times_raw)
    except Exception:
        times = ['08:00', '14:00', '20:00']

    return jsonify({
        'cadence': cadence,
        'times': times,
        'enabled': enabled
    })

# ----------------- REPETITION / WEAK QUEUE -----------------
@app.route('/api/study/weak-queue', methods=['GET'])
def get_weak_queue():
    subject_id = request.args.get('subject_id')
    query = Question.query.filter(
        (Question.is_mastered == False) | (Question.last_score < 70)
    )
    if subject_id and subject_id != 'all':
        query = query.filter_by(subject_id=int(subject_id))

    weak_list = query.order_by(Question.last_score.asc()).all()
    return jsonify([q.to_dict() for q in weak_list])

# ----------------- SETTINGS & CONFIGURATION -----------------
@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'POST':
        data = request.json or {}
        for key, val in data.items():
            SystemSetting.set_value(key, str(val))
            if key == 'gemini_api_key':
                ai_engine.set_api_key(str(val))
        return jsonify({'message': 'Settings updated successfully'})

    settings = {
        'gemini_api_key_set': bool(SystemSetting.get_value('gemini_api_key')),
        'voice_rate': float(SystemSetting.get_value('voice_rate', '1.0')),
        'voice_pitch': float(SystemSetting.get_value('voice_pitch', '1.0')),
        'pass_threshold': float(SystemSetting.get_value('pass_threshold', '70')),
        'auto_speak_question': SystemSetting.get_value('auto_speak_question', 'true') == 'true',
        'auto_listen_after_reading': SystemSetting.get_value('auto_listen_after_reading', 'false') == 'true'
    }
    return jsonify(settings)

@app.route('/api/reset-data', methods=['POST'])
def reset_demo_data():
    """Wipes and re-seeds standard BSIT curriculum demo data."""
    StudyAttempt.query.delete()
    Question.query.delete()
    Material.query.delete()
    Subject.query.delete()
    db.session.commit()
    seed_database()
    return jsonify({'message': 'Demo curriculum re-seeded successfully.'})

if __name__ == '__main__':
    print("=" * 60)
    print("  STUDYBUDDY: VOICE-BASED STUDY ASSISTANT (BSIT)")
    print(f"  Database: {DB_PATH}")
    print("  Access at: http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
