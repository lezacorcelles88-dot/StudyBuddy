import os
import re
import json
import requests
from difflib import SequenceMatcher

COMMON_STOPWORDS = {
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing',
    'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t',
    'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers',
    'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if',
    'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most',
    'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
    'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d',
    'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s',
    'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they',
    'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under',
    'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
    'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who',
    'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d',
    'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
}

CONVERSATIONAL_FILLERS = {
    'uhm', 'uh', 'um', 'err', 'ah', 'like', 'actually', 'basically', 'yeah', 'yep', 'nope',
    'well', 'okay', 'so', 'wait', 'hold', 'on', 'think', 'believe', 'guess', 'maybe',
    'know', 'mean', 'hear', 'hello', 'testing', 'test', 'microphone', 'mic'
}

def filter_conversational_speech(spoken_text):
    """
    Strips conversational fillers, hesitations, and extraneous speech that does not connect
    to the reviewer material so evaluation focuses strictly on relevant concepts.
    """
    if not spoken_text:
        return ""
    text = spoken_text.strip()

    # Strip common verbal preambles
    preamble_pattern = r'^(?:(?:uhm|uh|um|err|ah|well|okay|so|wait|hold on|let me think|i think|i believe|basically|actually|you know|what is it|what\'s it called)[,\s]+)+'
    text = re.sub(preamble_pattern, '', text, flags=re.IGNORECASE)

    # Strip common postambles
    postamble_pattern = r'[,\s]+(?:(?:that\'s it|i think|or something|yeah|that is all|i guess)[.?!,\s]*)+$'
    text = re.sub(postamble_pattern, '', text, flags=re.IGNORECASE)

    return text.strip()

def clean_tokens(text):
    words = re.findall(r'[a-zA-Z0-9_\-\+]+', text.lower())
    return [w for w in words if w not in COMMON_STOPWORDS and w not in CONVERSATIONAL_FILLERS and len(w) > 2]

def strip_reviewer_meta_phrases(q_text):
    """
    Strictly removes artificial meta-phrases referring to the reviewer or notes:
    - 'According to the reviewer...'
    - 'Based on the uploaded notes...'
    - 'As stated in the document...'
    - 'According to the provided material...'
    - 'What does the reviewer say about...?'
    Ensures questions sound like authentic examination questions written by an instructor.
    """
    if not q_text:
        return ""
    text = q_text.strip()
    # Strip leading Flashcard / Question prefixes
    text = re.sub(r'^(?:Flashcard|Question)\s*[:#\d]*\s*', '', text, flags=re.IGNORECASE)

    # Patterns to remove
    meta_patterns = [
        r'^(?:According to|Based on|As stated in|As described in|As defined in)\s+(?:the|your|this|the provided|the uploaded)?\s*(?:reviewer|notes|document|material|lecture|slides|text)[,\s:]*',
        r'\s*(?:according to|based on|as stated in|as described in|as defined in)\s+(?:the|your|this|the provided|the uploaded)?\s*(?:reviewer|notes|document|material|lecture|slides|text)[,\s]*',
        r'^(?:What does the (?:reviewer|notes|document|material) (?:say|state|mention) about)\s+',
        r'\s*in (?:the|your|this) (?:uploaded|provided)?\s*(?:notes|reviewer|document)[,\s]*'
    ]
    for pat in meta_patterns:
        text = re.sub(pat, ' ', text, flags=re.IGNORECASE)

    text = re.sub(r'\s+', ' ', text).strip()
    if text:
        text = text[0].upper() + text[1:]
    return text

def format_as_assessment_text(questions):
    """
    Formats generated questions into the Required Output Format specified by the assessment assistant prompt:
    **Question [number]:** [Specific question]
    **Question Type:** [Selected type]
    **Difficulty:** [Easy, Moderate, or Hard]
    **Topic:** [Exact topic from the uploaded reviewer]
    **Choices:** [For multiple-choice questions only]
    **Correct Answer:** [Answer]
    **Explanation:** [Why the answer is correct, based on the uploaded material]
    **Source Reference:** [Page, heading, paragraph, or extracted text reference]
    """
    lines = []
    for idx, q in enumerate(questions, 1):
        q_type = q.get('question_type', 'Short Answer')
        diff = q.get('difficulty', 'Moderate').capitalize()
        topic = q.get('topic', 'General Concept')
        q_text = strip_reviewer_meta_phrases(q.get('question_text', ''))
        ans = q.get('expected_answer', '')
        explanation = q.get('explanation') or f"Defined in the uploaded reviewer under topic '{topic}'."
        source_ref = q.get('source_reference') or f"Section: {topic}"

        lines.append(f"**Question {idx}:** {q_text}\n")
        lines.append(f"**Question Type:** {q_type}\n")
        lines.append(f"**Difficulty:** {diff}\n")
        lines.append(f"**Topic:** {topic}\n")

        choices = q.get('choices') or []
        if choices and ('multiple' in q_type.lower() or len(choices) >= 2):
            lines.append("**Choices:**\n")
            for c in choices:
                lines.append(f"{c}  ")
            lines.append("")

        lines.append(f"**Correct Answer:** {ans}\n")
        lines.append(f"**Explanation:** {explanation}\n")
        lines.append(f"**Source Reference:** {source_ref}\n")
        lines.append("---")
        lines.append("")

    return "\n".join(lines).strip()

class AIEngine:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.environ.get('GEMINI_API_KEY')

    def set_api_key(self, key):
        self.api_key = key.strip() if key else None

    def generate_questions(self, text_content, subject_name="", count=6, question_type="any", difficulty="moderate"):
        """
        Synthesizes assessment questions strictly grounded in the uploaded review material.
        Implements authentic examination formulation without meta-references to the reviewer.
        """
        if not text_content or len(text_content.strip()) < 20:
            return []

        if self.api_key:
            try:
                ai_results = self._generate_with_gemini(text_content, subject_name, count, question_type, difficulty)
                if ai_results and len(ai_results) > 0:
                    for q in ai_results:
                        q['question_text'] = strip_reviewer_meta_phrases(q.get('question_text', ''))
                    return ai_results
            except Exception as e:
                print(f"[AIEngine] Gemini API question generation error, falling back to local extractor: {e}")

        # Built-in robust NLP extraction grounded in text
        results = self._generate_with_local_rules(text_content, count, question_type, difficulty)
        for q in results:
            q['question_text'] = strip_reviewer_meta_phrases(q.get('question_text', ''))
        return results

    def _generate_with_gemini(self, text_content, subject_name, count, question_type="any", difficulty="moderate"):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        
        type_req = {
            "multiple_choice": "Generate strictly 'Multiple Choice' questions. Include 4 distinct choices (A, B, C, D) with 3 plausible distractors and 1 correct option.",
            "true_false": "Generate strictly 'True or False' questions based on definitive facts in the material.",
            "identification": "Generate strictly 'Identification' questions where the student must identify the specific concept or term.",
            "fill_in_the_blanks": "Generate strictly 'Fill in the Blanks' questions testing key terms.",
            "short_answer": "Generate strictly 'Short Answer' conceptual questions.",
            "enumeration": "Generate strictly 'Enumeration' questions listing components, steps, or rules.",
            "application": "Generate strictly 'Application-Based Questions' applying concepts to practical IT scenarios.",
            "any": "Generate a diverse and balanced mixture of question types (Multiple Choice, Identification, True or False, Short Answer, Fill in the Blanks)."
        }.get(question_type.lower().replace(' ', '_'), "Generate a diverse mixture of question types.")

        diff_req = {
            "easy": "Easy (Recall definitions, terms, and basic facts directly stated in the reviewer).",
            "moderate": "Moderate (Explain concepts, compare ideas, or describe operational processes).",
            "medium": "Moderate (Explain concepts, compare ideas, or describe operational processes).",
            "hard": "Hard (Analyze relationships, solve problems, or apply concepts to technical situations)."
        }.get(difficulty.lower(), "Moderate.")

        prompt = f"""
# AI Prompt: Specific Question Generation from Uploaded Reviewers and Scanned Notes

## Role
You are an AI-powered academic assessment assistant integrated into StudyBuddy. Your task is to analyze students' uploaded reviewers, PDF documents, images of handwritten notes, scanned lecture materials, and other educational resources, then generate accurate, specific, and meaningful assessment questions based on their content.

## Context
Subject: {subject_name}
Target Questions: {count}
Question Type: {type_req}
Target Difficulty: {diff_req}

## Uploaded Material Excerpt:
\"\"\"
{text_content[:9500]}
\"\"\"

## Instructions
1. Analyze the uploaded material first.
   - Read the complete document or reviewer before generating questions.
   - Identify the main topics, subtopics, key terms, definitions, concepts, processes, examples, dates, formulas, and important facts.
   - If any text is unclear or unreadable, do not invent or assume the missing information.

2. Generate questions specifically from the uploaded content.
   - Every question must be traceable to a specific concept or piece of information in the uploaded material.
   - Avoid generic questions that are not directly related to the document.
   - Do not introduce unsupported facts from outside sources.
   - Use the terminology and meaning presented in the original reviewer.
   - Cover different topics proportionally to their importance and the amount of information provided.
   - Avoid repeating the same question using different wording.

3. Support different question types:
   {type_req}

4. Control question difficulty:
   {diff_req}

5. Provide an answer key and explanations:
   - The correct answer.
   - A concise explanation based on the reviewer.
   - The relevant topic or section.
   - A source reference, such as the page number, heading, or paragraph, when available.
   - For multiple-choice questions, three plausible incorrect options and one correct option.

6. Validate every generated question:
   - Verify that the answer is supported by the uploaded material.
   - Ensure the question has one clearly correct answer when applicable.
   - Check that the answer key matches the question.
   - Remove duplicate, ambiguous, irrelevant, and unsupported questions.
   - If the material does not contain enough information, generate fewer questions and inform the student instead of inventing content.

## Additional Rule: Direct and Natural Question Generation
Generate questions directly from the concepts, facts, definitions, and information found in the student's uploaded reviewer or scanned notes.

DO NOT USE PHRASES SUCH AS:
- "According to the reviewer..."
- "Based on the uploaded notes..."
- "As stated in the document..."
- "According to the provided material..."
- "What does the reviewer say about...?"

Instead, formulate clear, direct questions that test the student's actual understanding of the subject.
Questions must sound like authentic examination or quiz questions written by an instructor, not questions generated by summarizing a document. Test knowledge and understanding directly while maintaining accuracy and relevance to the uploaded content.

Return your response strictly as a valid JSON array of objects with this schema:
[
  {{
    "question_text": "Direct, authentic question testing knowledge without meta-phrases",
    "question_type": "Multiple Choice" | "Identification" | "True or False" | "Short Answer" | "Fill in the Blanks" | "Enumeration" | "Application-Based",
    "difficulty": "Easy" | "Moderate" | "Hard",
    "topic": "Exact topic from the uploaded reviewer",
    "choices": [
      "A. [Option A]",
      "B. [Option B]",
      "C. [Option C]",
      "D. [Option D]"
    ],
    "expected_answer": "Correct answer (or 'B. [Answer]' for multiple choice)",
    "explanation": "Why the answer is correct, based on the uploaded material",
    "source_reference": "Section heading, paragraph, or page reference",
    "key_concepts": ["concept1", "concept2", "concept3"]
  }}
]
"""
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.15,
                "response_mime_type": "application/json"
            }
        }
        resp = requests.post(url, json=payload, timeout=28)
        if resp.status_code == 200:
            data = resp.json()
            raw_text = data['candidates'][0]['content']['parts'][0]['text']
            questions = json.loads(raw_text)
            return questions
        else:
            raise RuntimeError(f"Gemini API returned status {resp.status_code}: {resp.text}")

    def _generate_with_local_rules(self, text, count=6, question_type="any", difficulty="moderate"):
        """
        Built-in robust assessment extractor generating direct, instructor-style examination questions
        strictly grounded in the uploaded notes, adhering to all assessment assistant guidelines.
        """
        questions = []
        seen_terms = set()
        
        lines = [line.strip() for line in text.split('\n') if line.strip()]

        term_def_pattern = re.compile(
            r'^(?:(?:\d+[\.\)]|[-•*])\s*)?([A-Za-z0-9][A-Za-z0-9\s\-_/()]{2,45})\s*[:–—\-]\s*(.+)$'
        )
        is_pattern = re.compile(
            r'^(?:(?:\d+[\.\)]|[-•*])\s*)?([A-Za-z0-9][A-Za-z0-9\s]{2,40})\s+(is\s+(?:defined\s+as\s+|referred\s+to\s+as\s+|known\s+as\s+|a\s+|an\s+|the\s+)?|means\s+|refers\s+to\s+)(.+)$',
            re.IGNORECASE
        )

        candidates = []
        for line in lines:
            if len(line) < 15:
                continue

            m1 = term_def_pattern.match(line)
            if m1:
                term = m1.group(1).strip()
                term = re.sub(r'^\d+[\.\)]\s*', '', term)
                definition = m1.group(2).strip()
                if len(definition.split()) >= 4 and len(term.split()) <= 6:
                    candidates.append((term, definition))
                    continue

            m2 = is_pattern.match(line)
            if m2:
                term = m2.group(1).strip()
                term = re.sub(r'^\d+[\.\)]\s*', '', term)
                definition = (m2.group(2) + m2.group(3)).strip()
                if len(definition.split()) >= 4 and len(term.split()) <= 6:
                    candidates.append((term, definition))
                    continue

        all_terms = [c[0] for c in candidates]

        # Formulate authentic, direct exam questions
        for idx, (term, definition) in enumerate(candidates):
            clean_t = term.lower().strip()
            if clean_t in seen_terms or len(clean_t) < 3:
                continue
            seen_terms.add(clean_t)

            tokens = clean_tokens(definition)
            key_concepts = list(set([term.lower()] + tokens[:3]))
            target_diff = "Easy" if len(tokens) <= 6 else ("Hard" if len(tokens) > 14 else "Moderate")

            # Determine specific question type
            q_mode = question_type.lower().replace(' ', '_')
            if q_mode == 'any':
                types_cycle = ["identification", "multiple_choice", "short_answer", "true_false", "fill_in_the_blanks"]
                chosen_type = types_cycle[idx % len(types_cycle)]
            else:
                chosen_type = q_mode

            choices = []
            if chosen_type == "multiple_choice" or (chosen_type == "any" and idx % 3 == 0):
                # Build plausible distractors from other terms in the material
                distractors = [other for other in all_terms if other.lower().strip() != clean_t][:3]
                while len(distractors) < 3:
                    distractors.append(f"Component {len(distractors) + 1}")
                opts = [term] + distractors
                # Deterministic shuffle
                opts = sorted(opts, key=lambda x: len(x) + idx)
                correct_idx = opts.index(term)
                letters = ["A", "B", "C", "D"]
                correct_letter = letters[correct_idx]
                choices = [f"{letters[i]}. {opts[i]}" for i in range(4)]
                
                q_text = f"Which component or concept is defined as: {definition.rstrip('.')}?"
                expected_ans = f"{correct_letter}. {term}"
                q_type_label = "Multiple Choice"

            elif chosen_type == "identification":
                q_text = f"What term refers to the following: \"{definition.rstrip('.')}\"?"
                expected_ans = term
                q_type_label = "Identification"

            elif chosen_type == "true_false":
                q_text = f"{term} is {definition.rstrip('.')}. Is this statement True or False?"
                expected_ans = "True"
                q_type_label = "True or False"
                choices = ["A. True", "B. False"]

            elif chosen_type == "fill_in_the_blanks":
                q_text = f"_______ is {definition.rstrip('.')}."
                expected_ans = term
                q_type_label = "Fill in the Blanks"

            else:
                # Direct conceptual question (Short Answer)
                if any(w in definition.lower() for w in ['process', 'method', 'technique']):
                    q_text = f"What is the function and purpose of {term}?"
                elif any(w in definition.lower() for w in ['device', 'hardware', 'component', 'circuit', 'unit']):
                    q_text = f"What is the primary role of the {term}?"
                else:
                    q_text = f"What is {term}?"
                
                expected_ans = f"{term} is {definition}" if not definition.lower().startswith(term.lower()) else definition
                if not expected_ans.endswith('.'):
                    expected_ans += '.'
                q_type_label = "Short Answer"

            questions.append({
                "question_text": q_text,
                "expected_answer": expected_ans,
                "question_type": q_type_label,
                "difficulty": target_diff,
                "topic": term,
                "choices": choices,
                "explanation": f"{term} is defined in the material as: {definition.rstrip('.')}.",
                "source_reference": f"Reviewer Definition: {term}",
                "key_concepts": key_concepts
            })

            if len(questions) >= count + 4:
                break

        # Fallback for general text without bullet points
        if len(questions) < count:
            paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip().split()) >= 10]
            for p in paragraphs:
                sentences = [s.strip() for s in p.split('.') if len(s.strip().split()) >= 6]
                for s in sentences:
                    tokens = clean_tokens(s)
                    if len(tokens) >= 3 and len(questions) < (count + 2):
                        subject_kw = tokens[0].capitalize()
                        if subject_kw.lower() in seen_terms:
                            continue
                        seen_terms.add(subject_kw.lower())

                        clean_sentence = s.strip() + "."
                        questions.append({
                            "question_text": f"What is the significance or function of {subject_kw}?",
                            "expected_answer": clean_sentence,
                            "question_type": "Short Answer",
                            "difficulty": "Moderate",
                            "topic": subject_kw,
                            "choices": [],
                            "explanation": clean_sentence,
                            "source_reference": f"Course Excerpt: {subject_kw}",
                            "key_concepts": tokens[:4]
                        })

        return questions[:max(count, len(questions))]

    def evaluate_spoken_answer(self, spoken_text, expected_answer, key_concepts=None, question_text="", audio_length="concise"):
        """
        Evaluates the student's transcribed spoken or typed answer.
        Filters out speech fillers or conversational words that do not connect to the reviewer.
        Supports Audio Explanation Length preferences from the study:
        - concise: 1-3 minutes spoken equivalent (default, 53.3% survey preference)
        - brief: < 1 minute quick summary
        - detailed: 3-5 minutes comprehensive review
        """
        spoken_clean = filter_conversational_speech(spoken_text) if spoken_text else ""
        if not spoken_clean or len(spoken_clean.split()) == 0:
            expected_short = expected_answer[:160] + "..." if len(expected_answer) > 160 else expected_answer
            return {
                "score": 0.0,
                "is_correct": False,
                "verdict": "WRONG",
                "voice_memo": f"Wrong. No answer was detected. The correct answer is: {expected_short}. Please state your answer clearly.",
                "feedback": f"No answer was detected. The correct answer is: \"{expected_answer}\".",
                "missing_concepts": key_concepts or [],
                "audio_length": audio_length
            }

        if self.api_key:
            try:
                res = self._evaluate_with_gemini(spoken_clean, expected_answer, key_concepts, question_text, audio_length)
                if res:
                    res["audio_length"] = audio_length
                    return res
            except Exception as e:
                print(f"[AIEngine] Gemini evaluation error, falling back to local evaluator: {e}")

        res = self._evaluate_with_local_rules(spoken_clean, expected_answer, key_concepts, audio_length)
        res["audio_length"] = audio_length
        return res

    def _evaluate_with_gemini(self, spoken_text, expected_answer, key_concepts, question_text, audio_length="concise"):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        
        length_guideline = {
            "brief": "Ultra-brief (< 1 min spoken equivalent, 1 crisp sentence).",
            "detailed": "Comprehensive & thorough (3-5 min spoken equivalent, in-depth explanation with examples).",
            "concise": "Concise (1-3 min spoken equivalent, 2-3 focused sentences as preferred by 53.3% of BSIT survey students)."
        }.get(audio_length, "Concise (1-3 min spoken equivalent).")

        prompt = f"""
You are an encouraging college instructor and personalized AI study buddy assessing a student who answered a study question.

Question: {question_text}
Expected Ideal Answer: {expected_answer}
Key Concept Terms: {json.dumps(key_concepts or [])}
Student's Answer (Voice or Typed): \"{spoken_text}\"
Target Audio Length: {length_guideline}

INSTRUCTIONS:
1. Score the answer from 0 to 100 based on accuracy and technical concept coverage strictly grounded in the reviewer answer. Pass mark is 70.
2. SPEECH FILTERING: Do not penalize speech fillers ('uh', 'um', 'wait', 'I think') or incidental words.
3. MANDATORY VOICE MEMO RULE:
   - If score >= 70 (is_correct is true), 'voice_memo' MUST START with "Correct!" followed by explanation.
   - If score < 70 (is_correct is false), 'voice_memo' MUST START with "Wrong. The correct answer is: {expected_answer}."
4. Respect the requested audio length: {length_guideline}

Return strictly valid JSON:
{{
  "score": <number between 0 and 100>,
  "is_correct": <boolean>,
  "verdict": "CORRECT" or "WRONG",
  "voice_memo": "<spoken text>",
  "feedback": "<detailed explanatory feedback for display>",
  "missing_concepts": ["concept1", "concept2"]
}}
"""
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json"
            }
        }
        resp = requests.post(url, json=payload, timeout=20)
        if resp.status_code == 200:
            data = resp.json()
            raw_text = data['candidates'][0]['content']['parts'][0]['text']
            return json.loads(raw_text)
        else:
            raise RuntimeError(f"Gemini API returned status {resp.status_code}: {resp.text}")

    def _evaluate_with_local_rules(self, spoken_text, expected_answer, key_concepts=None, audio_length="concise"):
        """
        Comprehensive semantic similarity & keyword coverage evaluation.
        Produces explicit 'Correct!' or 'Wrong. The correct answer is: ...' voice memo
        tailored to the chosen explanation duration (1-3 min concise, brief, or detailed).
        """
        spoken_tokens = set(clean_tokens(spoken_text))
        expected_tokens = set(clean_tokens(expected_answer))

        if not key_concepts:
            key_concepts = list(expected_tokens)[:5]
        
        matched_concepts = []
        missing_concepts = []
        for concept in key_concepts:
            c_clean = concept.lower().strip()
            if any(c_clean in st or st in c_clean for st in spoken_tokens) or c_clean in spoken_text.lower():
                matched_concepts.append(concept)
            else:
                missing_concepts.append(concept)

        concept_coverage = len(matched_concepts) / max(len(key_concepts), 1)
        matcher = SequenceMatcher(None, spoken_text.lower(), expected_answer.lower())
        string_sim = matcher.ratio()
        overlap = len(spoken_tokens.intersection(expected_tokens))
        token_sim = overlap / max(len(expected_tokens), 1)

        raw_score = (concept_coverage * 55.0) + (token_sim * 25.0) + (string_sim * 20.0)
        
        non_answers = ["i don't know", "idk", "pass", "no idea", "skip", "i do not know", "what", "none"]
        if any(na in spoken_text.lower() for na in non_answers) and len(spoken_tokens) <= 3:
            raw_score = 0.0

        final_score = min(max(round(raw_score, 1), 0.0), 100.0)
        is_correct = final_score >= 70.0
        verdict = "CORRECT" if is_correct else "WRONG"

        # Format feedback according to preferred length
        if is_correct:
            if audio_length == "brief":
                detail = "Great job! Accurate active recall."
            elif audio_length == "detailed":
                detail = f"Superb conceptual explanation! You thoroughly covered key elements including '{', '.join(matched_concepts[:4])}'. Your recall demonstrates strong mastery of this foundational topic."
            else: # concise (1-3 min)
                detail = f"Great work! You accurately covered the core principles including '{', '.join(matched_concepts[:3])}'."
                if missing_concepts:
                    detail += f" For complete mastery, keep in mind {', '.join(missing_concepts[:2])}."
            
            voice_memo = f"Correct! {detail}"
            feedback = detail
        else:
            if audio_length == "brief":
                detail = f"Review missed terms: {', '.join(missing_concepts[:2])}." if missing_concepts else "Review your lecture notes."
            elif audio_length == "detailed":
                detail = f"Your answer missed essential technical definitions, particularly '{', '.join(missing_concepts[:3])}'. Active recall requires connecting these specific keywords to build strong memory traces." if missing_concepts else "The response diverges from the uploaded reviewer text."
            else: # concise (1-3 min)
                detail = f"You touched on some ideas, but missed crucial terms like '{', '.join(missing_concepts[:3])}'." if missing_concepts else "The response did not match the reviewer material."
            
            voice_memo = f"Wrong. The correct answer is: {expected_answer}. {detail} This question has been re-queued for spaced repetition."
            feedback = f"The expected answer is: \"{expected_answer}\". {detail}"

        return {
            "score": final_score,
            "is_correct": is_correct,
            "verdict": verdict,
            "voice_memo": voice_memo,
            "feedback": feedback,
            "missing_concepts": missing_concepts
        }

    def answer_study_question(self, question_text, materials_list):
        """
        Allows students to ask study questions (via voice or typing) grounded in their uploaded notes.
        (Addresses 80% multimodal asking preference and 86.7% grounding verification).
        """
        if not question_text or not materials_list:
            return {
                "answer": "Please upload study materials first to ask grounded questions.",
                "source_title": "No materials found",
                "source_excerpt": "",
                "voice_memo": "Please upload study materials first."
            }

        q_tokens = set(clean_tokens(question_text))
        best_match = None
        best_score = -1
        best_excerpt = ""

        # Find best paragraph match across uploaded materials
        for mat in materials_list:
            content = mat.get('content_text', '') or mat.get('content_snippet', '')
            paras = [p.strip() for p in content.split('\n\n') if len(p.strip()) > 30]
            if not paras:
                paras = [content]
            for p in paras:
                p_tokens = set(clean_tokens(p))
                overlap = len(q_tokens.intersection(p_tokens))
                if overlap > best_score:
                    best_score = overlap
                    best_match = mat
                    best_excerpt = p

        if best_match and best_score > 0:
            source_title = best_match.get('title', 'Course Note')
            clean_excerpt = best_excerpt[:450]
            answer = f"Based strictly on your uploaded note \"{source_title}\": {clean_excerpt}"
            voice_memo = f"According to your notes in {source_title}: {clean_excerpt[:180]}."
            return {
                "answer": answer,
                "source_title": source_title,
                "source_excerpt": clean_excerpt,
                "voice_memo": voice_memo,
                "is_grounded": True
            }
        else:
            first_mat = materials_list[0]
            source_title = first_mat.get('title', 'Uploaded Note')
            excerpt = (first_mat.get('content_text', '')[:300]) or "Review uploaded document."
            return {
                "answer": f"Here is the relevant excerpt from \"{source_title}\": {excerpt}",
                "source_title": source_title,
                "source_excerpt": excerpt,
                "voice_memo": f"Found relevant section in {source_title}.",
                "is_grounded": True
            }
