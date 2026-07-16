# backend/routes.py
from flask import request, jsonify, send_file, Blueprint
import io

# Make sure these functions are correctly imported from your other files
from document_generator import generate_docx_from_data, generate_pdf_from_data
from file_parser import parse_resume_file
from ollama_utils import (
    set_api_key,
    set_request_wallet,
    generate_elevator_pitch,
    generate_summary_suggestions,
    enhance_section_with_ai,
    generate_next_interview_question,
    evaluate_voice_answer,
    semantic_job_search,
    copilot_candidate_search,
    generate_cover_letter,
    grade_resume_match_score,
    tailor_resume_to_jd,
    generate_company_profile_via_ai,
    generate_company_reviews_via_ai
)
from google_calendar_utils import create_calendar_event
from face_verification import verify_face_similarity
from firebase_utils import require_auth
from vault_utils import encrypt_key
from job_crawler import crawl_jobs_to_db
from email_utils import (
    send_application_status_email,
    send_interview_scheduled_email,
    send_connection_request_email,
    send_connection_accepted_email,
    send_2fa_otp_email,
)
import datetime
from datetime import timezone, timedelta
import os
import random
import string
from google.cloud import firestore
import requests as _requests_lib
import threading as _threading_lib
import hashlib as _hashlib_lib

# In-memory OTP fallback (used only when Firestore is unavailable)
_otp_store: dict = {}
# Tracks running autonomous apply threads per user
_autonomous_sessions: dict = {}

# Create a Blueprint for API routes
api_bp = Blueprint('api', __name__)

def _is_no_keys(e: Exception) -> bool:
    return str(e).startswith("NO_API_KEYS:")

def _no_keys_resp(e: Exception = None):
    msg = str(e).replace("NO_API_KEYS:", "").strip() if e else \
          "Add your API keys in Profile → Settings to unlock AI-powered features."
    return jsonify({
        "error": "no_api_keys",
        "message": msg,
        "action": "/candidate/profile"
    }), 402

@api_bp.before_request
def configure_dynamic_api_key():
    # Reset per-request state to prevent cross-request leakage.
    set_api_key("")
    set_request_wallet([])

    # Inline wallet via header (signup flow — user's own keys before Firestore registration).
    import json as _json
    inline_wallet_json = request.headers.get('X-API-Wallet', '').strip()
    if inline_wallet_json:
        try:
            wallet = _json.loads(inline_wallet_json)
            if isinstance(wallet, list) and wallet:
                set_request_wallet(wallet)
                return
        except Exception as e:
            print(f"[routes] X-API-Wallet parse error: {e}")

    # Legacy inline Gemini key (dev/testing shortcut).
    inline_gemini = request.headers.get('X-Gemini-API-Key', '').strip()
    if inline_gemini:
        set_api_key(inline_gemini)
        return

    # Resolve uid from Bearer token.
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith("Bearer "):
        return
    token = auth_header.split(None, 1)[1].strip()
    uid = None

    if token.startswith("mock_token_for_"):
        uid = token.replace("mock_token_for_", "")
    else:
        from firebase_utils import firebase_initialized, auth as fb_auth
        if firebase_initialized:
            try:
                uid = fb_auth.verify_id_token(token).get('uid')
            except Exception as e:
                print(f"[routes] Token verification failed: {e}")

    if not uid:
        return

    # Load the full key wallet from Firestore and pass it to the router.
    from firebase_utils import db, firebase_initialized
    if not (firebase_initialized and db):
        return

    try:
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists:
            return
        wallet = user_doc.to_dict().get('apiKeysWallet', [])

        # Status-change callback — persists key state changes back to Firestore.
        def _on_status_change(entry):
            try:
                update = {'status': entry.status}
                if entry.exhausted_at:
                    update['exhaustedAt'] = entry.exhausted_at
                db.collection('users').document(uid).update({
                    f'apiKeysWallet': firestore.ArrayRemove([{'id': entry.id}])
                })
                # Simpler field-level path update via a transaction isn't
                # straightforward with array items; read-modify-write instead.
                fresh = db.collection('users').document(uid).get().to_dict() or {}
                updated_wallet = [
                    {**k, **update} if k.get('id') == entry.id else k
                    for k in fresh.get('apiKeysWallet', [])
                ]
                db.collection('users').document(uid).update({'apiKeysWallet': updated_wallet})
            except Exception as e:
                print(f"[routes] Key status update failed: {e}")

        set_request_wallet(wallet, on_status_change=_on_status_change)

    except Exception as e:
        print(f"[routes] Wallet load failed: {e}")

# --- Resume Parsing Endpoint ---
@api_bp.route('/parse-resume', methods=['POST'])
@require_auth
def parse_resume_route():
    configure_dynamic_api_key()  # load user keys from header or Firestore
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if file:
        try:
            result = parse_resume_file(file)
            if "error" in result:
                return jsonify(result), 422
            return jsonify(result), 200
        except RuntimeError as e:
            print(f"Gemini error in /api/parse-resume: {e}")
            return jsonify({"error": str(e)}), 422
        except Exception as e:
            print(f"Unexpected error in /api/parse-resume: {e}")
            return jsonify({"error": f"Internal server error: {str(e)}"}), 500

    return jsonify({"error": "An unknown error occurred"}), 500


# --- Document Generation Endpoints ---
@api_bp.route('/generate-docx', methods=['POST'])
@require_auth
def generate_docx_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    resume_data = request.json
    try:
        doc = generate_docx_from_data(resume_data)
        file_stream = io.BytesIO()
        doc.save(file_stream)
        file_stream.seek(0)
        
        personal_info = resume_data.get('personal', {})
        filename = f"{personal_info.get('name', 'resume').replace(' ', '_')}.docx"
        
        return send_file(
            file_stream,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
    except Exception as e:
        print(f"Error generating DOCX: {e}")
        return jsonify({"error": "An internal error occurred while generating the DOCX file."}), 500


@api_bp.route('/generate-pdf', methods=['POST'])
@require_auth
def generate_pdf_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    resume_data = request.json
    try:
        pdf_bytes = generate_pdf_from_data(resume_data)
        
        personal_info = resume_data.get('personal', {})
        filename = f"{personal_info.get('name', 'resume').replace(' ', '_')}.pdf"
 
        return send_file(
            io.BytesIO(pdf_bytes),
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf'
        )
    except Exception as e:
        print(f"Error generating PDF: {e}")
        return jsonify({"error": "An internal error occurred while generating the PDF file."}), 500

# --- NEW: Elevator Pitch Generation Endpoint ---
@api_bp.route('/generate-elevator-pitch', methods=['POST'])
@require_auth
def generate_elevator_pitch_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
 
    resume_data = request.json
    try:
        pitch = generate_elevator_pitch(resume_data)
        return jsonify({"elevatorPitch": pitch}), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error generating elevator pitch: {e}")
        return jsonify({"error": "An internal error occurred while generating the elevator pitch."}), 500


# --- NEW: Section Enhancement Endpoint ---
@api_bp.route('/enhance-section', methods=['POST'])
@require_auth
def enhance_section_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    section_name = data.get('sectionName')
    text_to_enhance = data.get('textToEnhance')
    
    if not section_name or not text_to_enhance:
        return jsonify({"error": "Missing sectionName or textToEnhance in request"}), 400
        
    try:
        suggestions = enhance_section_with_ai(section_name, text_to_enhance)
        return jsonify({"enhancedVersions": suggestions}), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error enhancing section: {e}")
        return jsonify({"error": "An internal error occurred while enhancing the section."}), 500


@api_bp.route('/generate-summary-suggestions', methods=['POST'])
@require_auth
def generate_summary_suggestions_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    resume_data = request.json.get('resumeData', {})
    if not resume_data:
        return jsonify({"error": "Missing resumeData"}), 400
    try:
        summaries = generate_summary_suggestions(resume_data)
        return jsonify({"summaries": summaries}), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error generating summary suggestions: {e}")
        return jsonify({"error": "Failed to generate summary suggestions."}), 500


# --- BIOMETRIC IDENTITY VERIFICATION ---
@api_bp.route('/interviews/verify-identity', methods=['POST'])
@require_auth
def verify_identity_route():
    if 'stateId' not in request.files or 'selfie' not in request.files:
        return jsonify({"error": "Missing stateId or selfie image files"}), 400
        
    state_id_file = request.files['stateId']
    selfie_file = request.files['selfie']
    
    try:
        state_id_bytes = state_id_file.read()
        selfie_bytes = selfie_file.read()
        
        verification_result = verify_face_similarity(state_id_bytes, selfie_bytes)
        return jsonify(verification_result), 200
    except Exception as e:
        print(f"Error verifying identity: {e}")
        return jsonify({"error": "An internal error occurred during biometric identity verification."}), 500


# --- DYNAMIC INTERVIEW GENERATOR ---
@api_bp.route('/interviews/get-next-question', methods=['POST'])
@require_auth
def get_next_question_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    resume_data = data.get('resumeData', {})
    conversation_history = data.get('conversationHistory', [])
    latest_transcript = data.get('latestTranscript', '')
    elapsed_seconds = data.get('elapsedSeconds', 0)
    
    try:
        next_question = generate_next_interview_question(
            resume_data, conversation_history, latest_transcript, elapsed_seconds
        )
        return jsonify({"nextQuestion": next_question}), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error generating next question: {e}")
        return jsonify({"error": "An internal error occurred while generating the next question."}), 500


# --- VOICE RESPONSE EVALUATOR ---
@api_bp.route('/interviews/evaluate-response', methods=['POST'])
@require_auth
def evaluate_response_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    question = data.get('question')
    transcript = data.get('transcript')
    
    if not question or not transcript:
        return jsonify({"error": "Missing question or transcript"}), 400
        
    try:
        evaluation = evaluate_voice_answer(question, transcript)
        return jsonify(evaluation), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error evaluating answer: {e}")
        return jsonify({"error": "An internal error occurred while evaluating the answer."}), 500


# --- PRACTICE INTERVIEW ---
@api_bp.route('/practice-interview/ai-turn', methods=['POST'])
@require_auth
def practice_ai_turn():
    """Conversational AI interviewer turn — returns natural speech text."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    try:
        from ollama_utils import ai_interviewer_turn
        text = ai_interviewer_turn(
            conversation=data.get('conversation', []),
            role=data.get('role', 'Software Engineer'),
            interview_type=data.get('interviewType', 'Technical'),
            difficulty=data.get('difficulty', 'Mid'),
            job_description=data.get('jobDescription', ''),
            turn_number=data.get('turnNumber', 1),
            total_turns=data.get('totalTurns', 5),
        )
        return jsonify({"text": text}), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/practice-interview/final-feedback', methods=['POST'])
@require_auth
def practice_final_feedback():
    """End-of-session full conversation evaluation."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    try:
        from ollama_utils import ai_interview_final_feedback
        result = ai_interview_final_feedback(
            conversation=data.get('conversation', []),
            role=data.get('role', 'Software Engineer'),
            interview_type=data.get('interviewType', 'Technical'),
        )
        return jsonify(result), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/practice-interview/question', methods=['POST'])
@require_auth
def practice_interview_question():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    try:
        from ollama_utils import generate_practice_question
        question = generate_practice_question(
            interview_type=data.get('interviewType', 'Technical'),
            role=data.get('role', 'Software Engineer'),
            difficulty=data.get('difficulty', 'Mid'),
            question_number=data.get('questionNumber', 1),
            asked_questions=data.get('askedQuestions', []),
        )
        return jsonify({"question": question}), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/practice-interview/evaluate', methods=['POST'])
@require_auth
def practice_interview_evaluate():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    question = data.get('question', '')
    answer = data.get('answer', '')
    if not question or not answer:
        return jsonify({"error": "Missing question or answer"}), 400
    try:
        from ollama_utils import evaluate_practice_answer
        result = evaluate_practice_answer(
            question=question,
            answer=answer,
            interview_type=data.get('interviewType', 'Technical'),
            role=data.get('role', 'Software Engineer'),
        )
        return jsonify(result), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- SEMANTIC JOB SEARCH ---
@api_bp.route('/jobs/search-semantic', methods=['POST'])
@require_auth
def search_jobs_semantic_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    query = data.get('query')
    jobs = data.get('jobs', [])
    
    if not query:
        return jsonify({"error": "Missing search query"}), 400
        
    try:
        matches = semantic_job_search(query, jobs)
        return jsonify(matches), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error in semantic job search: {e}")
        return jsonify({"error": "An internal error occurred during semantic job search."}), 500


# --- RECRUITER AI COPILOT CANDIDATE SEARCH & DIRECTORY ---


def _get_all_candidates_helper():
    try:
        from firebase_utils import db
        if db:
            docs = db.collection('resumes').stream()
            candidates = []
            for doc in docs:
                data = doc.to_dict()
                resume_data = data.get('resumeData', {})
                uid = doc.id
                
                # Fetch profile info from users collection if available
                user_doc = db.collection('users').document(uid).get()
                user_data = user_doc.to_dict() if user_doc.exists else {}
                
                personal = resume_data.get('personal', {})
                name = personal.get('name') or user_data.get('name') or f"Candidate {uid[:4]}"
                email = personal.get('email') or user_data.get('email') or ""
                phone = personal.get('phone') or ""
                location = personal.get('location') or ""
                
                skills_list = resume_data.get('skills', [])
                skills_str = ""
                if isinstance(skills_list, list):
                    skills_items = []
                    for s in skills_list:
                        if isinstance(s, dict):
                            skills_items.append(s.get('skills_list', ''))
                        else:
                            skills_items.append(str(s))
                    skills_str = ", ".join(filter(None, skills_items))
                else:
                    skills_str = str(skills_list)
                
                experience_list = resume_data.get('experience', [])
                experience_str = ""
                if isinstance(experience_list, list):
                    exp_items = []
                    for e in experience_list:
                        if isinstance(e, dict):
                            exp_items.append(f"{e.get('jobTitle', '')} at {e.get('company', '')} ({e.get('dates', '')}) • {e.get('description', '')}")
                        else:
                            exp_items.append(str(e))
                    experience_str = " • ".join(filter(None, exp_items))
                
                education_list = resume_data.get('education', [])
                education_str = ""
                if isinstance(education_list, list):
                    edu_items = []
                    for ed in education_list:
                        if isinstance(ed, dict):
                            edu_items.append(f"{ed.get('degree', '')} from {ed.get('institution', '')} ({ed.get('graduationYear', '')})")
                        else:
                            edu_items.append(str(ed))
                    education_str = " • ".join(filter(None, edu_items))
                
                candidates.append({
                    "id": uid,
                    "uid": uid,
                    "name": name,
                    "title": (resume_data.get('summary', '').split('\n')[0] if resume_data.get('summary') else None) or personal.get('title') or "Software Professional",
                    "location": location,
                    "email": email,
                    "phone": phone,
                    "skills": skills_str or "Flutter, Mobile Development, Backend Systems",
                    "experience": experience_str or "No professional experience listed yet.",
                    "education": education_str or "No education listed yet.",
                    "profilePicUrl": user_data.get('profilePicture', ''),
                    "elevatorPitchUrl": user_data.get('elevatorPitchUrl', ''),
                    "recruiterNotes": user_data.get('recruiterNotes', '') or 'Review pending'
                })
            if candidates:
                return candidates
        return []
    except Exception as e:
        print(f"Error in helper fetching candidates: {e}")
        return []

@api_bp.route('/candidates', methods=['GET'])
@require_auth
def get_candidates_route():
    candidates = _get_all_candidates_helper()
    return jsonify(candidates), 200

@api_bp.route('/candidates/<uid>/resume', methods=['GET'])
@require_auth
def get_candidate_resume_for_recruiter(uid):
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            resume_doc = db.collection('resumes').document(uid).get()
            user_doc = db.collection('users').document(uid).get()
            resume_data = resume_doc.to_dict().get('resumeData', {}) if resume_doc.exists else {}
            user_data = user_doc.to_dict() if user_doc.exists else {}
            return jsonify({
                "resumeData": resume_data,
                "userProfile": {
                    "name": user_data.get('fullName') or user_data.get('name', ''),
                    "email": user_data.get('email', ''),
                    "phone": user_data.get('phone', ''),
                    "location": user_data.get('location', ''),
                }
            }), 200
        return jsonify({"resumeData": None, "userProfile": {}}), 200
    except Exception as e:
        print(f"Error fetching candidate resume: {e}")
        return jsonify({"resumeData": None, "userProfile": {}}), 200

@api_bp.route('/candidates/search-copilot', methods=['POST'])
@require_auth
def search_candidates_copilot_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    query = data.get('query')
    candidates = data.get('candidates', [])
    
    if not query:
        return jsonify({"error": "Missing search query"}), 400
        
    if not candidates:
        candidates = _get_all_candidates_helper()
        
    try:
        matches = copilot_candidate_search(query, candidates)
        return jsonify(matches), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error in copilot candidate search: {e}")
        return jsonify({"error": "An internal error occurred during recruiter copilot search."}), 500


# --- NEW: Cover Letter Generation Endpoint ---
@api_bp.route('/generate-cover-letter', methods=['POST'])
@require_auth
def generate_cover_letter_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    resume_data = data.get('resumeData')
    job_details = data.get('jobDetails')
    
    if not resume_data or not job_details:
        return jsonify({"error": "Missing resumeData or jobDetails in request"}), 400
        
    try:
        cover_letter = generate_cover_letter(resume_data, job_details)
        return jsonify({"coverLetter": cover_letter}), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error in cover letter endpoint: {e}")
        return jsonify({"error": "An internal error occurred while generating the cover letter."}), 500


# --- NEW: Resume Match Score & ATS Optimization Endpoint ---
@api_bp.route('/grade-resume', methods=['POST'])
@require_auth
def grade_resume_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    resume_data = data.get('resumeData')
    job_details = data.get('jobDetails')
    
    if not resume_data or not job_details:
        return jsonify({"error": "Missing resumeData or jobDetails in request"}), 400
        
    try:
        grade_result = grade_resume_match_score(resume_data, job_details)
        return jsonify(grade_result), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error in grade resume endpoint: {e}")
        return jsonify({"error": "An internal error occurred while grading the resume."}), 500


@api_bp.route('/resume/tailor-to-jd', methods=['POST'])
@require_auth
def tailor_resume_to_jd_route():
    data = request.json or {}
    resume_data = data.get('resumeData')
    job_description = data.get('jobDescription', '')
    missing_keywords = data.get('missingKeywords', [])
    if not resume_data:
        return jsonify({"error": "Missing resumeData"}), 400
    try:
        tailored = tailor_resume_to_jd(resume_data, job_description, missing_keywords)
        return jsonify({"resumeData": tailored}), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"[tailor-to-jd] error: {e}")
        return jsonify({"error": "Failed to tailor resume."}), 500


# --- Recruiter AI: Generate job description, requirements, benefits ---
@api_bp.route('/jobs/generate-description', methods=['POST'])
@require_auth
def generate_job_description_route():
    data = request.json or {}
    title = data.get('title', '').strip()
    department = data.get('department', '').strip()
    job_type = data.get('type', 'Full-time').strip()
    company = data.get('company', '').strip()
    skills = data.get('skills', '').strip()

    if not title:
        return jsonify({"error": "Job title is required"}), 400

    try:
        import ollama_utils
        prompt = f"""You are an expert technical recruiter. Write a professional job posting for the following role.

Role: {title}
Department: {department or 'Not specified'}
Employment Type: {job_type}
Company: {company or 'a fast-growing tech company'}
Key Skills/Technologies: {skills or 'to be determined based on role'}

Return ONLY valid JSON with this exact structure:
{{
  "description": "2-3 paragraph role overview and responsibilities",
  "requirements": ["requirement 1", "requirement 2", "requirement 3", "requirement 4", "requirement 5"],
  "benefits": ["benefit 1", "benefit 2", "benefit 3", "benefit 4"]
}}

Keep requirements specific and technical. Make the description compelling."""

        result = ollama_utils._call(prompt, json_mode=True, max_tokens=2048)
        if not isinstance(result, dict):
            raise ValueError("Invalid AI response format")
        return jsonify({
            "description": result.get("description", ""),
            "requirements": result.get("requirements", []),
            "benefits": result.get("benefits", []),
            "aiGenerated": True,
        }), 200
    except RuntimeError as e:
        if _is_no_keys(e): return _no_keys_resp(e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Recruiter AI: Screen a candidate application against the job ---
@api_bp.route('/applications/<app_id>/ai-screen', methods=['POST'])
@require_auth
def ai_screen_application(app_id):
    """Fetch application + candidate resume + job, run fit analysis for recruiter."""
    uid = request.user.get('uid')
    try:
        from firebase_utils import db, firebase_initialized
        import json as _json

        # Load application
        app_doc = db.collection('applications').document(app_id).get() if firebase_initialized and db else None
        if not app_doc or not app_doc.exists:
            return jsonify({"error": "Application not found"}), 404
        app_data = app_doc.to_dict()

        candidate_id = app_data.get('candidateId')
        job_id = app_data.get('jobId')

        # Load candidate resume
        resume_snap = db.collection('resumes').document(candidate_id).get() if candidate_id else None
        resume_data = (resume_snap.to_dict() or {}).get('resumeData') if resume_snap and resume_snap.exists else None

        if not resume_data:
            return jsonify({"error": "Candidate has no resume on file"}), 422

        # Load job details
        job_snap = db.collection('jobs').document(str(job_id)).get() if job_id else None
        job_data = job_snap.to_dict() if job_snap and job_snap.exists else None
        if not job_data:
            return jsonify({"error": "Job not found"}), 404

        job_details = {
            "title": job_data.get("title", ""),
            "company": job_data.get("company", ""),
            "description": job_data.get("description", ""),
            "requirements": job_data.get("requirements", []),
        }

        # Rule-based score first
        from ats_utils import rule_based_match
        rule_based = rule_based_match(resume_data, job_details)

        # Try AI-enhanced
        ai_result = {}
        try:
            from gemini_utils import analyze_job_fit_comprehensive
            import ollama_utils
            from ai_router import KeyEntry
            from vault_utils import decrypt_key as _vault_decrypt
            wallet = ollama_utils.get_request_wallet()
            if wallet:
                gemini_entry = next(
                    (
                        KeyEntry(e, vault_decrypt=_vault_decrypt)
                        for e in wallet
                        if e.get('provider') == 'Gemini'
                        and e.get('status') not in ('Invalid', 'Exhausted')
                    ),
                    None
                )
                if gemini_entry and gemini_entry.is_usable():
                    from gemini_utils import set_api_key as gem_set
                    gem_set(gemini_entry.key)
                    ai_result = analyze_job_fit_comprehensive(resume_data, job_details, rule_based)
        except Exception as e:
            print(f"[ai-screen] AI fit analysis error: {e}")

        # Generate interview questions
        questions = []
        try:
            import ollama_utils as _ou
            candidate_name = (resume_data.get('personal') or {}).get('name', 'the candidate')
            skills_str = ', '.join(
                s for grp in (resume_data.get('skills') or [])
                for s in (grp.get('skills_list') or '').split(',')
                if s.strip()
            )[:300]
            q_prompt = f"""Generate 5 specific technical interview questions for {candidate_name} applying for {job_details['title']}.
Their skills: {skills_str}
Job requirements: {', '.join(job_details['requirements'][:5])}
Return as JSON array: [{{"question": "...", "category": "Technical|Behavioral|Situational"}}]"""
            q_result = _ou._call(q_prompt, json_mode=True)
            if isinstance(q_result, list):
                questions = q_result
            elif isinstance(q_result, dict):
                questions = q_result.get('questions', q_result.get('items', []))
        except Exception:
            questions = [
                {"question": f"Describe your experience with {job_details['requirements'][0] if job_details['requirements'] else 'the required technologies'}.", "category": "Technical"},
                {"question": "Walk me through a challenging project and how you handled it.", "category": "Behavioral"},
                {"question": f"How would you approach the key responsibilities of the {job_details['title']} role in your first 90 days?", "category": "Situational"},
            ]

        return jsonify({
            "score": rule_based.get("score", 0),
            "matchedSkills": rule_based.get("matchedSkills", []),
            "missingSkills": rule_based.get("missingSkills", []),
            "recommendation": "Hire" if rule_based.get("score", 0) >= 80 else "Maybe" if rule_based.get("score", 0) >= 55 else "Pass",
            "optimizationTips": ai_result.get("optimizationTips", []),
            "aiEnhanced": bool(ai_result),
            "interviewQuestions": questions,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Resume Quality Analysis (no job context) ---
@api_bp.route('/resume/analyze', methods=['POST'])
@require_auth
def analyze_resume_quality_route():
    """
    Rule-based resume completeness/quality check.
    Accepts { resumeData } in body, or loads from Firestore for authenticated user.
    No AI cost — instant response.
    """
    configure_dynamic_api_key()
    uid = request.user.get('uid')

    if request.is_json and request.json.get('resumeData'):
        resume_data = request.json['resumeData']
    else:
        try:
            from firebase_utils import db, firebase_initialized
            if firebase_initialized and db:
                snap = db.collection('resumes').document(uid).get()
                if not snap.exists:
                    return jsonify({"error": "No resume found for this user."}), 404
                resume_data = snap.to_dict().get('resumeData', {})
            else:
                return jsonify({"error": "Firebase not available and no resumeData provided."}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    try:
        from ats_utils import analyze_resume_quality
        result = analyze_resume_quality(resume_data)
        return jsonify(result), 200
    except Exception as e:
        print(f"[resume/analyze] error: {e}")
        return jsonify({"error": str(e)}), 500


# --- Comprehensive Job Fit Analysis (ATS + cover letter + tutorials + bullets) ---
@api_bp.route('/analyze-fit', methods=['POST'])
@require_auth
def analyze_fit_route():
    """
    One-shot comprehensive analysis:
    1. Rule-based ATS score (instant, no API)
    2. AI layer: tailored bullets, cover letter, tutorials, project suggestions
    Results cached in Firestore for 24 h to avoid redundant AI calls.
    """
    configure_dynamic_api_key()
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data        = request.json
    resume_data = data.get('resumeData')
    job_details = data.get('jobDetails')
    job_id      = data.get('jobId', '')
    uid         = request.user.get('uid')

    if not resume_data or not job_details:
        return jsonify({"error": "Missing resumeData or jobDetails"}), 400

    try:
        from ats_utils import compute_ats_score
        rule_based = compute_ats_score(resume_data, job_details)
    except Exception as e:
        rule_based = {"score": 60, "breakdown": {}, "matchedSkills": [], "missingSkills": []}

    # Check Firestore cache (24 h)
    cache_key = f"{uid}_{job_id}" if job_id else None
    try:
        from firebase_utils import db, firebase_initialized
        import datetime as _dt
        if cache_key and firebase_initialized and db:
            cache_snap = db.collection('atsCache').document(cache_key).get()
            if cache_snap.exists:
                cached = cache_snap.to_dict()
                expires = cached.get('expiresAt', '')
                if expires and _dt.datetime.utcnow().isoformat() < expires:
                    # Merge fresh rule-based score (could have changed if resume updated)
                    cached['ruleBasedScore'] = rule_based
                    return jsonify(cached), 200
    except Exception:
        pass  # cache miss is fine

    # Try AI enhancement
    ai_result = None
    try:
        from gemini_utils import analyze_job_fit_comprehensive, generate_cover_letter
        import ollama_utils
        from ai_router import KeyEntry
        from vault_utils import decrypt_key as _vault_decrypt
        wallet = ollama_utils.get_request_wallet()
        if wallet:
            # KeyEntry handles both plain 'key' and Fernet-encrypted 'encryptedKey'
            gemini_entry = next(
                (
                    KeyEntry(e, vault_decrypt=_vault_decrypt)
                    for e in wallet
                    if e.get('provider') == 'Gemini'
                    and e.get('status') not in ('Invalid', 'Exhausted')
                ),
                None
            )
            if gemini_entry and gemini_entry.is_usable():
                from gemini_utils import set_api_key as gem_set
                gem_set(gemini_entry.key)
                ai_result = analyze_job_fit_comprehensive(resume_data, job_details, rule_based)
    except RuntimeError as e:
        if _is_no_keys(e):
            pass  # fall through to rule-based only response
    except Exception as e:
        print(f"[analyze-fit] AI layer error: {e}")

    response_data = {
        "ruleBasedScore": rule_based,
        "aiEnhanced":     ai_result is not None,
    }
    if ai_result:
        response_data.update(ai_result)
    else:
        response_data.update({
            "tailoredBullets":  [],
            "coverLetter":      "",
            "tutorials":        [],
            "projects":         [],
            "optimizationTips": rule_based.get("missingSkills", [])
                                 and [f"Build skills in: {', '.join(rule_based['missingSkills'][:5])}"] or [],
        })

    # Store in cache
    try:
        from firebase_utils import db, firebase_initialized
        import datetime as _dt
        if cache_key and firebase_initialized and db:
            expires = (_dt.datetime.utcnow() + _dt.timedelta(hours=24)).isoformat()
            db.collection('atsCache').document(cache_key).set({**response_data, "expiresAt": expires})
    except Exception:
        pass

    return jsonify(response_data), 200


# --- Store ATS score on application ---
@api_bp.route('/applications/<app_id>/ats-score', methods=['POST'])
@require_auth
def store_application_ats_score(app_id):
    """Called after apply to lock in the ATS score on the application record."""
    configure_dynamic_api_key()
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    score_data = data.get('atsScore', {})
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            db.collection('applications').document(app_id).update({'atsScore': score_data})
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/interviews', methods=['GET'])
@require_auth
def get_interviews():
    application_id = request.args.get('applicationId')
    if not application_id:
        return jsonify({"error": "applicationId is required"}), 400
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            docs = db.collection('interviews').where('applicationId', '==', application_id).stream()
            interviews = []
            for d in docs:
                item = d.to_dict()
                item['id'] = d.id
                interviews.append(item)
            interviews.sort(key=lambda x: x.get('scheduledAt', ''), reverse=True)
            return jsonify({"interviews": interviews}), 200
        return jsonify({"interviews": []}), 200
    except Exception as e:
        print(f"Error getting interviews: {e}")
        return jsonify({"interviews": []}), 200


@api_bp.route('/interviews/schedule', methods=['POST'])
@require_auth
def schedule_interview_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.json
    application_id = data.get('applicationId', '')
    candidate_id   = data.get('candidateId', '')
    job_id         = data.get('jobId', '')
    scheduled_at   = data.get('scheduledAt', '')   # "2026-06-25T10:00" from datetime-local
    duration_mins  = int(data.get('duration', 60))
    interview_type = data.get('type', 'video')
    meeting_link   = data.get('meetingLink', '')
    notes          = data.get('notes', '')
    recruiter_id   = request.user.get('uid', '')
    recruiter_email = request.user.get('email', '')

    if not scheduled_at:
        return jsonify({"error": "scheduledAt is required"}), 400

    try:
        from firebase_utils import db, firebase_initialized
        from firebase_admin import firestore as fs

        # Resolve job title / company from Firestore if available
        job_title, company, candidate_email, candidate_name = '', '', '', ''
        if firebase_initialized and db:
            if job_id:
                jdoc = db.collection('jobs').document(job_id).get()
                if jdoc.exists:
                    jd = jdoc.to_dict()
                    job_title = jd.get('title', '')
                    company   = jd.get('company', '')
            if candidate_id:
                cdoc = db.collection('users').document(candidate_id).get()
                if cdoc.exists:
                    cd = cdoc.to_dict()
                    candidate_email = cd.get('email', '')
                    candidate_name  = cd.get('fullName', cd.get('name', ''))

        # Store interview to Firestore
        interview_doc = {
            'applicationId': application_id,
            'candidateId':   candidate_id,
            'recruiterId':   recruiter_id,
            'jobId':         job_id,
            'jobTitle':      job_title,
            'company':       company,
            'scheduledAt':   scheduled_at,
            'duration':      duration_mins,
            'type':          interview_type,
            'meetingLink':   meeting_link,
            'notes':         notes,
            'status':        'scheduled',
            'createdAt':     datetime.datetime.utcnow().isoformat() + 'Z',
        }
        interview_id = ''
        if firebase_initialized and db:
            ref = db.collection('interviews').add(interview_doc)
            interview_id = ref[1].id

            # Notify the candidate
            if candidate_id:
                dt_display = scheduled_at.replace('T', ' ')
                db.collection('notifications').add({
                    'candidateId': candidate_id,
                    'title': 'Interview Scheduled',
                    'message': f"Your interview for '{job_title}' at '{company}' is scheduled for {dt_display}.",
                    'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
                    'read': False,
                })

        # Attempt Google Calendar event — graceful fallback
        cal_link = meeting_link
        try:
            clean_time = scheduled_at.split('.')[0].replace('Z', '')
            start_dt = datetime.datetime.fromisoformat(clean_time)
            end_dt   = start_dt + datetime.timedelta(minutes=duration_mins)
            attendees = [e for e in [candidate_email, recruiter_email] if e]
            if attendees:
                cal_link = create_calendar_event(
                    summary=f"{interview_type.title()} Interview – {job_title}",
                    description=notes or f"Interview for {job_title} at {company}",
                    start_time=start_dt,
                    end_time=end_dt,
                    attendees=attendees,
                )
                dt_str = start_dt.strftime("%B %d, %Y at %I:%M %p UTC")
                for email_addr in attendees:
                    send_interview_scheduled_email(
                        to=email_addr,
                        candidate_name=candidate_name or email_addr.split('@')[0],
                        job_title=job_title,
                        company=company,
                        interview_datetime=dt_str,
                        meet_link=cal_link,
                    )
        except FileNotFoundError:
            pass  # Calendar credentials not configured — use stored meetingLink
        except Exception as cal_err:
            print(f"[schedule] calendar/email non-fatal error: {cal_err}")

        interview_doc['id'] = interview_id
        interview_doc['meetLink'] = cal_link
        return jsonify({"status": "success", "interview": interview_doc, "meetLink": cal_link}), 200

    except Exception as e:
        print(f"Error in interview scheduling endpoint: {e}")
        return jsonify({"error": f"An error occurred while scheduling: {str(e)}"}), 500



# --- Dynamic Data Endpoints (Unauthenticated) ---

@api_bp.route('/benefits', methods=['GET'])
def get_benefits():
    try:
        from firebase_utils import db
        if db:
            docs = db.collection('benefits').stream()
            benefits = [doc.to_dict() for doc in docs]
            return jsonify({"benefits": benefits}), 200
        return jsonify({"benefits": []}), 200
    except Exception as e:
        print(f"Error fetching benefits from Firestore: {e}")
        return jsonify({"benefits": []}), 200

@api_bp.route('/testimonials', methods=['GET'])
def get_testimonials():
    try:
        from firebase_utils import db
        if db:
            docs = db.collection('testimonials').stream()
            testimonials = [doc.to_dict() for doc in docs]
            return jsonify({"testimonials": testimonials}), 200
        return jsonify({"testimonials": []}), 200
    except Exception as e:
        print(f"Error fetching testimonials: {e}")
        return jsonify({"testimonials": []}), 200

@api_bp.route('/employers/featured', methods=['GET'])
def get_employers_featured():
    try:
        from firebase_utils import db
        if db:
            docs = db.collection('employers').where('featured', '==', True).stream()
            employers = [doc.to_dict() for doc in docs]
            return jsonify({"employers": employers}), 200
        return jsonify({"employers": []}), 200
    except Exception as e:
        print(f"Error fetching employers: {e}")
        return jsonify({"employers": []}), 200

@api_bp.route('/jobs', methods=['GET'])
def get_jobs():
    try:
        from firebase_utils import db
        recruiter_id = request.args.get('recruiterId')
        if db:
            query = db.collection('jobs')
            if recruiter_id:
                query = query.where('recruiterId', '==', recruiter_id)
            docs = query.stream()
            jobs = []
            for doc in docs:
                j = doc.to_dict()
                j['id'] = doc.id
                jobs.append(j)
            # Candidates only see live postings; recruiters see all their own jobs
            # (Draft, Paused, Closed, Archived are recruiter-side states.)
            if not recruiter_id:
                jobs = [j for j in jobs if j.get('status', 'Open') in ('Open', 'In Review')]
            # If filtering by recruiter return empty list (not mock data) when none found
            return jsonify({"jobs": jobs}), 200
        return jsonify({"jobs": []}), 200
    except Exception as e:
        print(f"Error fetching jobs: {e}")
        return jsonify({"jobs": []}), 200

@api_bp.route('/jobs/<job_id>', methods=['GET'])
def get_job_by_id(job_id):
    try:
        from firebase_utils import db
        if db:
            doc = db.collection('jobs').document(job_id).get()
            if doc.exists:
                j = doc.to_dict()
                j['id'] = doc.id
                return jsonify(j), 200
            return jsonify({"error": "Job not found"}), 404
        return jsonify({"error": "Job not found"}), 404
    except Exception as e:
        print(f"Error fetching job by id: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/jobs/<job_id>', methods=['PATCH'])
@require_auth
def update_job(job_id):
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    allowed = {'title', 'description', 'jobType', 'department', 'location', 'status', 'company',
               'requirements', 'benefits', 'skills', 'workMode', 'experienceLevel',
               'salaryMin', 'salaryMax', 'salaryVisible', 'visaSponsorship', 'screeningQuestions'}
    update_data = {k: v for k, v in data.items() if k in allowed and v is not None}
    valid_statuses = {'Draft', 'Open', 'Paused', 'In Review', 'Closed', 'Archived'}
    if 'status' in update_data and update_data['status'] not in valid_statuses:
        return jsonify({"error": f"Invalid status. Use one of: {sorted(valid_statuses)}"}), 400
    if not update_data:
        return jsonify({"error": "No valid fields to update"}), 400
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            jdoc = db.collection('jobs').document(job_id).get()
            if not jdoc.exists:
                return jsonify({"error": "Job not found"}), 404
            jd = jdoc.to_dict()
            from firebase_utils import is_admin_user as _adm
            if jd.get('recruiterId') and jd.get('recruiterId') != request.user.get('uid', '') and not _adm(request.user):
                return jsonify({"error": "Unauthorized"}), 403
            db.collection('jobs').document(job_id).update(update_data)
            updated = {**jd, **update_data, 'id': job_id}
            return jsonify({"status": "success", "job": updated}), 200
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error updating job: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/jobs/v1/post', methods=['POST'])
@require_auth
def post_job_v1():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.json
    title = data.get('title')
    description = data.get('description')
    job_type = data.get('jobType')

    # Drafts only need a title; publishing requires the full trio.
    status = data.get('status', 'Open')
    if status not in ('Draft', 'Open'):
        status = 'Open'
    if not title:
        return jsonify({"error": "Missing title"}), 400
    if status == 'Open' and (not description or not job_type):
        return jsonify({"error": "Missing title, description or jobType"}), 400

    try:
        from firebase_utils import db
        recruiter_id = request.user.get('uid', '')
        new_job = {
            "title": title,
            "description": description or '',
            "jobType": job_type or 'Full-time',
            "department": data.get('department', ''),
            "location": data.get('location', 'Remote'),
            # The company on a posting is what the recruiter typed — never
            # silently replace it with the recruiter's personal name.
            "company": data.get('company') or request.user.get('name', 'Confidential Employer'),
            "recruiterId": recruiter_id,
            "postedDate": datetime.datetime.utcnow().strftime('%Y-%m-%d'),
            "status": status,
            # Recruiter intake — previously collected by the UI and dropped here.
            "requirements": data.get('requirements', []),
            "benefits": data.get('benefits', []),
            "skills": data.get('skills', ''),
            "workMode": data.get('workMode', ''),
            "experienceLevel": data.get('experienceLevel', ''),
            "salaryMin": data.get('salaryMin', ''),
            "salaryMax": data.get('salaryMax', ''),
            "salaryVisible": bool(data.get('salaryVisible', True)),
            "visaSponsorship": bool(data.get('visaSponsorship', False)),
            "screeningQuestions": data.get('screeningQuestions', []),
        }
        if db:
            doc_ref = db.collection('jobs').add(new_job)
            new_job['id'] = doc_ref[1].id
        else:
            return jsonify({"error": "Firebase not initialized — cannot post job"}), 503

        return jsonify({"status": "success", "job": new_job}), 201
    except Exception as e:
        print(f"Error posting job: {e}")
        return jsonify({"error": str(e)}), 500

# --- NEW: SECURE USER REGISTRATION VAULT PORTAL ---
@api_bp.route('/users/register', methods=['POST'])
@require_auth
def register_user_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    uid = data.get('uid')
    
    if not uid:
        return jsonify({"error": "Missing uid in registration request"}), 400
        
    if request.user.get('uid') != uid:
        return jsonify({"error": "Forbidden: Request UID mismatch"}), 403
        
    fullName = data.get('fullName')
    email = data.get('email')
    phone = data.get('phone')
    role = data.get('role', 'candidate')
    apiKeysWallet = data.get('apiKeysWallet', [])
    resumeProfile = data.get('resumeProfile') # Optional profile data (education, experience, skills)
    
    if not email or not fullName:
        return jsonify({"error": "Missing email or fullName in registration request"}), 400
        
    try:
        from firebase_utils import db, firebase_initialized
        from vault_utils import encrypt_key
        
        # 1. Encrypt API Keys in the wallet on the server using our Master key!
        encrypted_wallet = []
        for item in apiKeysWallet:
            key_val = item.get('key', '').strip()
            if key_val:
                enc_val = encrypt_key(key_val)
                encrypted_wallet.append({
                    "id": item.get('id'),
                    "provider": item.get('provider'),
                    "encryptedKey": enc_val,
                    "status": item.get('status', 'Standby')
                })
        
        user_profile = {
            "uid": uid,
            "fullName": fullName,
            "email": email,
            "phone": phone,
            "role": role,
            "biometricConsent": True,
            "apiKeysWallet": encrypted_wallet,
            "createdAt": datetime.datetime.utcnow().isoformat() + "Z"
        }
        
        # 2. Save user profile and optional parsed resume data in Firestore if initialized
        if firebase_initialized and db:
            # Write User profile
            db.collection('users').document(uid).set(user_profile)
            
            # Write Resume details
            if role == 'candidate' and resumeProfile:
                db.collection('resumes').document(uid).set({"resumeData": resumeProfile})
        else:
            print("WARNING: Firestore uninitialized. Registration data not persisted.")
            
        return jsonify({
            "status": "success",
            "message": "User registered and profile initialized in secure vault successfully!",
            "userProfile": user_profile
        }), 200
        
    except Exception as e:
        print(f"Error registering user: {e}")
        return jsonify({"error": f"An error occurred during secure registration: {str(e)}"}), 500

# --- NEW: REAL-TIME SECURE KEY VERIFICATION VAULT ---
@api_bp.route('/vault/verify-key', methods=['POST'])
@require_auth
def verify_key_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    provider = data.get('provider', 'Gemini')
    key = data.get('key', '').strip()
    
    if not key:
        return jsonify({"error": "Missing API key to verify"}), 400
        
    try:
        if provider == 'Gemini':
            try:
                import requests as _req
                resp = _req.post(
                    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-8b-latest:generateContent',
                    params={'key': key},
                    json={'contents': [{'parts': [{'text': 'Say OK'}]}]},
                    timeout=15
                )
                data_r = resp.json()
                if resp.status_code == 200 and 'candidates' in data_r:
                    return jsonify({"valid": True, "message": "Gemini API Key verified successfully!"}), 200
                # Surface the real error from Google
                error_msg = data_r.get('error', {}).get('message', str(data_r))
                error_status = data_r.get('error', {}).get('status', '')
                safe_msg = error_msg.encode('ascii', errors='replace').decode('ascii')
                print(f"Gemini verify failed ({resp.status_code}): {safe_msg[:200]}")
                if 'API_KEY_INVALID' in error_status or 'invalid' in error_msg.lower():
                    return jsonify({"valid": False, "error": "API key is invalid. Check that you copied the full key correctly."}), 200
                if 'PERMISSION_DENIED' in error_status or 'SERVICE_DISABLED' in error_status or 'blocked' in error_msg.lower():
                    return jsonify({"valid": False, "error": "This key is blocked for content generation. Please get a key from aistudio.google.com/apikey"}), 200
                if resp.status_code == 429 or 'RESOURCE_EXHAUSTED' in error_status or 'quota' in error_msg.lower():
                    return jsonify({"valid": False, "error": "Key quota exhausted. Create a new free key at aistudio.google.com/apikey"}), 200
                return jsonify({"valid": False, "error": f"Gemini error: {safe_msg[:150]}"}), 200
            except Exception as e:
                safe = str(e).encode('ascii', errors='replace').decode('ascii')
                print(f"Gemini verify exception: {safe[:200]}")
                return jsonify({"valid": False, "error": f"Could not reach Gemini API: {safe[:100]}"}), 200
        elif provider == 'OpenAI':
            if key.startswith('sk-') and len(key) >= 40:
                return jsonify({"valid": True, "message": "OpenAI API Key format verified!"}), 200
            else:
                return jsonify({"valid": False, "error": "Invalid OpenAI key format (must start with sk-)."}), 200
        elif provider == 'NVIDIA NIM':
            # Live check — NVIDIA free credits expire, so format-only is not enough
            if not key.startswith('nvapi-'):
                return jsonify({"valid": False, "error": "NVIDIA NIM keys must start with nvapi-"}), 200
            try:
                import requests as _req
                resp = _req.post(
                    'https://integrate.api.nvidia.com/v1/chat/completions',
                    json={
                        "model": "meta/llama-3.1-8b-instruct",
                        "messages": [{"role": "user", "content": "Say OK"}],
                        "max_tokens": 5,
                    },
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    timeout=15,
                )
                if resp.status_code == 200:
                    return jsonify({"valid": True, "message": "NVIDIA NIM key verified successfully!"}), 200
                body = resp.json()
                detail = body.get("detail", body.get("title", str(body)))
                if resp.status_code in (401, 403):
                    return jsonify({"valid": False, "error": f"NVIDIA key rejected ({resp.status_code}): {detail}. Get a fresh key at build.nvidia.com"}), 200
                if resp.status_code == 429:
                    # Quota hit but key is valid — accept it
                    return jsonify({"valid": True, "message": "NVIDIA NIM key accepted (quota limit hit, will reset)."}), 200
                return jsonify({"valid": False, "error": f"NVIDIA API error {resp.status_code}: {detail}"}), 200
            except Exception as e:
                return jsonify({"valid": False, "error": f"Could not reach NVIDIA API: {str(e)[:100]}"}), 200
        elif provider == 'Apify':
            if not key.startswith('apify_api_'):
                return jsonify({"valid": False, "error": "Apify tokens must start with apify_api_"}), 200
            try:
                import requests as _req
                resp = _req.get(
                    'https://api.apify.com/v2/users/me',
                    params={'token': key},
                    timeout=10,
                )
                if resp.status_code == 200:
                    username = resp.json().get('data', {}).get('username', 'user')
                    return jsonify({"valid": True, "message": f"Apify key verified for @{username}!"}), 200
                if resp.status_code == 401:
                    return jsonify({"valid": False, "error": "Invalid Apify API token."}), 200
                return jsonify({"valid": False, "error": f"Apify error {resp.status_code}"}), 200
            except Exception as e:
                return jsonify({"valid": False, "error": f"Could not reach Apify: {str(e)[:100]}"}), 200
        else:
            # Generic format check for Groq and Claude
            if len(key) >= 30:
                return jsonify({"valid": True, "message": f"{provider} API Key format verified!"}), 200
            else:
                return jsonify({"valid": False, "error": f"Invalid key length for {provider}."}), 200
                
    except Exception as e:
        print(f"Vault verification error: {e}")
        return jsonify({"error": f"Internal verification failed: {str(e)}"}), 500


@api_bp.route('/vault/wallet/status', methods=['GET'])
@require_auth
def wallet_status():
    """Return which providers the authenticated user has keys for (no key values exposed)."""
    uid = request.user.get('uid')
    try:
        from firebase_utils import db, firebase_initialized
        providers = []
        if firebase_initialized and db:
            user_doc = db.collection('users').document(uid).get()
            if user_doc.exists:
                wallet = user_doc.to_dict().get('apiKeysWallet', [])
                providers = list({
                    e.get('provider') for e in wallet
                    if (e.get('key') or e.get('encryptedKey'))
                    and e.get('status') not in ('Invalid', 'Exhausted')
                })
        return jsonify({"hasKeys": len(providers) > 0, "providers": providers}), 200
    except Exception as e:
        return jsonify({"hasKeys": False, "providers": [], "error": str(e)}), 200


@api_bp.route('/vault/wallet/stack', methods=['POST'])
@require_auth
def wallet_stack_key():
    """Add a new verified key to a user's API wallet in Firestore."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.json
    uid = data.get('uid', '').strip()
    key = data.get('key', '').strip()
    provider = data.get('provider', 'Gemini')

    if not uid or not key:
        return jsonify({"error": "Missing uid or key"}), 400

    if request.user.get('uid') != uid:
        return jsonify({"error": "Forbidden: Request UID mismatch"}), 403

    try:
        from firebase_utils import db, firebase_initialized
        from vault_utils import encrypt_key

        enc_val = encrypt_key(key)
        new_entry = {
            "id": os.urandom(4).hex(),
            "provider": provider,
            "encryptedKey": enc_val,
            "status": "Standby"
        }

        if firebase_initialized and db:
            user_ref = db.collection('users').document(uid)
            user_doc = user_ref.get()
            existing_wallet = []
            if user_doc.exists:
                existing_wallet = user_doc.to_dict().get('apiKeysWallet', [])

            if not any(w.get('status') == 'Active' for w in existing_wallet):
                new_entry['status'] = 'Active'

            existing_wallet.append(new_entry)
            user_ref.set({'apiKeysWallet': existing_wallet}, merge=True)

        return jsonify({"status": "success", "entry": new_entry}), 200

    except Exception as e:
        print(f"Wallet stack error: {e}")
        return jsonify({"error": str(e)}), 500


@api_bp.route('/vault/wallet/remove', methods=['POST'])
@require_auth
def wallet_remove_key():
    """Remove a key from a user's API wallet in Firestore."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.json
    uid = data.get('uid', '').strip()
    key_id = data.get('keyId', '').strip()

    if not uid or not key_id:
        return jsonify({"error": "Missing uid or keyId"}), 400

    if request.user.get('uid') != uid:
        return jsonify({"error": "Forbidden: Request UID mismatch"}), 403

    try:
        from firebase_utils import db, firebase_initialized

        if firebase_initialized and db:
            user_ref = db.collection('users').document(uid)
            user_doc = user_ref.get()
            if user_doc.exists:
                wallet = user_doc.to_dict().get('apiKeysWallet', [])
                wallet = [w for w in wallet if w.get('id') != key_id]
                if wallet and not any(w.get('status') == 'Active' for w in wallet):
                    wallet[0]['status'] = 'Active'
                user_ref.set({'apiKeysWallet': wallet}, merge=True)

        return jsonify({"status": "success"}), 200

    except Exception as e:
        print(f"Wallet remove error: {e}")
        return jsonify({"error": str(e)}), 500


# ── APPLICATION SYSTEM ──────────────────────────────────────────────────────

def _run_match_analysis(app_id: str, resume_data: dict, job_details: dict, wallet: list):
    """Background thread: compute job match score and persist it on the application document."""
    import datetime as _dt
    try:
        from firebase_utils import db, firebase_initialized
        if not (firebase_initialized and db):
            return

        # Rule-based score — fast, no tokens needed
        rule_based: dict = {}
        rule_score = 0
        try:
            from ats_utils import rule_based_match as _ats
            rule_based = _ats(resume_data, job_details)
            rule_score = int(rule_based.get('score', 0))
        except Exception as e:
            print(f"[apply-analysis] ats error: {e}")

        # AI analysis using candidate's own Gemini key (zero platform cost)
        ai_result = None
        candidate_gemini_key = None
        if wallet:
            try:
                from ai_router import KeyEntry
                from vault_utils import decrypt_key as _vault_decrypt
                entry = next(
                    (KeyEntry(e, vault_decrypt=_vault_decrypt)
                     for e in wallet
                     if e.get('provider') == 'Gemini'
                     and e.get('status') not in ('Invalid', 'Exhausted')),
                    None
                )
                if entry and entry.is_usable():
                    candidate_gemini_key = entry.key
            except Exception as e:
                print(f"[apply-analysis] key extract error: {e}")

        if candidate_gemini_key:
            try:
                from gemini_utils import analyze_candidate_for_recruiter
                ai_result = analyze_candidate_for_recruiter(
                    resume_data, job_details, rule_score, api_key=candidate_gemini_key
                )
            except Exception as e:
                print(f"[apply-analysis] AI error: {e}")

        rec_default = 'Hire' if rule_score >= 80 else 'Maybe' if rule_score >= 55 else 'Pass'
        if ai_result:
            update = {
                'matchScore':        ai_result.get('matchScore', rule_score),
                'matchedSkills':     ai_result.get('matchedSkills', []),
                'missingSkills':     ai_result.get('missingSkills', []),
                'strengths':         ai_result.get('strengths', []),
                'concerns':          ai_result.get('concerns', []),
                'recommendation':    ai_result.get('recommendation', rec_default),
                'aiSummary':         ai_result.get('aiSummary', ''),
                'aiEnhanced':        True,
                'analysisTimestamp': _dt.datetime.utcnow().isoformat(),
            }
        else:
            update = {
                'matchScore':        rule_score,
                'matchedSkills':     rule_based.get('matchedSkills', []),
                'missingSkills':     rule_based.get('missingSkills', []),
                'strengths':         [],
                'concerns':          [],
                'recommendation':    rec_default,
                'aiSummary':         f'ATS keyword match: {rule_score}/100.',
                'aiEnhanced':        False,
                'analysisTimestamp': _dt.datetime.utcnow().isoformat(),
            }

        db.collection('applications').document(app_id).update(update)
        print(f"[apply-analysis] app={app_id} score={update['matchScore']} rec={update['recommendation']} ai={update['aiEnhanced']}")
    except Exception as e:
        print(f"[apply-analysis] fatal error for app={app_id}: {e}")


@api_bp.route('/jobs/<job_id>/apply', methods=['POST'])
@require_auth
def apply_to_job(job_id):
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    candidate_id = request.user.get('uid', '')
    # Prefer data from request body (real name/email) over mock token defaults
    candidate_name = data.get('candidateName') or request.user.get('name', 'Candidate')
    candidate_email = data.get('candidateEmail') or request.user.get('email', '')
    cover_letter = data.get('coverLetter', '')
    # Capture wallet now — Flask g is not accessible from background threads
    from ollama_utils import get_request_wallet
    candidate_wallet = get_request_wallet()
    try:
        from firebase_utils import db, firebase_initialized
        job_title = data.get('jobTitle', '')
        company = data.get('company', '')
        recruiter_id = ''
        jd: dict = {}
        if firebase_initialized and db:
            # Always fetch the job from Firestore to get the authoritative recruiterId
            jdoc = db.collection('jobs').document(job_id).get()
            if jdoc.exists:
                jd = jdoc.to_dict()
                job_title = jd.get('title', job_title)
                company = jd.get('company', company)
                recruiter_id = jd.get('recruiterId', '')
                print(f"[apply] job={job_id} recruiterId={recruiter_id!r}")
            else:
                print(f"[apply] WARNING: job {job_id} not found in Firestore")

            # Duplicate check using single-field query only (avoids composite index requirement)
            candidate_apps = list(db.collection('applications').where('candidateId', '==', candidate_id).stream())
            already = any(a.to_dict().get('jobId') == job_id for a in candidate_apps)
            if already:
                return jsonify({"error": "You have already applied to this job."}), 409

            app_data = {
                "candidateId": candidate_id, "candidateName": candidate_name,
                "candidateEmail": candidate_email, "jobId": job_id,
                "jobTitle": job_title, "company": company, "recruiterId": recruiter_id,
                "coverLetter": cover_letter, "status": "Applied",
                "appliedDate": datetime.datetime.utcnow().strftime('%Y-%m-%d'), "recruiterNotes": ""
            }
            ref = db.collection('applications').add(app_data)
            app_data['id'] = ref[1].id
            print(f"[apply] saved application {app_data['id']} with recruiterId={recruiter_id!r}")

            # Notify recruiter of new application
            if recruiter_id:
                db.collection('notifications').add({
                    'recruiterId': recruiter_id,
                    'title': 'New Application',
                    'message': f"{candidate_name} applied for '{job_title}' at {company}.",
                    'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
                    'read': False,
                })

            # Launch background analysis — uses candidate's own API key, zero platform cost
            try:
                import threading
                resume_data: dict = {}
                rdoc = db.collection('resumes').document(candidate_id).get()
                if rdoc.exists:
                    resume_data = rdoc.to_dict() or {}
                job_details_for_analysis = {
                    'title': job_title,
                    'company': company,
                    'description': jd.get('description', ''),
                    'requirements': jd.get('requirements', []),
                }
                t = threading.Thread(
                    target=_run_match_analysis,
                    args=(app_data['id'], resume_data, job_details_for_analysis, candidate_wallet),
                    daemon=True,
                )
                t.start()
            except Exception as bg_err:
                print(f"[apply] background analysis launch error: {bg_err}")
        else:
            import uuid
            app_data = {
                "id": str(uuid.uuid4()), "candidateId": candidate_id, "candidateName": candidate_name,
                "candidateEmail": candidate_email, "jobId": job_id, "jobTitle": job_title,
                "company": company, "recruiterId": recruiter_id, "coverLetter": cover_letter,
                "status": "Applied", "appliedDate": datetime.datetime.utcnow().strftime('%Y-%m-%d'), "recruiterNotes": ""
            }
        return jsonify({"status": "success", "application": app_data}), 201
    except Exception as e:
        print(f"Error applying to job: {e}")
        return jsonify({"error": str(e)}), 500


@api_bp.route('/applications', methods=['GET'])
@require_auth
def get_applications():
    recruiter_id = request.args.get('recruiterId')
    candidate_id = request.args.get('candidateId')
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            if recruiter_id:
                # Two-step: find all jobs owned by this recruiter, then collect their applications.
                # This works even if old applications were saved without a recruiterId field.
                job_docs = list(db.collection('jobs').where('recruiterId', '==', recruiter_id).stream())
                job_ids = [doc.id for doc in job_docs]
                print(f"[get_applications] recruiter={recruiter_id!r} found {len(job_ids)} jobs: {job_ids}")
                apps = []
                seen_ids = set()
                for jid in job_ids:
                    for adoc in db.collection('applications').where('jobId', '==', jid).stream():
                        if adoc.id not in seen_ids:
                            a = adoc.to_dict(); a['id'] = adoc.id
                            apps.append(a); seen_ids.add(adoc.id)
                print(f"[get_applications] returning {len(apps)} applications for recruiter {recruiter_id!r}")
                return jsonify({"applications": apps}), 200
            elif candidate_id:
                docs = db.collection('applications').where('candidateId', '==', candidate_id).stream()
                apps = []
                for doc in docs:
                    a = doc.to_dict(); a['id'] = doc.id
                    # Normalize appliedAt → appliedDate string for the frontend
                    applied_at = a.get('appliedAt')
                    if applied_at is not None and not isinstance(applied_at, str):
                        try:
                            dt = applied_at if isinstance(applied_at, datetime.datetime) else applied_at.datetime
                            a['appliedDate'] = f"{dt.strftime('%b')} {dt.day}" if hasattr(dt, 'strftime') else str(applied_at)
                        except Exception:
                            a['appliedDate'] = ''
                    apps.append(a)
                return jsonify({"applications": apps}), 200
            return jsonify({"applications": []}), 200
        return jsonify({"applications": []}), 200
    except Exception as e:
        print(f"Error fetching applications: {e}")
        return jsonify({"applications": []}), 200


@api_bp.route('/jobs/<job_id>/applications', methods=['GET'])
@require_auth
def get_job_applications(job_id):
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            docs = db.collection('applications').where('jobId', '==', job_id).stream()
            apps = []
            for doc in docs:
                a = doc.to_dict(); a['id'] = doc.id; apps.append(a)
            return jsonify({"applications": apps}), 200
        return jsonify({"applications": []}), 200
    except Exception as e:
        print(f"Error fetching job applications: {e}")
        return jsonify({"applications": []}), 200


@api_bp.route('/applications/<app_id>', methods=['GET'])
@require_auth
def get_application_by_id(app_id):
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            doc = db.collection('applications').document(app_id).get()
            if doc.exists:
                a = doc.to_dict(); a['id'] = doc.id
                return jsonify(a), 200
            return jsonify({"error": "Application not found"}), 404
        return jsonify({"error": "Database unavailable"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/applications/<app_id>/status', methods=['POST'])
@require_auth
def update_application_status(app_id):
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    try:
        from firebase_utils import db, firebase_initialized
        update_data = {}
        if data.get('status'):
            update_data['status'] = data['status']
        if data.get('recruiterNotes') is not None:
            update_data['recruiterNotes'] = data['recruiterNotes']
            
        if firebase_initialized and db and update_data:
            app_ref = db.collection('applications').document(app_id)
            app_snap = app_ref.get()
            if app_snap.exists:
                app_dict = app_snap.to_dict()
                candidate_id = app_dict.get('candidateId')
                job_title = app_dict.get('jobTitle', '')
                company = app_dict.get('company', '')
                
                app_ref.update(update_data)
                
                # Insert a notification if status updated
                new_status = data.get('status')
                if new_status:
                    notif_data = {
                        "candidateId": candidate_id,
                        "title": "Application Update",
                        "message": f"Your application for '{job_title}' at '{company}' has been updated to: {new_status}!",
                        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                        "read": False
                    }
                    db.collection('notifications').add(notif_data)
                    print(f"[NOTIF SUCCESS] Notification created for candidate {candidate_id} - status {new_status}")

                    # Email the candidate
                    candidate_doc = db.collection('users').document(candidate_id).get()
                    if candidate_doc.exists:
                        c_data = candidate_doc.to_dict()
                        c_email = c_data.get('email', '')
                        c_name = c_data.get('fullName', c_data.get('name', 'Candidate'))
                        if c_email:
                            send_application_status_email(
                                to=c_email,
                                candidate_name=c_name,
                                job_title=job_title,
                                company=company,
                                new_status=new_status,
                                recruiter_notes=data.get('recruiterNotes', '')
                            )

                    # Async webhook dispatch
                    webhook_payload = {
                        "applicationId": app_id,
                        "status": new_status,
                        "recruiterNotes": data.get('recruiterNotes'),
                        "candidateId": candidate_id,
                        "jobTitle": job_title,
                        "company": company,
                    }
                    dispatch_webhook_event("application.updated", webhook_payload)
            else:
                db.collection('applications').document(app_id).update(update_data)
        else:
            # Fallback mock notification logs
            new_status = data.get('status')
            if new_status:
                print(f"[MOCK NOTIF] Alert: Application status updated to {new_status}!")
                import uuid
                notif_data = {
                    "id": str(uuid.uuid4()),
                    "candidateId": data.get('candidateId', 'mock_uid_123'),
                    "title": "Application Update",
                    "message": f"Your application status has been updated to: {new_status}!",
                    "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                    "read": False
                }
                # Async webhook dispatch for fallback
                webhook_payload = {
                    "applicationId": app_id,
                    "status": new_status,
                    "recruiterNotes": data.get('recruiterNotes'),
                    "candidateId": data.get('candidateId', 'mock_uid_123'),
                    "jobTitle": data.get('jobTitle', 'Software Professional'),
                    "company": data.get('company', 'Ecosystem Partner'),
                }
                dispatch_webhook_event("application.updated", webhook_payload)
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error updating application: {e}")
        return jsonify({"error": str(e)}), 500


@api_bp.route('/users/<uid>/profile', methods=['PATCH'])
@require_auth
def update_user_profile(uid):
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    if request.user.get('uid') != uid:
        return jsonify({"error": "Unauthorized"}), 403
    data = request.json
    allowed = {'fullName', 'phone', 'location', 'bio', 'organizationName', 'industry'}
    update_data = {k: v for k, v in data.items() if k in allowed}
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            db.collection('users').document(uid).set(update_data, merge=True)
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error updating profile: {e}")
        return jsonify({"error": str(e)}), 500


@api_bp.route('/stats/candidate/<uid>', methods=['GET'])
@require_auth
def get_candidate_stats(uid):
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            apps = list(db.collection('applications').where('candidateId', '==', uid).stream())
            interviews = sum(1 for a in apps if a.to_dict().get('status') in ('Interviewed', 'Interview Scheduled'))
            has_resume = db.collection('resumes').document(uid).get().exists
            return jsonify({"totalApplications": len(apps), "interviewsScheduled": interviews, "hasResume": has_resume}), 200
        return jsonify({"totalApplications": 0, "interviewsScheduled": 0, "hasResume": False}), 200
    except Exception as e:
        print(f"Error getting candidate stats: {e}")
        return jsonify({"totalApplications": 0, "interviewsScheduled": 0, "hasResume": False}), 200


@api_bp.route('/stats/recruiter/<uid>', methods=['GET'])
@require_auth
def get_recruiter_stats(uid):
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            jobs_docs = list(db.collection('jobs').where('recruiterId', '==', uid).stream())
            open_jobs = len(jobs_docs)
            total_apps, total_interviews = 0, 0
            for jdoc in jobs_docs:
                apps = list(db.collection('applications').where('jobId', '==', jdoc.id).stream())
                total_apps += len(apps)
                total_interviews += sum(1 for a in apps if a.to_dict().get('status') in ('Interviewed', 'Interview Scheduled'))
            return jsonify({"openJobs": open_jobs, "totalApplications": total_apps, "totalInterviews": total_interviews}), 200
        return jsonify({"openJobs": 0, "totalApplications": 0, "totalInterviews": 0}), 200
    except Exception as e:
        print(f"Error getting recruiter stats: {e}")
        return jsonify({"openJobs": 0, "totalApplications": 0, "totalInterviews": 0}), 200


# --- CHAT & REAL-TIME NOTIFICATIONS ---

@api_bp.route('/chats', methods=['GET'])
@require_auth
def get_chats():
    uid = request.user.get('uid')
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            seen_ids = set()
            chats = []
            # Query both fields — a user can appear in either candidateId or recruiterId
            # (same-role connections store one user in the "wrong" role field)
            for query_docs in [
                db.collection('chats').where('candidateId', '==', uid).stream(),
                db.collection('chats').where('recruiterId', '==', uid).stream(),
            ]:
                for doc in query_docs:
                    if doc.id not in seen_ids:
                        seen_ids.add(doc.id)
                        c = doc.to_dict()
                        c['id'] = doc.id
                        chats.append(c)
            return jsonify({"chats": chats}), 200

        return jsonify({"chats": []}), 200
    except Exception as e:
        print(f"Error getting chats: {e}")
        return jsonify({"chats": []}), 200

@api_bp.route('/chats', methods=['POST'])
@require_auth
def create_chat():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    candidate_id = data.get('candidateId')
    recruiter_id = data.get('recruiterId')
    job_id = data.get('jobId')
    job_title = data.get('jobTitle', '')
    candidate_name = data.get('candidateName', 'Candidate')
    recruiter_name = data.get('recruiterName', 'Recruiter')

    if not candidate_id or not recruiter_id or not job_id:
        return jsonify({"error": "Missing candidateId, recruiterId, or jobId"}), 400

    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            existing = list(db.collection('chats').where('candidateId', '==', candidate_id).where('recruiterId', '==', recruiter_id).where('jobId', '==', job_id).stream())
            if existing:
                c = existing[0].to_dict()
                c['id'] = existing[0].id
                return jsonify({"status": "success", "chat": c}), 200
            
            chat_data = {
                "candidateId": candidate_id,
                "recruiterId": recruiter_id,
                "jobId": job_id,
                "jobTitle": job_title,
                "candidateName": candidate_name,
                "recruiterName": recruiter_name,
                "lastMessage": "",
                "lastMessageTimestamp": ""
            }
            ref = db.collection('chats').add(chat_data)
            chat_data['id'] = ref[1].id
            return jsonify({"status": "success", "chat": chat_data}), 201

        return jsonify({"error": "Firebase not initialized — cannot create chat"}), 503
    except Exception as e:
        print(f"Error creating chat: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/chats/<chat_id>/messages', methods=['GET'])
@require_auth
def get_chat_messages(chat_id):
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            docs = db.collection('chats').document(chat_id).collection('messages').order_by('timestamp').stream()
            messages = []
            for doc in docs:
                m = doc.to_dict()
                m['id'] = doc.id
                messages.append(m)
            return jsonify({"messages": messages}), 200

        return jsonify({"messages": []}), 200
    except Exception as e:
        print(f"Error getting messages: {e}")
        return jsonify({"messages": []}), 200

@api_bp.route('/chats/<chat_id>/messages', methods=['POST'])
@require_auth
def send_chat_message(chat_id):
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    text = data.get('text')
    sender_id = data.get('senderId')
    sender_name = data.get('senderName', 'User')

    if not text or not sender_id:
        return jsonify({"error": "Missing text or senderId"}), 400

    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            msg_data = {
                "chatId": chat_id,
                "text": text,
                "senderId": sender_id,
                "senderName": sender_name,
                "timestamp": now_str
            }
            ref = db.collection('chats').document(chat_id).collection('messages').add(msg_data)
            msg_data['id'] = ref[1].id
            
            db.collection('chats').document(chat_id).update({
                "lastMessage": text,
                "lastMessageTimestamp": now_str
            })
            return jsonify({"status": "success", "message": msg_data}), 201

        return jsonify({"error": "Firebase not initialized — cannot send message"}), 503
    except Exception as e:
        print(f"Error sending message: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/notifications', methods=['GET'])
@require_auth
def get_notifications():
    uid  = request.user.get('uid')
    role = request.user.get('role', 'candidate')
    field = 'recruiterId' if role == 'recruiter' else 'candidateId'
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            docs = db.collection('notifications').where(field, '==', uid).stream()
            notifs = []
            for doc in docs:
                n = doc.to_dict()
                n['id'] = doc.id
                notifs.append(n)
            notifs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            return jsonify({"notifications": notifs[:20]}), 200
        return jsonify({"notifications": []}), 200
    except Exception as e:
        print(f"Error getting notifications: {e}")
        return jsonify({"notifications": []}), 200

@api_bp.route('/notifications/read-all', methods=['POST'])
@require_auth
def read_all_notifications():
    uid  = request.user.get('uid')
    role = request.user.get('role', 'candidate')
    field = 'recruiterId' if role == 'recruiter' else 'candidateId'
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            docs = db.collection('notifications').where(field, '==', uid).where('read', '==', False).stream()
            for doc in docs:
                db.collection('notifications').document(doc.id).update({"read": True})
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error reading notifications: {e}")
        return jsonify({"error": str(e)}), 500

# --- Phase 2: Community Trust & Salary Market Data Endpoints ---

@api_bp.route('/companies', methods=['GET'])
def get_companies():
    search_query = request.args.get('search', '').strip()
    try:
        from firebase_utils import db, firebase_initialized
        companies = []
        if firebase_initialized and db:
            docs = db.collection('companies').stream()
            for doc in docs:
                c = doc.to_dict()
                c['id'] = doc.id
                companies.append(c)

        if search_query:
            query_lower = search_query.lower()
            matches = [c for c in companies if query_lower in c.get('name', '').lower() or query_lower in c.get('industry', '').lower() or query_lower in c.get('location', '').lower()]
            if not matches and firebase_initialized and db:
                new_company = generate_company_profile_via_ai(search_query)
                if new_company:
                    db.collection('companies').document(new_company['id']).set(new_company)
                    matches = [new_company]
            return jsonify({"companies": matches}), 200

        return jsonify({"companies": companies}), 200
    except Exception as e:
        print(f"Error listing companies: {e}")
        return jsonify({"companies": []}), 200

@api_bp.route('/companies/<company_id>', methods=['GET'])
def get_company_details(company_id):
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            doc = db.collection('companies').document(company_id).get()
            if doc.exists:
                c = doc.to_dict()
                c['id'] = doc.id
                return jsonify({"company": c}), 200
        return jsonify({"error": "Company not found"}), 404
    except Exception as e:
        print(f"Error fetching company {company_id}: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/companies/<company_id>/reviews', methods=['GET'])
def get_company_reviews(company_id):
    try:
        from firebase_utils import db, firebase_initialized
        reviews = []
        if firebase_initialized and db:
            from firebase_admin import firestore
            docs = db.collection('companies').document(company_id).collection('reviews').order_by('timestamp', direction=firestore.Query.DESCENDING).stream()
            for doc in docs:
                r = doc.to_dict()
                r['id'] = doc.id
                reviews.append(r)

        if not reviews and firebase_initialized and db:
            comp_doc = db.collection('companies').document(company_id).get()
            if comp_doc.exists:
                company_name = comp_doc.to_dict().get('name')
                if company_name:
                    generated_reviews = generate_company_reviews_via_ai(company_id, company_name)
                    if generated_reviews:
                        for r in generated_reviews:
                            db.collection('companies').document(company_id).collection('reviews').add(r)
                        reviews = generated_reviews

        return jsonify({"reviews": reviews}), 200
    except Exception as e:
        print(f"Error listing reviews for {company_id}: {e}")
        return jsonify({"reviews": []}), 200

@api_bp.route('/companies/<company_id>/reviews', methods=['POST'])
@require_auth
def post_company_review(company_id):
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    rating = data.get('rating', 5)
    work_life = data.get('workLifeBalance', 5)
    comp = data.get('compensation', 5)
    text = data.get('reviewText', '')

    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    review_data = {
        "rating": rating,
        "workLifeBalance": work_life,
        "compensation": comp,
        "reviewText": text,
        "timestamp": now_str,
        "reviewerId": request.user.get('uid', 'anonymous_uid')
    }

    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            ref = db.collection('companies').document(company_id).collection('reviews').add(review_data)
            review_data['id'] = ref[1].id
            return jsonify({"status": "success", "review": review_data}), 201
        return jsonify({"error": "Firebase not initialized"}), 503
    except Exception as e:
        print(f"Error posting review: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/companies/<company_id>/qna', methods=['GET'])
def get_company_qna(company_id):
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            docs = db.collection('companies').document(company_id).collection('qna').order_by('timestamp', direction=firestore.Query.DESCENDING).stream()
            qna_list = []
            for doc in docs:
                q = doc.to_dict()
                q['id'] = doc.id
                qna_list.append(q)
            return jsonify({"qna": qna_list}), 200
        return jsonify({"qna": []}), 200
    except Exception as e:
        print(f"Error fetching QnA: {e}")
        return jsonify({"qna": []}), 200

@api_bp.route('/companies/<company_id>/qna', methods=['POST'])
@require_auth
def post_company_question(company_id):
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    question = data.get('question')
    answer = data.get('answer', '')
    asked_by = data.get('askedBy', 'Candidate')
    answered_by = data.get('answeredBy', '')

    if not question:
        return jsonify({"error": "Missing question text"}), 400

    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    qna_data = {
        "question": question,
        "answer": answer,
        "askedBy": asked_by,
        "answeredBy": answered_by,
        "timestamp": now_str
    }

    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            ref = db.collection('companies').document(company_id).collection('qna').add(qna_data)
            qna_data['id'] = ref[1].id
            return jsonify({"status": "success", "qna": qna_data}), 201
        return jsonify({"error": "Firebase not initialized"}), 503
    except Exception as e:
        print(f"Error posting QnA: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/stats/salaries', methods=['GET'])
def get_salary_stats():
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            docs = db.collection('salaries').stream()
            salaries = {doc.id: doc.to_dict() for doc in docs}
            return jsonify({"salaries": salaries}), 200
        return jsonify({"salaries": {}}), 200
    except Exception as e:
        print(f"Error fetching salaries: {e}")
        return jsonify({"salaries": {}}), 200

# --- Phase 3: Automated Job Ingestion Scale Crawler trigger endpoint ---
@api_bp.route('/jobs/crawl', methods=['POST'])
@require_auth
def trigger_crawler():
    try:
        count = crawl_jobs_to_db()
        return jsonify({"status": "success", "ingestedCount": count}), 200
    except Exception as e:
        print(f"Error triggering job crawler: {e}")
        return jsonify({"error": str(e)}), 500

# --- Phase 4: Webhook Dispatchers & Integrations Endpoints ---

def send_http_post(url, payload):
    try:
        import requests
        headers = {"Content-Type": "application/json"}
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        if 200 <= response.status_code < 300:
            print(f"[WEBHOOK SYNC SUCCESS] Event delivered to {url} - Status: {response.status_code}")
        else:
            print(f"[WEBHOOK SYNC ERROR] Failed delivering webhook event to {url} - Status: {response.status_code}")
    except Exception as err:
        print(f"[WEBHOOK SYNC ERROR] Failed delivering webhook event to {url}: {err}")

def dispatch_webhook_event_worker(event_type, event_payload):
    import datetime
    payload = {
        "event": event_type,
        "payload": event_payload,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }
    try:
        from firebase_utils import db, firebase_initialized
        urls = []
        if firebase_initialized and db:
            docs = db.collection('webhooks').stream()
            for doc in docs:
                data = doc.to_dict()
                if data.get('url'):
                    urls.append(data['url'])
        
        if not urls:
            print("[WEBHOOK DISPATCHER] No registered webhook URLs found. Skipping dispatch.")
            return

        print(f"[WEBHOOK DISPATCHER] Dispatching '{event_type}' to {len(urls)} registered URLs...")
        import threading
        for url in urls:
            thread = threading.Thread(target=send_http_post, args=(url, payload), daemon=True)
            thread.start()
    except Exception as e:
        print(f"Error dispatching webhook event in background thread: {e}")

def dispatch_webhook_event(event_type, event_payload):
    """
    Spawns asynchronous background thread to query webhook URLs and dispatch payloads.
    """
    import threading
    thread = threading.Thread(target=dispatch_webhook_event_worker, args=(event_type, event_payload), daemon=True)
    thread.start()

@api_bp.route('/webhooks/subscriptions', methods=['GET'])
@require_auth
def get_webhook_subscriptions():
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            docs = db.collection('webhooks').stream()
            subs = []
            for doc in docs:
                d = doc.to_dict()
                d['id'] = doc.id
                subs.append(d)
            return jsonify({"subscriptions": subs}), 200
        return jsonify({"subscriptions": []}), 200
    except Exception as e:
        print(f"Error listing webhook subscriptions: {e}")
        return jsonify({"subscriptions": []}), 200

@api_bp.route('/webhooks/subscribe', methods=['POST'])
@require_auth
def subscribe_webhook_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    url = data.get('url')
    description = data.get('description', 'Third-party ATS webhook endpoint')

    if not url:
        return jsonify({"error": "Missing URL parameter"}), 400

    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    sub_data = {
        "url": url,
        "description": description,
        "createdAt": now_str,
        "creatorId": request.user.get('uid', 'anonymous_recruiter')
    }

    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            ref = db.collection('webhooks').add(sub_data)
            sub_data['id'] = ref[1].id
            return jsonify({"status": "success", "subscription": sub_data}), 201
        return jsonify({"error": "Firebase not available"}), 503
    except Exception as e:
        print(f"Error subscribing webhook: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/webhooks/test-ping', methods=['POST'])
@require_auth
def test_ping_webhook():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    url = data.get('url')

    if not url:
        return jsonify({"error": "Missing URL parameter"}), 400

    payload = {
        "event": "webhook.test_ping",
        "payload": {
            "message": "CareerCraft Webhook Connection Established Successfully!",
            "sender": "CareerCraft Ecosystem Engine"
        },
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }

    try:
        # Launch inline or in thread to test response
        import threading
        thread = threading.Thread(target=send_http_post, args=(url, payload), daemon=True)
        thread.start()
        return jsonify({"status": "success", "message": f"Simulated ping event dispatched to {url}."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Phase 5: Ecosystem Network, User Search, & Connections Endpoints ---

@api_bp.route('/users', methods=['GET'])
@require_auth
def get_users():
    search_query = request.args.get('search', '').strip().lower()
    role_filter = request.args.get('role', '').strip().lower()
    current_uid = request.user.get('uid', 'anonymous')

    users_list = []
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            def _mask_email(addr):
                # jane.doe@gmail.com -> j•••@gmail.com — enough to disambiguate,
                # not enough to harvest. Full contact info is only shared after
                # a connection is accepted.
                if not addr or '@' not in addr:
                    return ''
                local, _, domain = addr.partition('@')
                return f"{local[0]}•••@{domain}"

            docs = db.collection('users').stream()
            for doc in docs:
                u = doc.to_dict()
                uid = u.get('uid')
                if uid == current_uid:
                    continue  # Exclude self
                full_email = u.get('email', '')
                u_data = {
                    "uid": uid,
                    "fullName": u.get('fullName', 'Anonymous User'),
                    # PRIVACY: never expose raw email/phone in the public
                    # directory. Search still matches on the full email below.
                    "email": _mask_email(full_email),
                    "role": u.get('role', 'candidate'),
                }

                # Apply filters
                if role_filter and u_data['role'].lower() != role_filter:
                    continue
                if search_query:
                    name = u_data['fullName'].lower()
                    if search_query not in name and search_query not in full_email.lower():
                        continue
                    users_list.append(u_data)
                else:
                    users_list.append(u_data)
        return jsonify({"users": users_list}), 200
    except Exception as e:
        print(f"Error listing users: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/connections/request', methods=['POST'])
@require_auth
def request_connection():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    receiver_id = data.get('receiverId')
    current_uid = request.user.get('uid', 'anonymous')

    if not receiver_id:
        return jsonify({"error": "Missing receiverId parameter"}), 400

    if receiver_id == current_uid:
        return jsonify({"error": "Cannot connect with yourself"}), 400

    try:
        from firebase_utils import db, firebase_initialized
        sender_name = "Ecosystem Member"
        sender_email = ""
        sender_role = "candidate"
        receiver_name = "Ecosystem Member"
        receiver_email = ""
        receiver_role = "candidate"

        # Fetch sender and receiver profiles to populate names/details
        if firebase_initialized and db:
            # Check existing connection
            existing_ref1 = list(db.collection('connections').where('senderId', '==', current_uid).where('receiverId', '==', receiver_id).stream())
            existing_ref2 = list(db.collection('connections').where('senderId', '==', receiver_id).where('receiverId', '==', current_uid).stream())
            if existing_ref1 or existing_ref2:
                return jsonify({"error": "Connection request already exists or is active between these users"}), 400

            sender_doc = db.collection('users').document(current_uid).get()
            if sender_doc.exists:
                s_data = sender_doc.to_dict()
                sender_name = s_data.get('fullName', sender_name)
                sender_email = s_data.get('email', sender_email)
                sender_role = s_data.get('role', sender_role)

            receiver_doc = db.collection('users').document(receiver_id).get()
            if receiver_doc.exists:
                r_data = receiver_doc.to_dict()
                receiver_name = r_data.get('fullName', receiver_name)
                receiver_email = r_data.get('email', receiver_email)
                receiver_role = r_data.get('role', receiver_role)
        else:
            return jsonify({"error": "Firebase not initialized — cannot request connection"}), 503

        now_str = datetime.datetime.utcnow().isoformat() + "Z"
        conn_data = {
            "senderId": current_uid,
            "senderName": sender_name,
            "senderEmail": sender_email,
            "senderRole": sender_role,
            "receiverId": receiver_id,
            "receiverName": receiver_name,
            "receiverEmail": receiver_email,
            "receiverRole": receiver_role,
            "status": "pending",
            "createdAt": now_str,
            "updatedAt": now_str
        }

        if firebase_initialized and db:
            ref = db.collection('connections').add(conn_data)
            conn_data['id'] = ref[1].id
            
            # Send Notification to receiver
            notif = {
                "candidateId": receiver_id,
                "title": "Connection Invitation",
                "message": f"{sender_name} wants to connect with you and start a conversation.",
                "timestamp": now_str,
                "read": False
            }
            db.collection('notifications').add(notif)

        # Email the receiver regardless of Firebase mode
        if receiver_email:
            send_connection_request_email(
                to=receiver_email,
                recipient_name=receiver_name,
                sender_name=sender_name,
                sender_role=sender_role,
            )

        return jsonify({"status": "success", "connection": conn_data}), 201
    except Exception as e:
        print(f"Error requesting connection: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/connections', methods=['GET'])
@require_auth
def get_connections():
    current_uid = request.user.get('uid', 'anonymous')
    conns = []

    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            # Query sent requests
            docs1 = db.collection('connections').where('senderId', '==', current_uid).stream()
            for doc in docs1:
                d = doc.to_dict()
                d['id'] = doc.id
                conns.append(d)
            # Query received requests
            docs2 = db.collection('connections').where('receiverId', '==', current_uid).stream()
            for doc in docs2:
                d = doc.to_dict()
                d['id'] = doc.id
                conns.append(d)
        return jsonify({"connections": conns}), 200
    except Exception as e:
        print(f"Error listing connections: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/connections/<connection_id>/respond', methods=['POST'])
@require_auth
def respond_connection(connection_id):
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.json
    status = data.get('status') # 'accepted' or 'declined'
    current_uid = request.user.get('uid', 'anonymous')

    if status not in ['accepted', 'declined']:
        return jsonify({"error": "Invalid status value. Must be 'accepted' or 'declined'"}), 400

    try:
        from firebase_utils import db, firebase_initialized
        conn_data = None
        
        if firebase_initialized and db:
            ref = db.collection('connections').document(connection_id)
            snap = ref.get()
            if not snap.exists:
                return jsonify({"error": "Connection record not found"}), 404
            conn_data = snap.to_dict()
        else:
            return jsonify({"error": "Firebase not initialized — cannot respond to connection"}), 503

        # Ensure only the receiver can respond
        if conn_data.get('receiverId') != current_uid:
            return jsonify({"error": "Unauthorized to respond to this connection request"}), 403

        now_str = datetime.datetime.utcnow().isoformat() + "Z"
        conn_data['status'] = status
        conn_data['updatedAt'] = now_str

        sender_id = conn_data['senderId']
        sender_name = conn_data['senderName']
        receiver_name = conn_data['receiverName']

        if firebase_initialized and db:
            db.collection('connections').document(connection_id).update({
                "status": status,
                "updatedAt": now_str
            })

            # Create notification for sender
            notif = {
                "candidateId": sender_id,
                "title": "Connection Accepted" if status == 'accepted' else "Connection Request Update",
                "message": f"{receiver_name} has accepted your connection request!" if status == 'accepted' else f"{receiver_name} declined your connection request.",
                "timestamp": now_str,
                "read": False
            }
            db.collection('notifications').add(notif)

            if status == 'accepted':
                # Create Direct Chat Room
                candidate_id = sender_id if conn_data['senderRole'] == 'candidate' else current_uid
                recruiter_id = sender_id if conn_data['senderRole'] == 'recruiter' else current_uid
                cand_name = sender_name if conn_data['senderRole'] == 'candidate' else receiver_name
                rec_name = sender_name if conn_data['senderRole'] == 'recruiter' else receiver_name

                # Check if existing chat exists for "connection_chat"
                existing = list(db.collection('chats').where('candidateId', '==', candidate_id).where('recruiterId', '==', recruiter_id).where('jobId', '==', 'connection_chat').stream())
                if not existing:
                    chat_data = {
                        "candidateId": candidate_id,
                        "recruiterId": recruiter_id,
                        "jobId": "connection_chat",
                        "jobTitle": "Direct Connection",
                        "candidateName": cand_name,
                        "recruiterName": rec_name,
                        "lastMessage": "You are now connected! Start chatting.",
                        "lastMessageTimestamp": now_str
                    }
                    chat_ref = db.collection('chats').add(chat_data)
                    new_chat_id = chat_ref[1].id
                    
                    # Create initial message in chat
                    msg_data = {
                        "senderId": "system",
                        "senderName": "System",
                        "text": "Connection established. You can now message each other directly.",
                        "timestamp": now_str,
                        "chatId": new_chat_id
                    }
                    db.collection('chats').document(new_chat_id).collection('messages').add(msg_data)

        # Email the original sender when their request is accepted
        if status == 'accepted':
            sender_email = conn_data.get('senderEmail', '')
            if sender_email:
                send_connection_accepted_email(
                    to=sender_email,
                    sender_name=sender_name,
                    acceptor_name=receiver_name,
                )

        return jsonify({"status": "success", "message": f"Connection {status} successfully."}), 200
    except Exception as e:
        print(f"Error responding to connection request: {e}")
        return jsonify({"error": str(e)}), 500


# =============================================================================
# JOB ALERTS
# =============================================================================

@api_bp.route('/job-alerts', methods=['GET'])
@require_auth
def get_job_alerts():
    uid = request.user.get('uid')
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            docs = db.collection('jobAlerts').where('userId', '==', uid).stream()
            alerts = [{'id': d.id, **d.to_dict()} for d in docs]
        else:
            alerts = []
        return jsonify({'alerts': alerts}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/job-alerts', methods=['POST'])
@require_auth
def create_job_alert():
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    uid = request.user.get('uid')
    data = request.json
    keywords = data.get('keywords', '').strip()
    location = data.get('location', '').strip()
    job_type = data.get('jobType', '')
    if not keywords:
        return jsonify({'error': 'keywords is required'}), 400
    now_str = datetime.datetime.utcnow().isoformat() + 'Z'
    alert = {
        'userId': uid,
        'keywords': keywords,
        'location': location,
        'jobType': job_type,
        'createdAt': now_str,
        'active': True,
    }
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            ref = db.collection('jobAlerts').add(alert)
            alert['id'] = ref[1].id
            return jsonify({'status': 'created', 'alert': alert}), 201
        return jsonify({'error': 'Firebase not available'}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/job-alerts/<alert_id>', methods=['DELETE'])
@require_auth
def delete_job_alert(alert_id):
    uid = request.user.get('uid')
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            ref = db.collection('jobAlerts').document(alert_id)
            doc = ref.get()
            if not doc.exists or doc.to_dict().get('userId') != uid:
                return jsonify({'error': 'Not found'}), 404
            ref.delete()
        else:
            return jsonify({'error': 'Firebase not available'}), 503
        return jsonify({'status': 'deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# PROFILE COMPLETION
# =============================================================================

def _calc_completion(user_data: dict, resume_exists: bool) -> dict:
    """Return a completion score and list of missing items."""
    checks = {
        'Name': bool(user_data.get('fullName') or user_data.get('name')),
        'Email': bool(user_data.get('email')),
        'Phone': bool(user_data.get('phone')),
        'Location': bool(user_data.get('location')),
        'Bio / Summary': bool(user_data.get('bio') or user_data.get('summary')),
        'Resume uploaded': resume_exists,
        'API key in vault': bool(user_data.get('apiKeysWallet')),
        'Profile picture': bool(user_data.get('profilePicture') or user_data.get('avatar')),
    }
    completed = sum(1 for v in checks.values() if v)
    score = round(completed / len(checks) * 100)
    missing = [k for k, v in checks.items() if not v]
    return {'score': score, 'completed': completed, 'total': len(checks), 'missing': missing}


@api_bp.route('/users/<uid>/completion', methods=['GET'])
@require_auth
def get_profile_completion(uid):
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            user_doc = db.collection('users').document(uid).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
            resume_exists = db.collection('resumes').document(uid).get().exists
        else:
            user_data = {}
            resume_exists = False
        result = _calc_completion(user_data, resume_exists)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# EMAIL OTP — signup verification via Resend
# =============================================================================

@api_bp.route('/auth/send-email-otp', methods=['POST'])
def send_email_otp_route():
    import secrets as _secrets
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    name = data.get('name', 'User')

    if not email or '@' not in email:
        return jsonify({"error": "Valid email required"}), 400

    otp = ''.join([str(_secrets.randbelow(10)) for _ in range(6)])

    from firebase_utils import db, firebase_initialized
    if firebase_initialized and db:
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)
        doc_id = email.replace('@', '_at_').replace('.', '_dot_')
        db.collection('email_otps').document(doc_id).set({
            'email': email,
            'code': otp,
            'expires_at': expires_at,
            'attempts': 0,
        })

    from email_utils import send_2fa_otp_email
    send_2fa_otp_email(email, name, otp)

    return jsonify({"success": True}), 200


@api_bp.route('/auth/verify-email-otp', methods=['POST'])
def verify_email_otp_route():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()

    if not email or not code:
        return jsonify({"error": "Email and code required"}), 400

    from firebase_utils import db, firebase_initialized

    if not firebase_initialized or not db:
        if code == '123456':
            return jsonify({"success": True}), 200
        return jsonify({"error": "Invalid code"}), 400

    doc_id = email.replace('@', '_at_').replace('.', '_dot_')
    doc_ref = db.collection('email_otps').document(doc_id)
    doc = doc_ref.get()

    if not doc.exists:
        return jsonify({"error": "No OTP found. Please request a new code."}), 404

    otp_data = doc.to_dict()
    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = otp_data.get('expires_at')
    if expires_at and now > expires_at:
        doc_ref.delete()
        return jsonify({"error": "OTP expired. Please request a new one."}), 410

    attempts = otp_data.get('attempts', 0)
    if attempts >= 5:
        doc_ref.delete()
        return jsonify({"error": "Too many attempts. Please request a new code."}), 429

    if otp_data.get('code') != code:
        doc_ref.update({'attempts': attempts + 1})
        return jsonify({"error": "Incorrect code. Please try again."}), 400

    doc_ref.delete()
    return jsonify({"success": True}), 200


# =============================================================================
# TWO-FACTOR AUTHENTICATION (TOTP)
# =============================================================================

@api_bp.route('/auth/2fa/setup', methods=['POST'])
@require_auth
def setup_2fa():
    """Generate a TOTP secret and provisioning URI for the user."""
    import pyotp
    uid = request.user.get('uid')
    try:
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            user_doc = db.collection('users').document(uid).get()
            user_email = user_doc.to_dict().get('email', uid) if user_doc.exists else uid
        else:
            user_email = uid
        uri = totp.provisioning_uri(name=user_email, issuer_name='CareerCraft')
        # Store secret temporarily (unverified) — confirmed on /verify
        if firebase_initialized and db:
            db.collection('users').document(uid).set({'totp_secret_pending': secret}, merge=True)
        return jsonify({'secret': secret, 'uri': uri}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/auth/2fa/verify', methods=['POST'])
@require_auth
def verify_2fa_setup():
    """Verify the OTP entered by the user and activate 2FA."""
    import pyotp
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    uid = request.user.get('uid')
    otp = request.json.get('otp', '')
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            user_doc = db.collection('users').document(uid).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
        else:
            user_data = {}
        secret = user_data.get('totp_secret_pending', '')
        if not secret:
            return jsonify({'error': '2FA setup not initiated'}), 400
        totp = pyotp.TOTP(secret)
        if not totp.verify(otp, valid_window=1):
            return jsonify({'error': 'Invalid OTP — please try again'}), 401
        # Promote pending secret to active
        if firebase_initialized and db:
            db.collection('users').document(uid).set({
                'totp_secret': secret,
                'totp_secret_pending': None,
                'twoFactorEnabled': True,
            }, merge=True)
        return jsonify({'status': 'enabled', 'message': '2FA successfully activated'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/auth/2fa/validate', methods=['POST'])
@require_auth
def validate_2fa():
    """Validate a TOTP code during login (call after primary auth succeeds)."""
    import pyotp
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    uid = request.user.get('uid')
    otp = request.json.get('otp', '')
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            user_doc = db.collection('users').document(uid).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
        else:
            return jsonify({'valid': True}), 200  # bypass in mock mode
        secret = user_data.get('totp_secret', '')
        if not secret:
            return jsonify({'valid': True}), 200   # 2FA not enabled — allow through
        totp = pyotp.TOTP(secret)
        valid = totp.verify(otp, valid_window=1)
        return jsonify({'valid': valid}), 200 if valid else 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/auth/2fa/disable', methods=['POST'])
@require_auth
def disable_2fa():
    """Remove TOTP from the account after verifying a valid OTP."""
    import pyotp
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    uid = request.user.get('uid')
    otp = request.json.get('otp', '')
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            user_doc = db.collection('users').document(uid).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
            secret = user_data.get('totp_secret', '')
            if not secret:
                return jsonify({'error': '2FA is not enabled'}), 400
            totp = pyotp.TOTP(secret)
            if not totp.verify(otp, valid_window=1):
                return jsonify({'error': 'Invalid OTP'}), 401
            db.collection('users').document(uid).set({
                'totp_secret': None,
                'twoFactorEnabled': False,
            }, merge=True)
        return jsonify({'status': 'disabled'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Email OTP verification ───────────────────────────────────────────────────

@api_bp.route('/auth/send-email-otp', methods=['POST'])
def send_email_otp():
    """Generate a 6-digit OTP, store it in Firestore, and email it to the user."""
    from firebase_utils import db, firebase_initialized
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    name  = data.get('name',  'User').strip()
    if not email:
        return jsonify({'error': 'Email is required'}), 400

    otp    = ''.join(random.choices(string.digits, k=6))
    expiry = datetime.datetime.now(timezone.utc) + timedelta(minutes=10)

    if firebase_initialized and db:
        try:
            db.collection('_otps').document(email).set({
                'otp': otp,
                'expiry': expiry,
                'attempts': 0,
            })
        except Exception as e:
            return jsonify({'error': f'Could not store OTP: {e}'}), 500
    else:
        _otp_store[email] = {'otp': otp, 'expiry': expiry}

    try:
        send_2fa_otp_email(email, name, otp)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': f'Failed to send email: {e}'}), 500


@api_bp.route('/auth/verify-email-otp', methods=['POST'])
def verify_email_otp():
    """Verify a 6-digit email OTP. Deletes the record on success."""
    from firebase_utils import db, firebase_initialized
    data  = request.json or {}
    email = data.get('email', '').strip().lower()
    otp   = data.get('otp',   '').strip()
    if not email or not otp:
        return jsonify({'error': 'Email and OTP are required'}), 400

    now = datetime.datetime.now(timezone.utc)

    if firebase_initialized and db:
        try:
            ref = db.collection('_otps').document(email)
            doc = ref.get()
            if not doc.exists:
                return jsonify({'error': 'No code found — please request a new one'}), 400
            stored = doc.to_dict()
            expiry = stored.get('expiry')
            if expiry and expiry < now:
                ref.delete()
                return jsonify({'error': 'Code expired — please request a new one'}), 400
            if stored.get('otp') != otp:
                return jsonify({'error': 'Incorrect code — please try again'}), 400
            ref.delete()
            return jsonify({'verified': True})
        except Exception as e:
            return jsonify({'error': f'Verification error: {e}'}), 500
    else:
        stored = _otp_store.get(email)
        if not stored:
            return jsonify({'error': 'No code found'}), 400
        if stored['otp'] != otp:
            return jsonify({'error': 'Incorrect code'}), 400
        if stored['expiry'] < now:
            return jsonify({'error': 'Code expired'}), 400
        del _otp_store[email]
        return jsonify({'verified': True})


# ── Smart Apply ───────────────────────────────────────────────────────────────

def _filter_relevant_jobs(job_list, role_terms, loc):
    """Keep only jobs matching the requested roles + location.

    Free sources (Arbeitnow especially) ignore or weakly apply their search
    param and return unrelated roles. Enforce relevance server-side so the
    user's role and location filters actually mean something.
    """
    import re as _re3
    _generic = {
        'developer', 'engineer', 'engineering', 'manager', 'designer', 'analyst',
        'architect', 'consultant', 'specialist', 'lead', 'senior', 'junior',
        'intern', 'internship', 'staff', 'principal', 'associate',
    }
    _skip = {'the', 'and', 'for', 'with', 'role', 'position', 'a', 'an', 'of',
             'remote', 'onsite', 'hybrid', 'contract', 'part', 'time', 'full'}

    role_kw = []  # (specific_terms, generic_terms) per role
    for _r in role_terms:
        words = [w.lower() for w in _re3.findall(r"[a-zA-Z][a-zA-Z0-9#+.]*", str(_r))]
        spec = [w for w in words if w not in _generic and w not in _skip and len(w) > 1]
        gen  = [w for w in words if w in _generic]
        if spec or gen:
            role_kw.append((spec, gen))
    if not role_kw:
        return job_list

    loc_l = (loc or '').lower()
    want_remote = loc_l in ('remote', 'anywhere', 'worldwide', '')

    kept = []
    for _j in job_list:
        title = (_j.get('title') or '').lower()
        tags  = ' '.join(str(t) for t in (_j.get('tags') or [])).lower()
        desc  = (_j.get('description') or '').lower()
        body_txt = f"{tags} {desc}"

        role_ok = False
        for spec, gen in role_kw:
            title_spec = any(w in title for w in spec)
            # A title counts as "generic role match" if it contains the role's own
            # generic words OR any common role noun (engineer/developer/etc.) —
            # e.g. "Frontend Engineer" should match a "React Developer" search
            # when React appears in the tags/description.
            title_gen  = any(w in title for w in gen) or any(w in title for w in _generic)
            body_spec  = any(w in body_txt for w in spec)
            # A specific term in the title is a strong match; a generic title
            # word ("developer") needs a specific term somewhere in the body.
            if title_spec or (title_gen and (body_spec or not spec)):
                role_ok = True
                break
        if not role_ok:
            continue

        jloc = (_j.get('location') or '').lower()
        if want_remote:
            loc_ok = 'remote' in jloc or 'anywhere' in jloc or 'worldwide' in jloc
        else:
            loc_ok = (not jloc) or loc_l in jloc or 'remote' in jloc
        if not loc_ok:
            continue

        kept.append(_j)
    return kept



@api_bp.route('/smart-apply/search', methods=['POST'])
@require_auth
def smart_apply_search():
    """Scrape jobs from RemoteOK + Indeed; cache results in shared Firestore pool."""
    from firebase_utils import db
    from datetime import datetime as _dt

    uid      = getattr(request, 'uid', None)
    body     = request.get_json() or {}
    roles    = [r.strip() for r in body.get('roles', []) if str(r).strip()]
    query    = body.get('query', '').strip()
    # Build combined query from roles list or fall back to plain query field
    if roles:
        query = ' OR '.join(roles)
    elif not query:
        query = ''
    location = body.get('location', 'Remote').strip() or 'Remote'
    sources  = body.get('sources', ['remoteok', 'indeed', 'linkedin'])

    # Retrieve the user's Apify key from their encrypted vault wallet.
    import ollama_utils as _ou
    from vault_utils import decrypt_key as _vault_decrypt
    _wallet    = _ou.get_request_wallet() or []
    _apify_e   = next((e for e in _wallet if e.get('provider') == 'Apify'
                       and e.get('status') not in ('Invalid', 'Exhausted')), None)
    apify_key  = ''
    if _apify_e:
        _enc = _apify_e.get('encryptedKey', '')
        try:
            apify_key = _vault_decrypt(_enc) if _enc else _apify_e.get('key', '')
        except Exception:
            apify_key = _apify_e.get('key', '')

    if not query:
        return jsonify({'error': 'Search query is required'}), 400

    # Cache key based on all roles (or query) + location
    roles_key  = '_'.join(r.lower().replace(' ', '_') for r in roles) if roles else query.lower().replace(' ', '_')
    search_key = f"{roles_key}_{location.lower().replace(' ', '_')}"

    # ── Firestore cache check (< 24 h) ──────────────────────────────────────
    # Query by search_key only (single-field index, no composite needed).
    # Filter by age in Python to avoid the composite index requirement.
    if db:
        try:
            cutoff = _dt.utcnow() - timedelta(hours=24)
            cached_docs = (
                db.collection('scraped_jobs')
                  .where('search_key', '==', search_key)
                  .limit(60)
                  .stream()
            )
            cached = []
            for doc in cached_docs:
                d = doc.to_dict()
                sat = d.get('scraped_at')
                # Accept Firestore Timestamp or Python datetime; skip stale docs
                if sat is not None:
                    sat_dt = sat if isinstance(sat, _dt) else getattr(sat, 'datetime', None)
                    if sat_dt and sat_dt.replace(tzinfo=None) < cutoff:
                        continue
                if hasattr(sat, 'isoformat'):
                    d['scraped_at'] = sat.isoformat()
                cached.append({'id': doc.id, **d})
            if cached:
                # Cached docs may predate the relevance filter — re-apply it.
                cached = _filter_relevant_jobs(cached, roles or [query], location)
                if cached:
                    return jsonify({'jobs': cached, 'cached': True, 'count': len(cached)})
        except Exception as _cache_err:
            print(f'Cache check skipped: {_cache_err}')

    jobs = []

    # ── Arbeitnow (free public API, no auth) ─────────────────────────────────
    if 'arbeitnow' in sources:
        try:
            _seen_arbeit = set()
            for _role in (roles or [query])[:3]:
                try:
                    resp = _requests_lib.get(
                        'https://www.arbeitnow.com/api/job-board-api',
                        params={'search': _role, 'page': 1},
                        headers={'Accept': 'application/json', 'User-Agent': 'CareerCraft/1.0'},
                        timeout=15,
                    )
                    if resp.ok:
                        for j in resp.json().get('data', [])[:15]:
                            _jurl = j.get('url', '')
                            if not _jurl or _jurl in _seen_arbeit:
                                continue
                            _seen_arbeit.add(_jurl)
                            jobs.append({
                                'title':       j.get('title', ''),
                                'company':     j.get('company_name', ''),
                                'location':    'Remote' if j.get('remote') else (j.get('location') or location),
                                'salary':      '',
                                'description': (j.get('description') or '')[:600],
                                'url':         _jurl,
                                'source':      'arbeitnow',
                                'tags':        j.get('tags', []),
                                'logo':        j.get('logo', ''),
                            })
                except Exception:
                    pass
        except Exception as e:
            print(f'Arbeitnow error: {e}')

    # ── Jobicy (free public API, remote jobs, no auth) ────────────────────────
    # Jobicy uses `tag` (single keyword) not `keyword` — extract tech terms
    if 'jobicy' in sources:
        try:
            import re as _re2
            _jcy_stopwords = {
                'senior', 'junior', 'mid', 'level', 'developer', 'engineer', 'software',
                'full', 'stack', 'web', 'mobile', 'lead', 'staff', 'principal', 'the',
                'and', 'for', 'with', 'role', 'position', 'remote', 'contract',
                'backend', 'frontend', 'devops', 'manager', 'architect',
            }
            _jcy_tags = []
            _jcy_seen_tags = set()
            for _role in (roles or [query]):
                for _w in _re2.findall(r'\b[a-zA-Z][a-zA-Z0-9#+.]*\b', _role):
                    _wl = _w.lower()
                    if _wl not in _jcy_stopwords and len(_wl) > 1 and _wl not in _jcy_seen_tags:
                        _jcy_seen_tags.add(_wl)
                        _jcy_tags.append(_wl)

            _seen_jobicy = set()
            # Try each extracted tag; fall back to unfiltered if none found
            for _tag in (_jcy_tags[:4] if _jcy_tags else [None]):
                try:
                    params = {'count': 20}
                    if _tag:
                        params['tag'] = _tag
                    resp = _requests_lib.get(
                        'https://jobicy.com/api/v2/remote-jobs',
                        params=params,
                        headers={'Accept': 'application/json'},
                        timeout=15,
                    )
                    if resp.ok:
                        data = resp.json()
                        job_list = data.get('jobs', []) if isinstance(data, dict) else []
                        for j in job_list[:15]:
                            _jurl = j.get('url') or j.get('jobUrl', '')
                            if not _jurl or _jurl in _seen_jobicy:
                                continue
                            _seen_jobicy.add(_jurl)
                            salary = ''
                            if j.get('annualSalaryMin'):
                                salary = f"${j['annualSalaryMin']:,}–${j.get('annualSalaryMax', j['annualSalaryMin']):,}"
                            jobs.append({
                                'title':       j.get('jobTitle', '') or j.get('title', ''),
                                'company':     j.get('companyName', '') or j.get('company', ''),
                                'location':    j.get('jobGeo', 'Remote') or 'Remote',
                                'salary':      salary,
                                'description': (j.get('jobExcerpt') or j.get('jobDescription') or j.get('description') or '')[:600],
                                'url':         _jurl,
                                'source':      'jobicy',
                                'tags':        [j['jobType']] if j.get('jobType') else [],
                                'logo':        j.get('companyLogo', ''),
                            })
                        if len(_seen_jobicy) >= 15:
                            break
                except Exception:
                    pass
        except Exception as e:
            print(f'Jobicy error: {e}')

    # ── crawl4ai: async AI-powered web crawler ───────────────────────────────
    # Accepts a list of direct company career page URLs via the `career_urls` field
    if 'crawl4ai' in sources:
        career_urls = body.get('career_urls', [])
        if career_urls:
            try:
                from crawl4ai import AsyncWebCrawler
                from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
                import asyncio as _asyncio

                schema = {
                    'name': 'jobs',
                    'baseSelector': 'a, [class*="job"], [class*="position"], [class*="opening"]',
                    'fields': [
                        {'name': 'title',   'selector': 'h2, h3, h4, [class*="title"], [class*="role"]',   'type': 'text'},
                        {'name': 'company', 'selector': '[class*="company"], [class*="employer"]',          'type': 'text'},
                        {'name': 'url',     'selector': 'a',                                               'type': 'attribute', 'attribute': 'href'},
                        {'name': 'location','selector': '[class*="location"], [class*="city"]',             'type': 'text'},
                    ]
                }
                strategy = JsonCssExtractionStrategy(schema, verbose=False)

                async def _crawl_careers():
                    _c4_jobs = []
                    async with AsyncWebCrawler(verbose=False) as crawler:
                        for _curl in career_urls[:5]:
                            try:
                                result = await crawler.arun(url=_curl, extraction_strategy=strategy)
                                if result.success and result.extracted_content:
                                    import json as _json
                                    _extracted = _json.loads(result.extracted_content) if isinstance(result.extracted_content, str) else result.extracted_content
                                    for _j in (_extracted if isinstance(_extracted, list) else [])[:10]:
                                        _jurl = _j.get('url', '')
                                        if _jurl and not _jurl.startswith('http'):
                                            from urllib.parse import urljoin
                                            _jurl = urljoin(_curl, _jurl)
                                        if not _jurl:
                                            continue
                                        _c4_jobs.append({
                                            'title':       _j.get('title', 'Open Position'),
                                            'company':     _j.get('company', ''),
                                            'location':    _j.get('location', location),
                                            'salary':      '',
                                            'description': '',
                                            'url':         _jurl,
                                            'source':      'crawl4ai',
                                            'tags':        [],
                                            'logo':        '',
                                        })
                            except Exception as _ce:
                                print(f'crawl4ai error for {_curl}: {_ce}')
                    return _c4_jobs

                _c4_results = _asyncio.run(_crawl_careers())
                jobs.extend(_c4_results)
            except Exception as e:
                print(f'crawl4ai error: {e}')

    # ── Firecrawl: high-quality content extraction (BYOK) ────────────────────
    if 'firecrawl' in sources:
        try:
            _fc_e = next((e for e in _wallet if e.get('provider') == 'Firecrawl'
                          and e.get('status') not in ('Invalid', 'Exhausted')), None)
            if _fc_e:
                _fc_key = _vault_decrypt(_fc_e.get('encryptedKey', '')) if _fc_e.get('encryptedKey') else _fc_e.get('key', '')
                if _fc_key:
                    from firecrawl import FirecrawlApp
                    _fc = FirecrawlApp(api_key=_fc_key)
                    for _role in (roles or [query])[:2]:
                        try:
                            # Use Firecrawl's search (maps + scrape career pages)
                            _fc_result = _fc.search(
                                f'site:jobs.lever.co OR site:boards.greenhouse.io {_role} {location}',
                                limit=10,
                            )
                            for _r in (_fc_result.get('data', []) if isinstance(_fc_result, dict) else []):
                                _furl = _r.get('url', '')
                                if not _furl:
                                    continue
                                jobs.append({
                                    'title':       _r.get('title', _role),
                                    'company':     '',
                                    'location':    location,
                                    'salary':      '',
                                    'description': (_r.get('markdown') or _r.get('content') or '')[:600],
                                    'url':         _furl,
                                    'source':      'firecrawl',
                                    'tags':        [],
                                    'logo':        '',
                                })
                        except Exception as _fce:
                            print(f'Firecrawl search error: {_fce}')
        except Exception as e:
            print(f'Firecrawl error: {e}')

    # ── RemoteOK public JSON API ─────────────────────────────────────────────
    if 'remoteok' in sources:
        try:
            import re as _re
            # RemoteOK uses single-keyword tags — extract tech terms from each role
            _stopwords = {
                'senior', 'junior', 'mid', 'level', 'developer', 'engineer', 'software',
                'full', 'stack', 'web', 'mobile', 'lead', 'staff', 'principal', 'the',
                'and', 'for', 'with', 'role', 'position', 'remote', 'contract', 'part',
                'time', 'full', 'backend', 'frontend', 'devops',
            }
            _seen_tags = set()
            _tag_queue = []
            for _role in (roles or [query]):
                for _word in _re.findall(r'\b[a-zA-Z][a-zA-Z0-9#+.]*\b', _role):
                    _w = _word.lower()
                    if _w not in _stopwords and len(_w) > 1 and _w not in _seen_tags:
                        _seen_tags.add(_w)
                        _tag_queue.append(_w)

            _rok_seen = set()
            for _tag in _tag_queue[:5]:  # try up to 5 keywords
                try:
                    resp = _requests_lib.get(
                        f'https://remoteok.com/api?tag={_tag}',
                        headers={'User-Agent': 'CareerCraft-JobScout/1.0'},
                        timeout=10,
                    )
                    if resp.ok:
                        data = resp.json()
                        items = data[1:] if isinstance(data, list) and len(data) > 1 else []
                        for j in items[:20]:
                            _jid = str(j.get('id', ''))
                            if _jid in _rok_seen:
                                continue
                            _rok_seen.add(_jid)
                            jobs.append({
                                'title':       j.get('position', ''),
                                'company':     j.get('company', ''),
                                'location':    'Remote',
                                'salary':      j.get('salary', ''),
                                'description': (j.get('description') or '')[:600],
                                'url':         j.get('url') or f"https://remoteok.com/l/{_jid}",
                                'source':      'remoteok',
                                'tags':        j.get('tags', []),
                                'logo':        j.get('company_logo', ''),
                            })
                        if len(jobs) >= 20:
                            break
                except Exception:
                    pass
        except Exception as e:
            print(f'RemoteOK error: {e}')

    def _run_apify_actor(actor_slug, input_payload, source_name):
        """Call an Apify run-sync actor and return a list of raw items (may be empty)."""
        try:
            resp = _requests_lib.post(
                f'https://api.apify.com/v2/acts/{actor_slug}/run-sync-get-dataset-items',
                params={'token': apify_key, 'timeout': 60, 'memory': 512},
                json=input_payload,
                timeout=90,
            )
            if resp.ok:
                body = resp.json()
                return body if isinstance(body, list) else body.get('items', []) if isinstance(body, dict) else []
            else:
                err_body = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
                err_type = err_body.get('error', {}).get('type', '') if isinstance(err_body.get('error'), dict) else ''
                if err_type in ('actor-is-not-rented', 'actor-not-rented'):
                    print(f'Apify {source_name}: actor requires rental — skipping')
                else:
                    print(f'Apify {source_name} {resp.status_code}: {resp.text[:200]}')
        except Exception as e:
            print(f'Apify {source_name} error: {e}')
        return []

    # ── Indeed via Apify (haris2303/indeed-scraper — free public actor) ──────
    if 'indeed' in sources and apify_key:
        _indeed_query = roles[0] if roles else query
        for _actor in ('haris2303~indeed-scraper', 'misceres~indeed-scraper',
                       'maxcopell~indeed-scraper', 'bebity~indeed-scraper'):
            _items = _run_apify_actor(_actor, {
                'keyword': _indeed_query, 'location': location, 'maxItems': 20,
                'country': 'US', 'position': _indeed_query,
            }, 'Indeed')
            if _items:
                for item in _items[:20]:
                    url = (item.get('url') or item.get('jobUrl') or item.get('applyUrl')
                           or item.get('externalApplyLink') or item.get('positionLink') or '')
                    if not url:
                        continue
                    jobs.append({
                        'title':       item.get('title', '') or item.get('positionName', ''),
                        'company':     item.get('company') or item.get('companyName', ''),
                        'location':    item.get('location') or item.get('jobLocation', location),
                        'salary':      item.get('salary') or item.get('jobSalary', ''),
                        'description': (item.get('description') or item.get('snippet') or '')[:600],
                        'url':         url,
                        'source':      'indeed',
                        'tags':        [],
                        'logo':        item.get('companyLogo') or item.get('companyImage', ''),
                    })
                break  # stop trying actors once one succeeds

    # ── LinkedIn via Apify ───────────────────────────────────────────────────
    if 'linkedin' in sources and apify_key:
        _linkedin_query = roles[0] if roles else query
        for _actor in ('haris2303~linkedin-jobs-scraper', 'curious_coder~linkedin-jobs-scraper',
                       'bebity~linkedin-jobs-scraper'):
            _items = _run_apify_actor(_actor, {
                'keyword': _linkedin_query, 'location': location, 'maxJobs': 20,
                'searchKeywords': _linkedin_query,
            }, 'LinkedIn')
            if _items:
                for item in _items[:20]:
                    url = (item.get('url') or item.get('jobUrl') or item.get('link')
                           or item.get('jobLink') or item.get('applyUrl') or '')
                    if not url:
                        continue
                    jobs.append({
                        'title':       item.get('title', '') or item.get('position', ''),
                        'company':     item.get('company') or item.get('companyName', ''),
                        'location':    item.get('location') or item.get('jobLocation', location),
                        'salary':      item.get('salary', ''),
                        'description': (item.get('description') or item.get('snippet') or '')[:600],
                        'url':         url,
                        'source':      'linkedin',
                        'tags':        [],
                        'logo':        item.get('companyLogo') or item.get('companyImage', ''),
                    })
                break

    now_str = datetime.datetime.utcnow().isoformat()

    def _flat_tags(raw):
        """Flatten/stringify tags so Firestore never sees nested arrays."""
        if not isinstance(raw, list):
            return []
        out = []
        for t in raw:
            if isinstance(t, list):
                out.extend(str(x) for x in t if x is not None)
            elif t is not None:
                out.append(str(t))
        return out

    _pre_filter_count = len(jobs)
    jobs = _filter_relevant_jobs(jobs, roles or [query], location)
    print(f'Smart-apply relevance filter: {_pre_filter_count} -> {len(jobs)} jobs')

    # ── Write to shared Firestore pool ───────────────────────────────────────
    if db and jobs:
        batch = db.batch()
        result = []
        for job in jobs:
            job['tags'] = _flat_tags(job.get('tags', []))
            key     = _hashlib_lib.md5(f"{job['source']}|{job['url']}".encode()).hexdigest()
            ref     = db.collection('scraped_jobs').document(key)
            payload = {**job, 'search_key': search_key, 'query': query,
                       'scraped_at': datetime.datetime.utcnow(), 'scraped_by': uid}
            batch.set(ref, payload, merge=True)
            result.append({'id': key, **job, 'scraped_at': now_str})
        try:
            batch.commit()
        except Exception as _batch_err:
            print(f'Firestore batch write failed: {_batch_err}')
            result = [{'id': str(i), **j, 'scraped_at': now_str} for i, j in enumerate(jobs)]
    else:
        result = [{'id': str(i), **j, 'scraped_at': now_str} for i, j in enumerate(jobs)]

    return jsonify({'jobs': result, 'cached': False, 'count': len(result)})


@api_bp.route('/smart-apply/queue', methods=['GET'])
@require_auth
def get_smart_apply_queue():
    from firebase_utils import db
    from datetime import datetime as _dt
    uid = getattr(request, 'uid', None)
    if not db:
        return jsonify({'queue': [], 'applied_today': 0, 'autonomous_running': False, 'applied_jobs': []})

    doc = db.collection('apply_sessions').document(uid).get()
    if not doc.exists:
        return jsonify({'queue': [], 'applied_today': 0, 'autonomous_running': False, 'applied_jobs': []})

    data  = doc.to_dict()
    today = _dt.utcnow().date()
    lr    = data.get('last_reset')
    if lr and hasattr(lr, 'date') and lr.date() < today:
        db.collection('apply_sessions').document(uid).update(
            {'applied_today': 0, 'last_reset': _dt.utcnow()}
        )
        data['applied_today'] = 0

    return jsonify({
        'queue':              data.get('queue', []),
        'applied_today':      data.get('applied_today', 0),
        'autonomous_running': data.get('autonomous_running', False),
        'applied_jobs':       data.get('applied_jobs', []),
    })


@api_bp.route('/smart-apply/queue/add', methods=['POST'])
@require_auth
def add_to_apply_queue():
    from firebase_utils import db
    uid = getattr(request, 'uid', None)
    job = (request.get_json() or {}).get('job')
    if not job:
        return jsonify({'error': 'Job data required'}), 400
    if db:
        db.collection('apply_sessions').document(uid).set(
            {'queue': firestore.ArrayUnion([job])}, merge=True
        )
    return jsonify({'success': True})


@api_bp.route('/smart-apply/queue/remove', methods=['POST'])
@require_auth
def remove_from_apply_queue():
    from firebase_utils import db
    uid    = getattr(request, 'uid', None)
    job_id = (request.get_json() or {}).get('job_id')
    if db:
        snap = db.collection('apply_sessions').document(uid).get()
        if snap.exists:
            queue = [j for j in snap.to_dict().get('queue', []) if j.get('id') != job_id]
            db.collection('apply_sessions').document(uid).update({'queue': queue})
    return jsonify({'success': True})


@api_bp.route('/smart-apply/apply-supervised', methods=['POST'])
@require_auth
def apply_supervised():
    from firebase_utils import db
    from datetime import datetime as _dt
    uid       = getattr(request, 'uid', None)
    body      = request.get_json() or {}
    job_id    = body.get('job_id')
    job_data  = body.get('job_data', {})
    cover_ltr = body.get('cover_letter', '')
    if not job_id:
        return jsonify({'error': 'job_id required'}), 400
    if db:
        snap     = db.collection('apply_sessions').document(uid).get()
        existing = snap.to_dict() if snap.exists else {}
        queue    = [j for j in existing.get('queue', []) if j.get('id') != job_id]
        db.collection('apply_sessions').document(uid).set({
            'queue':        queue,
            'applied_today': firestore.Increment(1),
            'last_reset':   _dt.utcnow(),
            'applied_jobs': firestore.ArrayUnion([{
                'job_id': job_id, 'job_data': job_data,
                'cover_letter': cover_ltr,
                'applied_at': _dt.utcnow().isoformat(),
                'status': 'applied', 'mode': 'supervised',
            }]),
        }, merge=True)
        db.collection('applications').add({
            'candidateId': uid,
            'jobId':       job_id,
            'jobTitle':    job_data.get('title', ''),
            'company':     job_data.get('company', ''),
            'coverLetter': cover_ltr,
            'source':      'smart_apply',
            'appliedAt':   _dt.utcnow(),
            'status':      'applied',
        })
    return jsonify({'success': True})


@api_bp.route('/smart-apply/status', methods=['GET'])
@require_auth
def smart_apply_status():
    from firebase_utils import db
    uid = getattr(request, 'uid', None)
    if not db:
        return jsonify({'autonomous_running': False, 'applied_today': 0, 'progress': []})
    doc = db.collection('apply_sessions').document(uid).get()
    if not doc.exists:
        return jsonify({'autonomous_running': False, 'applied_today': 0, 'progress': []})
    d = doc.to_dict()
    return jsonify({
        'autonomous_running': d.get('autonomous_running', False),
        'applied_today':      d.get('applied_today', 0),
        'progress':           d.get('autonomous_progress', []),
    })


@api_bp.route('/smart-apply/autonomous/start', methods=['POST'])
@require_auth
def start_autonomous_apply():
    from firebase_utils import db
    from datetime import datetime as _dt
    uid       = getattr(request, 'uid', None)
    body      = request.get_json() or {}
    daily_cap = min(int(body.get('daily_cap', 20)), 20)

    if not db:
        return jsonify({'error': 'Firebase not available'}), 503

    snap = db.collection('apply_sessions').document(uid).get()
    if not snap.exists:
        return jsonify({'error': 'Add jobs to your queue first.'}), 400

    data          = snap.to_dict()
    queue         = data.get('queue', [])
    applied_today = data.get('applied_today', 0)

    if not queue:
        return jsonify({'error': 'Queue is empty. Search for jobs and add them first.'}), 400

    remaining = daily_cap - applied_today
    if remaining <= 0:
        return jsonify({'error': f'Daily cap of {daily_cap} reached. Resets at midnight UTC.'}), 429

    jobs_batch = queue[:remaining]
    db.collection('apply_sessions').document(uid).update({
        'autonomous_running':  True,
        'autonomous_progress': [],
    })

    # Fetch resume data + Gemini key for the worker
    resume_data = {}
    try:
        r_snap = db.collection('resumes').document(uid).get()
        if r_snap.exists:
            resume_data = r_snap.to_dict().get('resumeData', {})
    except Exception:
        pass

    gemini_key = os.environ.get('GEMINI_API_KEY', '')
    # Also try user's vault Gemini key
    try:
        import ollama_utils as _ou2
        from vault_utils import decrypt_key as _vdk
        _w2 = _ou2.get_request_wallet() or []
        _ge = next((e for e in _w2 if e.get('provider') in ('Gemini', 'Google')), None)
        if _ge:
            _enc2 = _ge.get('encryptedKey', '')
            gemini_key = _vdk(_enc2) if _enc2 else _ge.get('key', gemini_key)
    except Exception:
        pass

    def _worker(u, jobs, _db, _resume_data, _gemini_key):
        from auto_apply import apply_to_job
        from document_generator import generate_pdf_from_data
        import google.generativeai as _genai

        for job in jobs:
            # Honour stop requests
            try:
                _chk = _db.collection('apply_sessions').document(u).get()
                if not _chk.exists or not _chk.to_dict().get('autonomous_running'):
                    break
            except Exception:
                pass

            try:
                # 1. Generate a tailored cover letter
                cover_letter = ''
                try:
                    if _gemini_key:
                        _genai.configure(api_key=_gemini_key)
                        model = _genai.GenerativeModel('gemini-1.5-flash')
                        _personal = _resume_data.get('personal', {})
                        _skills   = '; '.join(
                            s.get('skills_list', '') for s in _resume_data.get('skills', [])[:3]
                        )
                        _cl_prompt = (
                            f"Write a 3-paragraph professional cover letter (under 250 words) for this application.\n"
                            f"Job: {job.get('title')} at {job.get('company')}\n"
                            f"Description snippet: {(job.get('description') or '')[:400]}\n"
                            f"Candidate: {_personal.get('name','')}, skills: {_skills}\n"
                            "Output only the body paragraphs — no 'Dear Hiring Manager' header."
                        )
                        cover_letter = model.generate_content(_cl_prompt).text.strip()
                except Exception as _ce:
                    print(f'Cover letter gen error: {_ce}')

                # 2. Generate resume PDF
                pdf_bytes = None
                try:
                    pdf_bytes = generate_pdf_from_data(_resume_data)
                except Exception as _pe:
                    print(f'PDF gen error: {_pe}')

                # 3. Autonomous browser apply
                result = apply_to_job(
                    job_url=job.get('url', ''),
                    resume_data=_resume_data,
                    cover_letter=cover_letter,
                    pdf_bytes=pdf_bytes,
                    gemini_key=_gemini_key,
                )

                status = 'applied' if result.get('success') else 'partially_applied'
                _db.collection('apply_sessions').document(u).update({
                    'autonomous_progress': firestore.ArrayUnion([{
                        'job_id':     job.get('id'),
                        'title':      job.get('title'),
                        'company':    job.get('company'),
                        'status':     status,
                        'method':     result.get('method', ''),
                        'message':    result.get('message', '')[:300],
                        'applied_at': _dt.utcnow().isoformat(),
                    }]),
                    'applied_today': firestore.Increment(1),
                })
                _db.collection('applications').add({
                    'candidateId':  u,
                    'jobId':        job.get('id'),
                    'jobTitle':     job.get('title', ''),
                    'company':      job.get('company', ''),
                    'source':       'smart_apply_autonomous',
                    'appliedAt':    _dt.utcnow(),
                    'status':       status,
                    'automation':   result.get('method', 'none'),
                    'cover_letter': cover_letter[:500],
                })

            except Exception as exc:
                print(f'Autonomous apply error ({job.get("id")}): {exc}')
                try:
                    _db.collection('apply_sessions').document(u).update({
                        'autonomous_progress': firestore.ArrayUnion([{
                            'job_id':  job.get('id'),
                            'title':   job.get('title'),
                            'company': job.get('company'),
                            'status':  'failed',
                            'message': str(exc)[:200],
                        }]),
                    })
                except Exception:
                    pass

        try:
            _db.collection('apply_sessions').document(u).update({
                'autonomous_running': False,
                'queue':              [],
            })
        except Exception:
            pass

    t = _threading_lib.Thread(target=_worker, args=(uid, jobs_batch, db, resume_data, gemini_key), daemon=True)
    _autonomous_sessions[uid] = t
    t.start()

    return jsonify({'success': True, 'jobs_queued': len(jobs_batch)})


@api_bp.route('/smart-apply/autonomous/stop', methods=['POST'])
@require_auth
def stop_autonomous_apply():
    from firebase_utils import db
    uid = getattr(request, 'uid', None)
    if db:
        db.collection('apply_sessions').document(uid).update({'autonomous_running': False})
    _autonomous_sessions.pop(uid, None)
    return jsonify({'success': True})


@api_bp.route('/auto-apply/solve-questions', methods=['POST'])
@require_auth
def auto_apply_solve_questions():
    configure_dynamic_api_key()
    data = request.json or {}
    candidate_id = data.get('candidateId')
    questions = data.get('questions', [])
    if not candidate_id or not questions:
        return jsonify({"error": "Missing candidateId or questions"}), 400
    try:
        from auto_apply_ai import solve_questions_with_gemini
        answers = solve_questions_with_gemini(candidate_id, questions)
        return jsonify({"answers": answers}), 200
    except Exception as e:
        print(f"Error solving questions: {e}")
        return jsonify({"error": str(e)}), 500


@api_bp.route('/auto-apply/log', methods=['POST'])
@require_auth
def auto_apply_log():
    from firebase_utils import db, firebase_initialized
    data = request.json or {}
    candidate_id = data.get('candidateId')
    job_title = data.get('jobTitle', '')
    company = data.get('company', '')
    source = data.get('source', '')
    if not candidate_id:
        return jsonify({"error": "Missing candidateId"}), 400
    try:
        if firebase_initialized and db:
            db.collection('applications').add({
                'candidateId': candidate_id,
                'jobTitle': job_title,
                'company': company,
                'source': source,
                'appliedAt': datetime.datetime.utcnow(),
                'status': 'applied'
            })
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"Error logging auto-apply: {e}")
        return jsonify({"error": str(e)}), 500


# ─── Browser Extension Plugin Token ──────────────────────────────────────────

@api_bp.route('/plugin/token', methods=['GET'])
@require_auth
def get_plugin_token():
    from firebase_utils import db
    uid = getattr(request, 'uid', None)
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        snap = db.collection('users').document(uid).get()
        token = snap.to_dict().get('pluginToken') if snap.exists else None
        return jsonify({"token": token}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/plugin/token', methods=['POST'])
@require_auth
def generate_plugin_token():
    import uuid
    from firebase_utils import db
    uid = getattr(request, 'uid', None)
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        new_token = str(uuid.uuid4()).replace('-', '') + str(uuid.uuid4()).replace('-', '')
        db.collection('users').document(uid).set({'pluginToken': new_token}, merge=True)
        return jsonify({"token": new_token}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _auth_plugin_token():
    from firebase_utils import db
    auth_hdr = request.headers.get('Authorization', '')
    if not auth_hdr.startswith('PluginToken '):
        return None, (jsonify({"error": "Missing plugin token"}), 401)
    token = auth_hdr[len('PluginToken '):]
    try:
        docs = list(db.collection('users').where('pluginToken', '==', token).limit(1).stream())
        if not docs:
            return None, (jsonify({"error": "Invalid plugin token"}), 401)
        return docs[0].id, None
    except Exception as e:
        return None, (jsonify({"error": str(e)}), 500)


@api_bp.route('/plugin/resumes', methods=['GET'])
def get_plugin_resumes():
    """Return list of resume options the user can choose from in the extension."""
    from firebase_utils import db
    uid, err = _auth_plugin_token()
    if err:
        return err
    try:
        resume_snap = db.collection('resumes').document(uid).get()
        resume_doc  = resume_snap.to_dict() if resume_snap.exists else {}
        options = [{'id': 'profile', 'name': 'Default Profile Resume'}]
        for v in resume_doc.get('savedVersions', []):
            if v.get('id') and v.get('name'):
                options.append({'id': v['id'], 'name': v['name']})
        return jsonify({'resumes': options}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/plugin/profile', methods=['GET'])
def get_plugin_profile():
    from firebase_utils import db
    uid, err = _auth_plugin_token()
    if err:
        return err
    try:
        user_snap = db.collection('users').document(uid).get()
        user_data = user_snap.to_dict() if user_snap.exists else {}
        resume_snap = db.collection('resumes').document(uid).get()
        resume_doc  = resume_snap.to_dict() if resume_snap.exists else {}

        # Support selecting a saved version via ?resume_id=<id>
        resume_id = request.args.get('resume_id', 'profile')
        resume_data = {}
        if resume_id != 'profile':
            for v in resume_doc.get('savedVersions', []):
                if v.get('id') == resume_id:
                    resume_data = v.get('resumeData', {})
                    break
        if not resume_data:
            resume_data = resume_doc.get('resumeData', {})

        personal = resume_data.get('personal', {})
        full_name = (user_data.get('fullName') or user_data.get('name') or
                     personal.get('name') or '').strip()
        # Prefer explicit firstName/lastName from resume personal data
        first_name = (personal.get('firstName') or personal.get('first_name') or
                      user_data.get('firstName') or '').strip()
        last_name  = (personal.get('lastName') or personal.get('last_name') or
                      user_data.get('lastName') or '').strip()
        # Fall back: if only full name available, split at LAST space so
        # multi-word first names (e.g. "Sree Ram Varma") stay intact
        if not first_name and not last_name and full_name:
            parts = full_name.rsplit(' ', 1)
            first_name = parts[0] if len(parts) > 1 else full_name
            last_name  = parts[1] if len(parts) > 1 else ''
        # Rebuild full name from parts if it was missing
        if not full_name and (first_name or last_name):
            full_name = f"{first_name} {last_name}".strip()

        return jsonify({
            "uid":            uid,
            "name":           full_name,
            "firstName":      first_name,
            "lastName":       last_name,
            "email":          user_data.get('email', ''),
            "phone":          personal.get('phone') or user_data.get('phone', ''),
            "location":       personal.get('location') or user_data.get('location', ''),
            "address":        personal.get('address') or user_data.get('address', ''),
            "city":           personal.get('city') or user_data.get('city', ''),
            "state":          personal.get('state') or user_data.get('state', ''),
            "zip":            personal.get('zip') or personal.get('zipCode') or user_data.get('zip', ''),
            "linkedin":       personal.get('linkedin', ''),
            "website":        personal.get('website', ''),
            "summary":        resume_data.get('summary', ''),
            "headline":       personal.get('headline', ''),
            "currentCompany": personal.get('currentCompany', ''),
            "experience":     resume_data.get('experience', []),
            "education":      resume_data.get('education', []),
            "skills":         resume_data.get('skills', []),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route('/plugin/applied', methods=['POST'])
def record_plugin_applied():
    from firebase_utils import db
    uid, err = _auth_plugin_token()
    if err:
        return err
    data = request.json or {}
    try:
        db.collection('applications').add({
            'candidateId': uid,
            'jobTitle': data.get('jobTitle', ''),
            'company': data.get('company', ''),
            'jobUrl': data.get('jobUrl', ''),
            'ats': data.get('ats', ''),
            'source': 'browser_extension',
            'appliedAt': datetime.datetime.utcnow(),
            'status': 'applied',
        })
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════════════════════
# SUPER ADMIN MODULE — feature flags, platform stats, user & job management
# ═══════════════════════════════════════════════════════════════════════════════
from firebase_utils import require_admin, is_admin_user

# Every feature the admin can toggle. New features should launch behind a flag.
FEATURE_DEFAULTS = {
    "feed": True,
    "smartApply": True,
    "aiInterview": True,
    "practiceMode": True,
    "resumeBuilder": True,
    "network": True,
    "messages": True,
    "sourcing": True,
    "webhooks": True,
    "companies": True,
    "signups": True,
}

_config_cache = {"data": None, "ts": 0}

def get_platform_features():
    """Feature flags with defaults merged; 60s cache to avoid per-request reads."""
    import time as _time
    if _config_cache["data"] is not None and _time.time() - _config_cache["ts"] < 60:
        return _config_cache["data"]
    features = dict(FEATURE_DEFAULTS)
    try:
        from firebase_utils import db
        if db:
            doc = db.collection('platform').document('config').get()
            if doc.exists:
                stored = (doc.to_dict() or {}).get('features', {})
                features.update({k: bool(v) for k, v in stored.items() if k in FEATURE_DEFAULTS})
    except Exception as e:
        print(f"Feature flag read failed (using defaults): {e}")
    _config_cache["data"] = features
    _config_cache["ts"] = _time.time()
    return features

def feature_enabled(name: str) -> bool:
    return get_platform_features().get(name, True)

@api_bp.route('/platform/config', methods=['GET'])
@require_auth
def platform_config():
    """Public (authenticated) — the frontend uses this to hide disabled features."""
    return jsonify({"features": get_platform_features()}), 200

@api_bp.route('/admin/me', methods=['GET'])
@require_auth
def admin_me():
    return jsonify({"admin": is_admin_user(request.user)}), 200

@api_bp.route('/admin/features', methods=['PUT'])
@require_admin
def admin_set_features():
    data = request.get_json() or {}
    incoming = data.get('features', {})
    updates = {k: bool(v) for k, v in incoming.items() if k in FEATURE_DEFAULTS}
    if not updates:
        return jsonify({"error": "No valid feature keys"}), 400
    try:
        from firebase_utils import db
        merged = {**get_platform_features(), **updates}
        db.collection('platform').document('config').set(
            {'features': merged, 'updatedBy': request.user.get('email', ''),
             'updatedAt': datetime.datetime.utcnow()}, merge=True)
        _config_cache["data"] = None  # bust cache
        return jsonify({"status": "success", "features": merged}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/admin/stats', methods=['GET'])
@require_admin
def admin_stats():
    try:
        from firebase_utils import db
        users = [d.to_dict() for d in db.collection('users').stream()]
        jobs  = [d.to_dict() for d in db.collection('jobs').stream()]
        apps  = sum(1 for _ in db.collection('applications').stream())
        conns = sum(1 for _ in db.collection('connections').stream())
        try:
            posts = sum(1 for _ in db.collection('posts').stream())
        except Exception:
            posts = 0
        by_role, suspended = {}, 0
        for u in users:
            r = u.get('role', 'candidate')
            by_role[r] = by_role.get(r, 0) + 1
            if u.get('suspended'): suspended += 1
        by_status = {}
        for j in jobs:
            st = j.get('status', 'Open')
            by_status[st] = by_status.get(st, 0) + 1
        return jsonify({
            "users": {"total": len(users), "byRole": by_role, "suspended": suspended},
            "jobs": {"total": len(jobs), "byStatus": by_status},
            "applications": apps, "connections": conns, "posts": posts,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/admin/users', methods=['GET'])
@require_admin
def admin_list_users():
    try:
        from firebase_utils import db
        out = []
        for d in db.collection('users').stream():
            u = d.to_dict()
            out.append({
                "uid": u.get('uid') or d.id,
                "fullName": u.get('fullName', ''),
                "email": u.get('email', ''),
                "role": u.get('role', 'candidate'),
                "suspended": bool(u.get('suspended', False)),
                "emailVerified": bool(u.get('emailVerified', False)),
            })
        return jsonify({"users": out}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/admin/users/<uid>/suspend', methods=['POST'])
@require_admin
def admin_suspend_user(uid):
    data = request.get_json() or {}
    suspended = bool(data.get('suspended', True))
    if (request.user.get('email', '') or '').lower() in [None, '']:
        return jsonify({"error": "Invalid admin"}), 403
    try:
        from firebase_utils import db
        udoc = db.collection('users').document(uid).get()
        if not udoc.exists:
            return jsonify({"error": "User not found"}), 404
        target = udoc.to_dict()
        if is_admin_user({'email': target.get('email', '')}):
            return jsonify({"error": "Admins cannot suspend other admins"}), 400
        db.collection('users').document(uid).update({'suspended': suspended})
        return jsonify({"status": "success", "uid": uid, "suspended": suspended}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/admin/jobs', methods=['GET'])
@require_admin
def admin_list_jobs():
    try:
        from firebase_utils import db
        out = []
        for d in db.collection('jobs').stream():
            j = d.to_dict(); j['id'] = d.id
            out.append({k: j.get(k) for k in ('id', 'title', 'company', 'status', 'recruiterId', 'postedDate', 'location')})
        return jsonify({"jobs": out}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# SOCIAL FEED — LinkedIn-style posts (behind the "feed" feature flag)
# ═══════════════════════════════════════════════════════════════════════════════

def _feed_guard():
    if not feature_enabled('feed'):
        return jsonify({"error": "The feed is currently disabled by the administrator."}), 403
    return None

def _post_author(uid):
    """Light author card stored on the post so the feed needs no joins."""
    try:
        from firebase_utils import db
        u = db.collection('users').document(uid).get()
        if u.exists:
            d = u.to_dict()
            return {"name": d.get('fullName', 'Member'), "role": d.get('role', 'candidate'),
                    "avatar": d.get('avatar', '') or d.get('profilePicture', '')}
    except Exception:
        pass
    return {"name": "Member", "role": "candidate", "avatar": ""}

@api_bp.route('/feed', methods=['GET'])
@require_auth
def get_feed():
    guard = _feed_guard()
    if guard: return guard
    try:
        from firebase_utils import db
        docs = (db.collection('posts')
                  .order_by('createdAt', direction=firestore.Query.DESCENDING)
                  .limit(50).stream())
        uid = request.uid
        posts = []
        for d in docs:
            p = d.to_dict(); p['id'] = d.id
            likes = p.get('likes', [])
            p['likeCount'] = len(likes)
            p['likedByMe'] = uid in likes
            p.pop('likes', None)
            ca = p.get('createdAt')
            if hasattr(ca, 'isoformat'): p['createdAt'] = ca.isoformat()
            posts.append(p)
        return jsonify({"posts": posts}), 200
    except Exception as e:
        print(f"Feed error: {e}")
        return jsonify({"posts": [], "error": str(e)}), 200

@api_bp.route('/posts', methods=['POST'])
@require_auth
def create_post():
    guard = _feed_guard()
    if guard: return guard
    data = request.get_json() or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({"error": "Post content is required"}), 400
    if len(content) > 2000:
        return jsonify({"error": "Posts are limited to 2000 characters"}), 400
    try:
        from firebase_utils import db
        uid = request.uid
        post = {
            "authorId": uid,
            "author": _post_author(uid),
            "content": content,
            "jobId": data.get('jobId') or None,        # optional shared job
            "jobTitle": data.get('jobTitle') or None,
            "likes": [],
            "comments": [],
            "createdAt": datetime.datetime.utcnow(),
        }
        ref = db.collection('posts').add(post)
        post['id'] = ref[1].id
        post['createdAt'] = post['createdAt'].isoformat()
        post['likeCount'] = 0; post['likedByMe'] = False
        post.pop('likes', None)
        return jsonify({"status": "success", "post": post}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/posts/<post_id>/like', methods=['POST'])
@require_auth
def toggle_like(post_id):
    guard = _feed_guard()
    if guard: return guard
    try:
        from firebase_utils import db
        ref = db.collection('posts').document(post_id)
        doc = ref.get()
        if not doc.exists:
            return jsonify({"error": "Post not found"}), 404
        uid = request.uid
        likes = doc.to_dict().get('likes', [])
        liked = uid in likes
        ref.update({'likes': firestore.ArrayRemove([uid]) if liked else firestore.ArrayUnion([uid])})
        return jsonify({"liked": not liked, "likeCount": len(likes) + (-1 if liked else 1)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/posts/<post_id>/comments', methods=['POST'])
@require_auth
def add_comment(post_id):
    guard = _feed_guard()
    if guard: return guard
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({"error": "Comment text is required"}), 400
    if len(text) > 500:
        return jsonify({"error": "Comments are limited to 500 characters"}), 400
    try:
        from firebase_utils import db
        ref = db.collection('posts').document(post_id)
        doc = ref.get()
        if not doc.exists:
            return jsonify({"error": "Post not found"}), 404
        if len(doc.to_dict().get('comments', [])) >= 100:
            return jsonify({"error": "Comment limit reached for this post"}), 400
        uid = request.uid
        comment = {
            "id": _hashlib_lib.md5(f"{uid}{datetime.datetime.utcnow().isoformat()}".encode()).hexdigest()[:10],
            "uid": uid,
            "author": _post_author(uid),
            "text": text,
            "createdAt": datetime.datetime.utcnow().isoformat(),
        }
        ref.update({'comments': firestore.ArrayUnion([comment])})
        return jsonify({"status": "success", "comment": comment}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/posts/<post_id>', methods=['DELETE'])
@require_auth
def delete_post(post_id):
    try:
        from firebase_utils import db
        ref = db.collection('posts').document(post_id)
        doc = ref.get()
        if not doc.exists:
            return jsonify({"error": "Post not found"}), 404
        if doc.to_dict().get('authorId') != request.uid and not is_admin_user(request.user):
            return jsonify({"error": "You can only delete your own posts"}), 403
        ref.delete()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
