import json
import sys

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app import app, db
from models import Question, Material

with app.app_context():
    client = app.test_client()

    print("--- 1. Testing Page Routes ---")
    resp = client.get('/')
    assert resp.status_code == 200, f"Expected 200 for /, got {resp.status_code}"
    resp = client.get('/dashboard')
    assert resp.status_code == 200, f"Expected 200 for /dashboard, got {resp.status_code}"
    resp = client.get('/practice')
    assert resp.status_code == 200, f"Expected 200 for /practice, got {resp.status_code}"
    resp = client.get('/arena')
    assert resp.status_code == 200, f"Expected 200 for /arena, got {resp.status_code}"
    print("✓ All 4 page routes returned 200 OK")

    print("\n--- 2. Testing AI Evaluation with Audio Length & Source Verification ---")
    q = Question.query.first()
    assert q is not None, "At least one question should exist in database"
    
    # Test concise (1-3 min) evaluation
    eval_payload = {
        'question_id': q.id,
        'spoken_answer': q.expected_answer,
        'is_voice_input': True,
        'audio_length': 'concise'
    }
    resp = client.post('/api/study/evaluate', json=eval_payload)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = json.loads(resp.data)
    
    assert 'is_grounded_verified' in data and data['is_grounded_verified'] is True
    assert 'source_material_title' in data
    assert 'source_material_snippet' in data
    assert data['audio_length'] == 'concise'
    assert data['verdict'] == 'CORRECT'
    print(f"✓ Evaluated question #{q.id}")
    print(f"  Score: {data['score']}% ({data['verdict']})")
    print(f"  Audio Length Mode: {data['audio_length']}")
    print(f"  Source Title: {data['source_material_title']}")
    print(f"  Voice Memo: {data['voice_memo'][:80]}...")

    print("\n--- 3. Testing Multimodal Ask Question Endpoint ---")
    ask_payload = {
        'query': 'What is CPU and what does it do?',
        'subject_id': 'all'
    }
    resp = client.post('/api/study/ask-question', json=ask_payload)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    ask_data = json.loads(resp.data)
    assert 'answer' in ask_data
    assert 'source_title' in ask_data
    assert 'voice_memo' in ask_data
    print(f"✓ Ask Question Query: '{ask_payload['query']}'")
    print(f"  Answer: {ask_data['answer'][:90]}...")
    print(f"  Sourced from: {ask_data['source_title']}")

    print("\n--- 4. Testing Study Reminders Endpoint ---")
    # GET reminders
    resp = client.get('/api/reminders')
    assert resp.status_code == 200
    reminders = json.loads(resp.data)
    print(f"✓ Retrieved current reminders: cadence={reminders.get('cadence')}, times={reminders.get('times')}")

    # POST update reminders (Several times a day - 60% survey preference)
    post_payload = {
        'cadence': 'several_times_a_day',
        'times': ['08:00', '14:00', '20:00'],
        'enabled': True
    }
    resp = client.post('/api/reminders', json=post_payload)
    assert resp.status_code == 200
    updated = json.loads(resp.data)
    assert updated['cadence'] == 'several_times_a_day'
    print(f"✓ Saved reminder cadence: '{updated['cadence']}' with times {updated['times']}")

    print("\n--- 5. Testing Question to_dict Grounding Fields ---")
    q_dict = q.to_dict()
    assert 'material_title' in q_dict
    assert 'source_snippet' in q_dict
    assert 'is_grounded' in q_dict and q_dict['is_grounded'] is True
    assert 'verification_status' in q_dict
    print(f"✓ Question #{q.id} grounding metadata verified:")
    print(f"  Grounded: {q_dict['is_grounded']}")
    print(f"  Verification Status: {q_dict['verification_status']}")
    print(f"  Material: {q_dict['material_title']}")

    print("\n🎉 ALL SURVEY-ALIGNED FEATURES PASSED BACKEND VERIFICATION!")
