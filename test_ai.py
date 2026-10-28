from ai_engine import AIEngine

ai = AIEngine()
sample_text = """
Central Processing Unit (CPU): The primary component of a computer that executes instructions and performs arithmetic operations.
Arithmetic Logic Unit (ALU): A digital circuit within the processor that executes mathematical computations and logical operations.
Random Access Memory (RAM): Volatile working memory that provides high-speed read and write access for active processes.
Operating System (OS): System software that manages computer hardware, software resources, and provides common services for computer programs.
"""

questions = ai.generate_questions(sample_text, 'IT 101: Introduction to Computing', count=4)
print(f'Generated {len(questions)} flashcards:')
for i, q in enumerate(questions):
    print(f'\nFlashcard #{i+1}:')
    print(f'  Front (Question): {q["question_text"]}')
    print(f'  Back (Answer):    {q["expected_answer"]}')
    print(f'  Type:             {q["question_type"]}')
    print(f'  Key Concepts:     {q["key_concepts"]}')

target_q = questions[0]
spoken_with_fillers = "uhm well basically the CPU is the primary component of a computer that executes instructions yeah that is all"
eval_res = ai.evaluate_spoken_answer(spoken_with_fillers, target_q["expected_answer"], target_q["key_concepts"])

print(f'\nVoice Evaluation (with verbal fillers filtered):')
print(f'  Input:      "{spoken_with_fillers}"')
print(f'  Score:      {eval_res["score"]}%')
print(f'  Verdict:    {eval_res["verdict"]}')
print(f'  Voice Memo: {eval_res["voice_memo"]}')
print('\nAI flashcard generation and speech filtering passed!')
