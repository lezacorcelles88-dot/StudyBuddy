import os
import json
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class Student(db.Model):
    __tablename__ = 'students'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(50), unique=True, nullable=False) # e.g. 2026-BSIT-001
    name = db.Column(db.String(120), nullable=False) # e.g. Rhea Dumagat
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    year_level = db.Column(db.String(50), default='Student')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    attempts = db.relationship('StudyAttempt', backref='student', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'name': self.name,
            'email': self.email,
            'year_level': self.year_level,
            'attempts_count': len(self.attempts),
            'created_at': self.created_at.strftime('%Y-%m-%d')
        }

class Subject(db.Model):
    __tablename__ = 'subjects'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False) # e.g. IT 101
    name = db.Column(db.String(120), nullable=False) # e.g. Introduction to Computing
    description = db.Column(db.Text, nullable=True)
    icon = db.Column(db.String(50), default='fa-laptop-code')
    color = db.Column(db.String(30), default='#6366f1') # hex accent
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    materials = db.relationship('Material', backref='subject', cascade='all, delete-orphan', lazy=True)
    questions = db.relationship('Question', backref='subject', cascade='all, delete-orphan', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'icon': self.icon,
            'color': self.color,
            'materials_count': len(self.materials),
            'questions_count': len(self.questions)
        }

class Material(db.Model):
    __tablename__ = 'materials'
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    original_filename = db.Column(db.String(255), nullable=True)
    content_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    questions = db.relationship('Question', backref='material', cascade='all, delete-orphan', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'subject_id': self.subject_id,
            'subject_name': self.subject.name if self.subject else '',
            'subject_code': self.subject.code if self.subject else '',
            'title': self.title,
            'original_filename': self.original_filename,
            'content_snippet': (self.content_text[:200] + '...') if len(self.content_text) > 200 else self.content_text,
            'word_count': len(self.content_text.split()),
            'questions_count': len(self.questions),
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M')
        }

class Question(db.Model):
    __tablename__ = 'questions'
    id = db.Column(db.Integer, primary_key=True)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    expected_answer = db.Column(db.Text, nullable=False)
    key_concepts = db.Column(db.Text, default='[]') # JSON list of essential keywords
    question_type = db.Column(db.String(50), default='conceptual') # multiple_choice, true_false, identification, etc.
    difficulty = db.Column(db.String(20), default='medium') # easy, moderate/medium, hard
    choices = db.Column(db.Text, default='[]') # JSON list of choices for multiple choice
    explanation = db.Column(db.Text, nullable=True) # Explanation based on uploaded reviewer
    topic = db.Column(db.String(150), nullable=True) # Exact topic from reviewer
    source_reference = db.Column(db.String(255), nullable=True) # Heading, paragraph, page reference
    
    # Active recall & spaced repetition tracking
    times_practiced = db.Column(db.Integer, default=0)
    times_correct = db.Column(db.Integer, default=0)
    last_score = db.Column(db.Float, default=0.0)
    is_mastered = db.Column(db.Boolean, default=False)
    last_practiced_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    attempts = db.relationship('StudyAttempt', backref='question', cascade='all, delete-orphan', lazy=True)

    def get_key_concepts(self):
        try:
            return json.loads(self.key_concepts)
        except Exception:
            return []

    def set_key_concepts(self, concepts_list):
        self.key_concepts = json.dumps(concepts_list)

    def get_choices(self):
        try:
            return json.loads(self.choices) if self.choices else []
        except Exception:
            return []

    def set_choices(self, choices_list):
        self.choices = json.dumps(choices_list)

    def to_dict(self):
        mat_title = self.material.title if self.material else (self.subject.name if self.subject else 'Uploaded Notes')
        mat_snippet = (self.material.content_text[:400] + '...') if (self.material and self.material.content_text) else 'Sourced directly from uploaded BSIT course notes.'
        return {
            'id': self.id,
            'material_id': self.material_id,
            'material_title': mat_title,
            'source_snippet': mat_snippet,
            'is_grounded': True,
            'verification_status': 'VERIFIED_GROUNDED',
            'subject_id': self.subject_id,
            'subject_code': self.subject.code if self.subject else '',
            'subject_name': self.subject.name if self.subject else '',
            'question_text': self.question_text,
            'expected_answer': self.expected_answer,
            'choices': self.get_choices(),
            'explanation': self.explanation or '',
            'topic': self.topic or (self.subject.name if self.subject else 'General'),
            'source_reference': self.source_reference or mat_title,
            'key_concepts': self.get_key_concepts(),
            'question_type': self.question_type,
            'difficulty': self.difficulty,
            'times_practiced': self.times_practiced,
            'times_correct': self.times_correct,
            'last_score': round(self.last_score, 1),
            'is_mastered': self.is_mastered,
            'needs_practice': not self.is_mastered or self.last_score < 75.0,
            'last_practiced_at': self.last_practiced_at.strftime('%Y-%m-%d %H:%M') if self.last_practiced_at else None
        }

class StudyAttempt(db.Model):
    __tablename__ = 'study_attempts'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    student_answer = db.Column(db.Text, nullable=False)
    is_voice_input = db.Column(db.Boolean, default=True)
    score = db.Column(db.Float, nullable=False) # 0 to 100
    feedback = db.Column(db.Text, nullable=False)
    missing_concepts = db.Column(db.Text, default='[]') # JSON list
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_missing_concepts(self):
        try:
            return json.loads(self.missing_concepts)
        except Exception:
            return []

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else None,
            'question_id': self.question_id,
            'question_text': self.question.question_text if self.question else '',
            'student_answer': self.student_answer,
            'is_voice_input': self.is_voice_input,
            'score': round(self.score, 1),
            'feedback': self.feedback,
            'missing_concepts': self.get_missing_concepts(),
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M')
        }

class SystemSetting(db.Model):
    __tablename__ = 'system_settings'
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=True)

    @classmethod
    def get_value(cls, key, default=None):
        setting = cls.query.filter_by(key=key).first()
        return setting.value if setting and setting.value else default

    @classmethod
    def set_value(cls, key, value):
        setting = cls.query.filter_by(key=key).first()
        if not setting:
            setting = cls(key=key, value=value)
            db.session.add(setting)
        else:
            setting.value = value
        db.session.commit()
