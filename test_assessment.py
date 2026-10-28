"""
Test Assessment Question Generation, Note Scanner, and Grounding Fields
"""
import sys
from app import app, db
from models import Subject, Material, Question

def test_assessment_features():
    client = app.test_client()

    print("--- 1. Testing /api/notes/scan-to-reviewer with Text Mode ---")
    payload = {
        'title': 'Test Operating Systems Concepts',
        'notes_text': '''
An Operating System (OS) is system software that manages computer hardware, software resources, and provides common services for computer programs.
Key components include:
1. Kernel: The core that has complete control over everything in the system.
2. Device Drivers: Programs that control a particular type of device attached to the computer.
3. User Interface: CLI or GUI enabling user interaction with the system.
Process Scheduling algorithms include First-Come First-Served (FCFS), Shortest Job Next (SJN), and Round Robin (RR).
A Deadlock occurs when two or more processes are unable to proceed because each is waiting for the other to release a resource. Four conditions for deadlock: Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait.
        ''',
        'question_type': 'multiple_choice',
        'difficulty': 'moderate',
        'question_count': 4
    }

    res = client.post('/api/notes/scan-to-reviewer', json=payload)
    print(f"Status Code: {res.status_code}")
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.get_json()}"
    data = res.get_json()
    print(f"Synthesized: {data.get('questions_count')} questions")
    assert data.get('questions_count') > 0, "No questions synthesized"
    assert 'reviewer_text' in data, "No reviewer_text in response"
    
    questions = data.get('questions', [])
    for idx, q in enumerate(questions, 1):
        print(f"\nQuestion #{idx}:")
        print(f"  Type: {q.get('question_type')} | Difficulty: {q.get('difficulty')}")
        print(f"  Topic: {q.get('topic')}")
        print(f"  Text: {q.get('question_text')}")
        print(f"  Expected Answer: {q.get('expected_answer')}")
        print(f"  Explanation: {q.get('explanation')}")
        print(f"  Source: {q.get('source_reference')}")
        print(f"  Choices: {q.get('choices')}")

        # Meta phrase checks
        text_lower = q.get('question_text', '').lower()
        assert "according to the reviewer" not in text_lower, "Found forbidden phrase 'according to the reviewer'"
        assert "based on the uploaded" not in text_lower, "Found forbidden phrase 'based on the uploaded'"
        assert "in the provided notes" not in text_lower, "Found forbidden phrase 'in the provided notes'"

    print("\n--- 2. Testing /api/questions with serialized assessment fields ---")
    res = client.get('/api/questions')
    assert res.status_code == 200
    q_list = res.get_json()
    assert len(q_list) > 0
    sample = q_list[0]
    print("Sample question from bank:")
    print(f"  Keys present: {[k for k in ['choices', 'explanation', 'topic', 'source_reference', 'difficulty', 'question_type'] if k in sample]}")
    assert 'choices' in sample
    assert 'explanation' in sample
    assert 'topic' in sample
    assert 'source_reference' in sample

    print("\n[SUCCESS] ALL ASSESSMENT QUESTION GENERATION TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    with app.app_context():
        test_assessment_features()
