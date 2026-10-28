import json
from app import app

client = app.test_client()

# Test subjects list
r = client.get('/api/subjects')
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
subjects = json.loads(r.data)
print(f'Subjects: {len(subjects)} found')
for s in subjects:
    print(f'  - {s["code"]}: {s["name"]} ({s["questions_count"]} questions)')

# Test questions
it101 = next((s for s in subjects if s["code"] == "IT 101"), subjects[0])
r = client.get(f'/api/questions?subject_id={it101["id"]}')
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
questions = json.loads(r.data)
print(f'\nQuestions for {it101["code"]}: {len(questions)} found')
if questions:
    print(f'  Sample Q: "{questions[0]["question_text"][:80]}"')
    print(f'  Sample A: "{questions[0]["expected_answer"][:80]}"')

# Test subject create and delete
test_data = {'code': 'TEST 999', 'name': 'Temporary Test Subject'}
res = client.post('/api/subjects', json=test_data)
assert res.status_code in (200, 201), f"Expected 200/201, got {res.status_code}"
created_subj = json.loads(res.data)
print(f'\nSuccessfully created subject: {created_subj["id"]} ({created_subj["code"]})')

del_res = client.delete(f'/api/subjects/{created_subj["id"]}')
assert del_res.status_code == 200, f"Expected 200, got {del_res.status_code}"
del_data = json.loads(del_res.data)
print(f'Successfully deleted subject: {del_data["message"]}')

# Test auth endpoint (unauthenticated)
r = client.get('/api/auth/current-user')
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
user = json.loads(r.data)
print(f'\nAuth (unauthenticated): logged_in={user.get("logged_in")}')

# Test login and verify current-user
login_res = client.post('/api/auth/demo-login')
assert login_res.status_code == 200, f"Expected 200, got {login_res.status_code}"
login_data = json.loads(login_res.data)
print(f'Login successful: {login_data["message"]}')

r = client.get('/api/auth/current-user')
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
user = json.loads(r.data)
student_info = user.get("student") or {}
print(f'Current student: {student_info.get("name")} ({student_info.get("student_id")})')

# Test stats breakdown
r = client.get('/api/stats')
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
stats = json.loads(r.data)
print(f'\nStats: {stats["total_questions"]} total questions, {len(stats["subject_breakdown"])} subjects in review schedule')

print('\nAll backend APIs and Subject Deletion working correctly!')
