import json
from models import db, Subject, Material, Question, SystemSetting, Student

def seed_database():
    """
    Seeds initial First-Year BSIT subjects, lecture reviewers, questions, and student account.
    """
    # Seed default student if not present
    if not Student.query.first():
        student = Student(
            student_id="2026-BSIT-001",
            name="Rhea Dumagat",
            email="rhea.dumagat@student.edu",
            year_level="1st Year BSIT"
        )
        student.set_password("student123")
        db.session.add(student)
        db.session.commit()
        print("[Seed] Created default student account: Rhea Dumagat (2026-BSIT-001)")

    if Subject.query.filter_by(code="IT 101").first() and Question.query.first():
        return # Core data already seeded

    print("[Seed] Initializing 1st-Year BSIT subjects, materials, and study questions...")

    # Default settings
    SystemSetting.set_value('app_name', 'StudyBuddy')
    SystemSetting.set_value('voice_rate', '1.0')
    SystemSetting.set_value('voice_pitch', '1.0')
    SystemSetting.set_value('pass_threshold', '70')
    SystemSetting.set_value('auto_speak_question', 'true')
    SystemSetting.set_value('auto_listen_after_reading', 'false')

    sub1 = Subject.query.filter_by(code="IT 101").first()
    sub2 = Subject.query.filter_by(code="IT 102").first()
    sub3 = Subject.query.filter_by(code="IT 103").first()

    if not sub1:
        sub1 = Subject(
            code="IT 101",
            name="Introduction to Computing",
            description="Foundations of computer hardware, software, CPU architecture, operating systems, and digital data representation.",
            icon="fa-microchip",
            color="#3b82f6"
        )
        db.session.add(sub1)

    if not sub2:
        sub2 = Subject(
            code="IT 102",
            name="Computer Programming 1",
            description="Introductory programming principles, control structures, loops, functions, variables, and algorithmic logic.",
            icon="fa-code",
            color="#10b981"
        )
        db.session.add(sub2)

    if not sub3:
        sub3 = Subject(
            code="IT 103",
            name="Discrete Structures",
            description="Mathematical foundations of computing, including propositional logic, truth tables, set theory, and Boolean algebra.",
            icon="fa-project-diagram",
            color="#8b5cf6"
        )
        db.session.add(sub3)

    db.session.commit()

    # Materials for Subject 1 (Intro to Computing)
    mat1_content = """
Introduction to Computing - Module 1 Reviewer

1. Central Processing Unit (CPU): The primary component of a computer that performs most processing tasks. It consists of the Arithmetic Logic Unit (ALU), which executes mathematical calculations and logical comparisons, and the Control Unit (CU), which directs the flow of instructions between memory and the ALU.

2. Von Neumann Architecture: A fundamental theoretical computer architecture that describes a system where both program data and program instructions are stored together in the same read-write memory (RAM).

3. Primary Memory vs Secondary Storage:
- Random Access Memory (RAM): Volatile working memory that temporarily holds active program instructions and data for rapid CPU access. Data is lost when powered off.
- Read-Only Memory (ROM): Non-volatile memory that permanently stores essential startup instructions like the BIOS/UEFI.
- Hard Drives and SSDs: Non-volatile secondary storage devices used for long-term data retention.

4. Operating System (OS): System software that manages computer hardware components, handles memory allocation, oversees process scheduling, and provides common services for application software.

5. Binary Number System: A base-2 numeral system utilizing only two digits, 0 and 1, representing electrical off and on states within digital transistor circuits.
"""
    mat1 = Material(
        subject_id=sub1.id,
        title="Module 1: Computer Hardware & Architecture Reviewer",
        original_filename="intro_computing_mod1.txt",
        content_text=mat1_content.strip()
    )

    # Materials for Subject 2 (Programming 1)
    mat2_content = """
Computer Programming 1 - Midterm Reviewer

1. Variables: Named storage locations in computer memory that hold data values during program execution. In dynamically-typed languages like Python, variables do not require explicit type declarations.

2. Control Flow Structures:
- Conditional Statements: If, elif, and else statements evaluate boolean conditions to execute specific code branches.
- Loops: For loops iterate over a predefined sequence, while While loops continue executing as long as a specified condition remains True.

3. Functions: Reusable blocks of organized code designed to perform a single related task. Functions accept parameters or arguments and optionally return output values using the return statement.

4. Types of Programming Errors:
- Syntax Errors: Occur when the code violates the grammatical grammar rules of the programming language, preventing interpretation or compilation.
- Runtime Errors: Occur during program execution, causing the program to terminate unexpectedly, such as dividing by zero or index out of range.
- Semantic or Logic Errors: Occur when the program runs without crashing but produces incorrect or unintended output due to a flaw in algorithm logic.
"""
    mat2 = Material(
        subject_id=sub2.id,
        title="Midterm Reviewer: Python Basics, Control Flow & Functions",
        original_filename="prog1_midterm_notes.txt",
        content_text=mat2_content.strip()
    )

    # Materials for Subject 3 (Discrete Structures)
    mat3_content = """
Discrete Structures for IT - Chapter 1 Notes

1. Propositional Logic: A branch of symbolic logic that deals with propositions or statements that are either strictly True or strictly False, but cannot be both.

2. Logical Connectives:
- Conjunction (AND, denoted by ∧): True only if both propositions are True.
- Disjunction (OR, denoted by ∨): True if at least one proposition is True.
- Negation (NOT, denoted by ¬): Inverts the truth value of a proposition.
- Conditional (Implication, denoted by →): False only when the antecedent is True and the consequent is False.

3. Truth Tables: A mathematical table utilized in logic to determine whether a compound proposition is valid for all possible truth values of its constituent variables.

4. Set Theory:
- Union of Sets (A ∪ B): The set of elements that belong to A, B, or both.
- Intersection of Sets (A ∩ B): The set of elements that belong to both A and B.
- Complement of a Set (A'): All elements in the universal set that do not belong to A.
"""
    mat3 = Material(
        subject_id=sub3.id,
        title="Chapter 1: Propositional Logic and Set Operations",
        original_filename="discrete_logic_ch1.txt",
        content_text=mat3_content.strip()
    )

    db.session.add_all([mat1, mat2, mat3])
    db.session.commit()

    # Pre-generate Questions for Subject 1
    q1 = Question(
        material_id=mat1.id,
        subject_id=sub1.id,
        question_text="What are the two main internal components of the CPU, and what does each component do?",
        expected_answer="The CPU consists of the Arithmetic Logic Unit (ALU), which performs mathematical and logical calculations, and the Control Unit (CU), which directs the flow of instructions between memory and the ALU.",
        key_concepts=json.dumps(["ALU", "Arithmetic Logic Unit", "Control Unit", "CU", "calculations", "instructions"]),
        question_type="conceptual",
        difficulty="medium"
    )
    q2 = Question(
        material_id=mat1.id,
        subject_id=sub1.id,
        question_text="What is the core difference between RAM and ROM in terms of volatility and purpose?",
        expected_answer="RAM is volatile temporary memory that holds active program data and loses its contents when powered off, while ROM is non-volatile permanent memory that stores startup instructions like BIOS.",
        key_concepts=json.dumps(["RAM", "ROM", "volatile", "non-volatile", "temporary", "permanent", "startup", "BIOS"]),
        question_type="conceptual",
        difficulty="easy"
    )
    q3 = Question(
        material_id=mat1.id,
        subject_id=sub1.id,
        question_text="Define the Von Neumann architecture according to your reviewer.",
        expected_answer="The Von Neumann architecture is a theoretical computer design where both program data and program instructions share the same read-write memory (RAM).",
        key_concepts=json.dumps(["Von Neumann", "architecture", "data", "instructions", "shared memory", "RAM"]),
        question_type="definition",
        difficulty="medium"
    )

    # Questions for Subject 2
    q4 = Question(
        material_id=mat2.id,
        subject_id=sub2.id,
        question_text="What is the difference between a syntax error and a logic error in programming?",
        expected_answer="A syntax error violates language grammar rules and prevents code from compiling or running, whereas a logic error allows the program to run without crashing but produces incorrect or unintended results.",
        key_concepts=json.dumps(["syntax error", "logic error", "grammar rules", "compile", "incorrect output", "algorithm"]),
        question_type="conceptual",
        difficulty="medium"
    )
    q5 = Question(
        material_id=mat2.id,
        subject_id=sub2.id,
        question_text="What is a function in computer programming and how does it return values?",
        expected_answer="A function is a reusable block of code designed to perform a specific task, which accepts parameters and outputs results using the return statement.",
        key_concepts=json.dumps(["function", "reusable", "parameters", "arguments", "return statement"]),
        question_type="definition",
        difficulty="easy"
    )

    # Questions for Subject 3
    q6 = Question(
        material_id=mat3.id,
        subject_id=sub3.id,
        question_text="What is a proposition in Discrete Mathematics?",
        expected_answer="A proposition is a declarative statement that is either strictly True or strictly False, but cannot be both at the same time.",
        key_concepts=json.dumps(["proposition", "declarative", "True", "False", "statement"]),
        question_type="definition",
        difficulty="easy"
    )
    q7 = Question(
        material_id=mat3.id,
        subject_id=sub3.id,
        question_text="Explain the difference between the union and the intersection of two sets.",
        expected_answer="The union of two sets contains all elements belonging to either set or both, while the intersection contains only elements that belong to both sets simultaneously.",
        key_concepts=json.dumps(["union", "intersection", "either", "both", "sets", "elements"]),
        question_type="conceptual",
        difficulty="medium"
    )

    db.session.add_all([q1, q2, q3, q4, q5, q6, q7])
    db.session.commit()
    print("[Seed] Successfully seeded initial BSIT data.")
