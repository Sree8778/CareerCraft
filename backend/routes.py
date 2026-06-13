# backend/routes.py
from flask import request, jsonify, send_file, Blueprint
import io

# Make sure these functions are correctly imported from your other files
from document_generator import generate_docx_from_data, generate_pdf_from_data
from file_parser import parse_resume_file
from ollama_utils import (
    set_api_key,
    generate_elevator_pitch,
    generate_summary_suggestions,
    enhance_section_with_ai,
    generate_next_interview_question,
    evaluate_voice_answer,
    semantic_job_search,
    copilot_candidate_search,
    generate_cover_letter,
    grade_resume_match_score,
    generate_company_profile_via_ai,
    generate_company_reviews_via_ai
)
from google_calendar_utils import create_calendar_event
from face_verification import verify_face_similarity
from firebase_utils import require_auth
from vault_utils import encrypt_key, decrypt_key
from job_crawler import MOCK_JOBS, crawl_jobs_to_db
from email_utils import (
    send_application_status_email,
    send_interview_scheduled_email,
    send_connection_request_email,
    send_connection_accepted_email,
)
import datetime
import os
import random
from google.cloud import firestore

# Create a Blueprint for API routes
api_bp = Blueprint('api', __name__)

@api_bp.before_request
def configure_dynamic_api_key():
    # 1. Reset dynamic key to prevent cross-request state leakage
    set_api_key("")

    # 2. Check if the user is passing a plain key in headers (fallback for quick testing/on-the-fly tools)
    user_key = request.headers.get('X-Gemini-API-Key')
    if user_key and user_key.strip():
        set_api_key(user_key.strip())
        return

    # 3. Check if the user is passing a secure Authorization bearer token
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith("Bearer "):
        parts = auth_header.split()
        if len(parts) == 2:
            token = parts[1]
            uid = None
            
            # Check if the token is a mock developer token
            if token.startswith("mock_token_for_"):
                uid = token.replace("mock_token_for_", "")
            else:
                # Live production token verification
                from firebase_utils import firebase_initialized, auth
                if firebase_initialized:
                    try:
                        decoded = auth.verify_id_token(token)
                        uid = decoded.get('uid')
                    except Exception as token_err:
                        print(f"Vault failed to verify auth token for dynamic key extraction: {token_err}")
            
            # Look up the user's encrypted key wallet in Firestore using uid
            if uid:
                from firebase_utils import db, firebase_initialized
                
                # If Firebase database is running
                if firebase_initialized and db:
                    try:
                        user_doc = db.collection('users').document(uid).get()
                        if user_doc.exists:
                            user_data = user_doc.to_dict()
                            wallet = user_data.get('apiKeysWallet', [])
                            # Search for Gemini in the wallet
                            gemini_item = next((item for item in wallet if item.get('provider') == 'Gemini'), None)
                            if gemini_item:
                                enc_key = gemini_item.get('encryptedKey')
                                decrypted_key = decrypt_key(enc_key)
                                if decrypted_key:
                                    set_api_key(decrypted_key)
                                    return
                    except Exception as db_err:
                        print(f"Vault error reading user database keys: {db_err}")

# --- Resume Parsing Endpoint ---
@api_bp.route('/parse-resume', methods=['POST'])
@require_auth
def parse_resume_route():
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
    except Exception as e:
        print(f"Error evaluating answer: {e}")
        return jsonify({"error": "An internal error occurred while evaluating the answer."}), 500


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
    except Exception as e:
        print(f"Error in semantic job search: {e}")
        return jsonify({"error": "An internal error occurred during semantic job search."}), 500


# --- RECRUITER AI COPILOT CANDIDATE SEARCH & DIRECTORY ---

MOCK_CANDIDATES = [
    {
        'id': 'mock_uid_123',
        'uid': 'mock_uid_123',
        'name': 'Jane Doe',
        'title': 'Senior Flutter Software Engineer',
        'location': 'New York, USA',
        'email': 'jane.doe@careercraft.com',
        'phone': '+1 (555) 019-2834',
        'skills': 'Flutter, Dart, Firebase Auth, Cloud Firestore, Firebase Storage rules, path_provider, custom widgets',
        'experience': 'Senior Flutter Developer at MobileTech Solutions (2023 - Present) • Architected secure role-based cross-platform client flows. Engineered custom responsive layouts for folded displays and iPads.',
        'education': 'B.S. in Computer Science, Stanford University (2022)',
        'recruiterNotes': 'Extremely skilled in Flutter development and layouts.',
    },
    {
        'id': 'mock_uid_456',
        'uid': 'mock_uid_456',
        'name': 'Sam Miller',
        'title': 'Python Backend Engineer',
        'location': 'Austin, TX, USA',
        'email': 'sam.miller@nexus.com',
        'phone': '+1 (555) 304-9844',
        'skills': 'Python, Flask, PostgreSQL, Docker, face_verification API, Gemini model interfaces, require_auth decorators',
        'experience': 'Backend Engineer at Nexus Dynamics (2022 - 2024) • Designed identity checking biometrics and custom resume parsing microservices. Configured high-performance REST systems.',
        'education': 'M.S. in Software Engineering, UT Austin (2021)',
        'recruiterNotes': 'Strong grasp of Python and backend systems architecture.',
    },
    {
        'id': 'mock_uid_789',
        'uid': 'mock_uid_789',
        'name': 'Alex Rivera',
        'title': 'UI/UX Mobile Designer',
        'location': 'San Francisco, CA, USA',
        'email': 'alex.rivera@designagency.com',
        'phone': '+1 (555) 843-1029',
        'skills': 'Figma, Adobe XD, Mobile UX research, wireframing, high-fidelity mockups, grid guidelines',
        'experience': 'Mobile UX Designer at Design Agency (2021 - Present) • Created cohesive style design guidelines. Specialized in fluid column layouts for multi-device sizes.',
        'education': 'B.F.A. in Graphic Design, Rhode Island School of Design (2020)',
        'recruiterNotes': 'Pristine mobile asset design portfolio.',
    }
]

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
        return MOCK_CANDIDATES
    except Exception as e:
        print(f"Error in helper fetching candidates: {e}")
        return MOCK_CANDIDATES

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
    except Exception as e:
        print(f"Error in grade resume endpoint: {e}")
        return jsonify({"error": "An internal error occurred while grading the resume."}), 500


# --- NEW: Google Calendar Scheduler Endpoint ---
@api_bp.route('/interviews/schedule', methods=['POST'])
@require_auth
def schedule_interview_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    title = data.get('title', 'Technical Interview')
    description = data.get('description', 'Technical Screening Interview')
    start_time_str = data.get('startTime') # ISO string format
    duration_mins = data.get('durationMinutes', 30)
    attendees = data.get('attendees', []) # List of emails
    
    if not start_time_str or not attendees:
        return jsonify({"error": "Missing startTime or attendees in request"}), 400
        
    try:
        # Parse ISO date string
        # Next.js sends ISO e.g. "2026-05-30T10:00:00.000Z" or "2026-05-30T10:00:00"
        # We clean the string format to parse it
        clean_time_str = start_time_str.split('.')[0].replace('Z', '')
        start_time = datetime.datetime.fromisoformat(clean_time_str)
        end_time = start_time + datetime.timedelta(minutes=int(duration_mins))
        
        # Call calendar utility
        try:
            event_link = create_calendar_event(
                summary=title,
                description=description,
                start_time=start_time,
                end_time=end_time,
                attendees=attendees
            )
            # Email every attendee
            interview_dt_str = start_time.strftime("%B %d, %Y at %I:%M %p UTC")
            job_title_hint = title.replace("Technical Interview", "").replace("Interview", "").strip() or title
            for email_addr in attendees:
                send_interview_scheduled_email(
                    to=email_addr,
                    candidate_name=email_addr.split('@')[0],
                    job_title=job_title_hint,
                    company=description,
                    interview_datetime=interview_dt_str,
                    meet_link=event_link
                )
            return jsonify({
                "status": "success",
                "message": "Interview scheduled successfully on Google Calendar!",
                "eventLink": event_link,
                "meetLink": event_link
            }), 200
        except FileNotFoundError as calendar_err:
            # Handle unconfigured Google Calendar developer settings gracefully
            print(f"Google Calendar credentials missing. Running developer simulator mode: {calendar_err}")
            # Generate a realistic mock Google Meet link for development ease
            simulated_meet_link = f"https://meet.google.com/abc-mock-{datetime.datetime.now().strftime('%M%S')}"
            return jsonify({
                "status": "simulated",
                "message": "Simulated developer schedule complete (Live Calendar credentials unconfigured).",
                "meetLink": simulated_meet_link
            }), 200
            
    except Exception as e:
        print(f"Error in interview scheduling endpoint: {e}")
        return jsonify({"error": f"An error occurred while scheduling: {str(e)}"}), 500



# --- Dynamic Data Endpoints (Unauthenticated) ---

# In-memory stores in case Firebase is not running
MOCK_BENEFITS = [
    {
        "title": "AI-Powered Matchmaking",
        "desc": "Our advanced Gemini integration matches candidates and roles with 95% precision.",
        "icon": "psychology"
    },
    {
        "title": "Turn-based Audio Screening",
        "desc": "Evaluate communication and elevator pitches via secure voice proctoring.",
        "icon": "mic"
    },
    {
        "title": "Modern Glassmorphism UI",
        "desc": "Interact with a state-of-the-art visual engine tailored for high contrast.",
        "icon": "space_dashboard"
    }
]

MOCK_TESTIMONIALS = [
    {
        "quote": "Recruit Edge automated our initial filtering. AI voice proctoring saved us 40+ hours.",
        "name": "Sarah Jenkins",
        "title": "VP of Talent, TechCorp",
        "emoji": "👩‍💼"
    },
    {
        "quote": "Building a premium resume and recording my pitch was seamless. I got hired in 2 weeks!",
        "name": "Alex Rivera",
        "title": "Flutter Developer",
        "emoji": "👨‍💻"
    }
]

MOCK_EMPLOYERS = [
    {
        "name": "TechCorp Systems",
        "industry": "Software & AI",
        "logoUrl": "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=100&auto=format&fit=crop&q=60"
    },
    {
        "name": "Nexus Dynamics",
        "industry": "Cloud Infrastructure",
        "logoUrl": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100&auto=format&fit=crop&q=60"
    },
    {
        "name": "Vivid Design Agency",
        "industry": "Creative & Design",
        "logoUrl": "https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=100&auto=format&fit=crop&q=60"
    }
]


@api_bp.route('/benefits', methods=['GET'])
def get_benefits():
    try:
        from firebase_utils import db
        if db:
            docs = db.collection('benefits').stream()
            benefits = [doc.to_dict() for doc in docs]
            if benefits:
                return jsonify({"benefits": benefits}), 200
        return jsonify({"benefits": MOCK_BENEFITS}), 200
    except Exception as e:
        print(f"Error fetching benefits from Firestore: {e}")
        return jsonify({"benefits": MOCK_BENEFITS}), 200

@api_bp.route('/testimonials', methods=['GET'])
def get_testimonials():
    try:
        from firebase_utils import db
        if db:
            docs = db.collection('testimonials').stream()
            testimonials = [doc.to_dict() for doc in docs]
            if testimonials:
                return jsonify({"testimonials": testimonials}), 200
        return jsonify({"testimonials": MOCK_TESTIMONIALS}), 200
    except Exception as e:
        print(f"Error fetching testimonials: {e}")
        return jsonify({"testimonials": MOCK_TESTIMONIALS}), 200

@api_bp.route('/employers/featured', methods=['GET'])
def get_employers_featured():
    try:
        from firebase_utils import db
        if db:
            docs = db.collection('employers').where('featured', '==', True).stream()
            employers = [doc.to_dict() for doc in docs]
            if employers:
                return jsonify({"employers": employers}), 200
        return jsonify({"employers": MOCK_EMPLOYERS}), 200
    except Exception as e:
        print(f"Error fetching employers: {e}")
        return jsonify({"employers": MOCK_EMPLOYERS}), 200

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
            # Hide archived jobs from candidate search; recruiters see all their own jobs
            if not recruiter_id:
                jobs = [j for j in jobs if j.get('status') != 'Archived']
            # If filtering by recruiter return empty list (not mock data) when none found
            if jobs or recruiter_id:
                return jsonify({"jobs": jobs}), 200
        return jsonify({"jobs": MOCK_JOBS}), 200
    except Exception as e:
        print(f"Error fetching jobs: {e}")
        return jsonify({"jobs": MOCK_JOBS}), 200

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
        # Fall back to mock data
        job = next((j for j in MOCK_JOBS if j.get('id') == job_id), None)
        if job:
            return jsonify(job), 200
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
    allowed = {'title', 'description', 'jobType', 'department', 'location', 'status', 'company'}
    update_data = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not update_data:
        return jsonify({"error": "No valid fields to update"}), 400
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            jdoc = db.collection('jobs').document(job_id).get()
            if not jdoc.exists:
                return jsonify({"error": "Job not found"}), 404
            jd = jdoc.to_dict()
            if jd.get('recruiterId') and jd.get('recruiterId') != request.user.get('uid', ''):
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

    if not title or not description or not job_type:
        return jsonify({"error": "Missing title, description or jobType"}), 400

    try:
        from firebase_utils import db
        recruiter_id = request.user.get('uid', '')
        new_job = {
            "title": title,
            "description": description,
            "jobType": job_type,
            "department": data.get('department', ''),
            "location": data.get('location', 'Remote'),
            "company": request.user.get('name', data.get('company', 'CareerCraft Client')),
            "recruiterId": recruiter_id,
            "postedDate": datetime.datetime.utcnow().strftime('%Y-%m-%d'),
            "status": "Open",
        }
        if db:
            doc_ref = db.collection('jobs').add(new_job)
            new_job['id'] = doc_ref[1].id
        else:
            import uuid
            new_job['id'] = str(uuid.uuid4())
            MOCK_JOBS.append(new_job)

        return jsonify({"status": "success", "job": new_job}), 201
    except Exception as e:
        print(f"Error posting job: {e}")
        return jsonify({"error": str(e)}), 500

# --- NEW: SECURE USER REGISTRATION VAULT PORTAL ---
@api_bp.route('/users/register', methods=['POST'])
def register_user_route():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
        
    data = request.json
    uid = data.get('uid')
    fullName = data.get('fullName')
    email = data.get('email')
    phone = data.get('phone')
    role = data.get('role', 'candidate')
    apiKeysWallet = data.get('apiKeysWallet', [])
    resumeProfile = data.get('resumeProfile') # Optional profile data (education, experience, skills)
    
    if not uid or not email or not fullName:
        return jsonify({"error": "Missing uid, email, or fullName in registration request"}), 400
        
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
            print("WARNING: Firestore uninitialized. Simulated developer mock database write successful.")
            # Sync with in-memory mock users list
            global MOCK_USERS
            MOCK_USERS = [u for u in MOCK_USERS if u.get('uid') != uid]
            MOCK_USERS.append(user_profile)
            
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
                    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
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
            # Simulated check for OpenAI keys (OpenAI keys start with sk- and have specific length/format)
            if key.startswith('sk-') and len(key) >= 40:
                return jsonify({"valid": True, "message": "OpenAI API Key format verified!"}), 200
            else:
                return jsonify({"valid": False, "error": "Invalid OpenAI key format (must start with sk-)."}), 200
        else:
            # Generic format check for Groq and Claude
            if len(key) >= 30:
                return jsonify({"valid": True, "message": f"{provider} API Key format verified!"}), 200
            else:
                return jsonify({"valid": False, "error": f"Invalid key length for {provider}."}), 200
                
    except Exception as e:
        print(f"Vault verification error: {e}")
        return jsonify({"error": f"Internal verification failed: {str(e)}"}), 500


@api_bp.route('/vault/wallet/stack', methods=['POST'])
def wallet_stack_key():
    """Add a new verified key to a user's API wallet in Firestore."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.json
    uid = data.get('uid', '').strip()
    provider = data.get('provider', 'Gemini')
    key = data.get('key', '').strip()

    if not uid or not key:
        return jsonify({"error": "Missing uid or key"}), 400

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
def wallet_remove_key():
    """Remove a key from a user's API wallet in Firestore."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.json
    uid = data.get('uid', '').strip()
    key_id = data.get('keyId', '').strip()

    if not uid or not key_id:
        return jsonify({"error": "Missing uid or keyId"}), 400

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
    try:
        from firebase_utils import db, firebase_initialized
        job_title = data.get('jobTitle', '')
        company = data.get('company', '')
        recruiter_id = ''
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
                    a = doc.to_dict(); a['id'] = doc.id; apps.append(a)
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
                MOCK_NOTIFICATIONS.append(notif_data)
                
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

MOCK_CHATS = []
MOCK_MESSAGES = {}  # chat_id -> list of msgs
MOCK_NOTIFICATIONS = []

@api_bp.route('/chats', methods=['GET'])
@require_auth
def get_chats():
    uid = request.user.get('uid')
    role = request.args.get('role', 'candidate')
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            chats = []
            if role == 'recruiter':
                docs = db.collection('chats').where('recruiterId', '==', uid).stream()
            else:
                docs = db.collection('chats').where('candidateId', '==', uid).stream()
            for doc in docs:
                c = doc.to_dict()
                c['id'] = doc.id
                chats.append(c)
            return jsonify({"chats": chats}), 200
        
        chats = [c for c in MOCK_CHATS if (c['recruiterId'] == uid if role == 'recruiter' else c['candidateId'] == uid)]
        return jsonify({"chats": chats}), 200
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

        found = next((c for c in MOCK_CHATS if c['candidateId'] == candidate_id and c['recruiterId'] == recruiter_id and c['jobId'] == job_id), None)
        if found:
            return jsonify({"status": "success", "chat": found}), 200

        import uuid
        new_chat = {
            "id": str(uuid.uuid4()),
            "candidateId": candidate_id,
            "recruiterId": recruiter_id,
            "jobId": job_id,
            "jobTitle": job_title,
            "candidateName": candidate_name,
            "recruiterName": recruiter_name,
            "lastMessage": "",
            "lastMessageTimestamp": ""
        }
        MOCK_CHATS.append(new_chat)
        return jsonify({"status": "success", "chat": new_chat}), 201
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

        messages = MOCK_MESSAGES.get(chat_id, [])
        return jsonify({"messages": messages}), 200
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

        import uuid
        new_msg = {
            "id": str(uuid.uuid4()),
            "chatId": chat_id,
            "text": text,
            "senderId": sender_id,
            "senderName": sender_name,
            "timestamp": now_str
        }
        if chat_id not in MOCK_MESSAGES:
            MOCK_MESSAGES[chat_id] = []
        MOCK_MESSAGES[chat_id].append(new_msg)

        found = next((c for c in MOCK_CHATS if c['id'] == chat_id), None)
        if found:
            found['lastMessage'] = text
            found['lastMessageTimestamp'] = now_str

        return jsonify({"status": "success", "message": new_msg}), 201
    except Exception as e:
        print(f"Error sending message: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/notifications', methods=['GET'])
@require_auth
def get_notifications():
    uid = request.user.get('uid')
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            from firebase_admin import firestore
            docs = db.collection('notifications').where('candidateId', '==', uid).order_by('timestamp', direction=firestore.Query.DESCENDING).stream()
            notifs = []
            for doc in docs:
                n = doc.to_dict()
                n['id'] = doc.id
                notifs.append(n)
            return jsonify({"notifications": notifs}), 200

        notifs = [n for n in MOCK_NOTIFICATIONS if n['candidateId'] == uid]
        notifs.sort(key=lambda x: x['timestamp'], reverse=True)
        return jsonify({"notifications": notifs}), 200
    except Exception as e:
        print(f"Error getting notifications: {e}")
        return jsonify({"notifications": []}), 200

@api_bp.route('/notifications/read-all', methods=['POST'])
@require_auth
def read_all_notifications():
    uid = request.user.get('uid')
    try:
        from firebase_utils import db, firebase_initialized
        if firebase_initialized and db:
            docs = db.collection('notifications').where('candidateId', '==', uid).where('read', '==', False).stream()
            for doc in docs:
                db.collection('notifications').document(doc.id).update({"read": True})
            return jsonify({"status": "success"}), 200

        for n in MOCK_NOTIFICATIONS:
            if n['candidateId'] == uid:
                n['read'] = True
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error reading notifications: {e}")
        return jsonify({"error": str(e)}), 500

# --- Phase 2: Community Trust & Salary Market Data Endpoints ---

MOCK_COMPANIES = [
    {
        "id": "google",
        "name": "Google",
        "industry": "Search & Cloud",
        "logoUrl": "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=100&auto=format&fit=crop&q=60",
        "bio": "Google's mission is to organize the world's information and make it universally accessible and useful. We build products that connect millions of people daily.",
        "employeesCount": "150,000+",
        "location": "Mountain View, CA"
    },
    {
        "id": "techcorp",
        "name": "TechCorp Systems",
        "industry": "Software & AI",
        "logoUrl": "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=100&auto=format&fit=crop&q=60",
        "bio": "Developing premium software systems and leading AI tools for modern enterprise applications since 2018.",
        "employeesCount": "2,500+",
        "location": "Austin, TX"
    },
    {
        "id": "nexus",
        "name": "Nexus Dynamics",
        "industry": "Cloud Infrastructure",
        "logoUrl": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100&auto=format&fit=crop&q=60",
        "bio": "Next-generation cloud networks and double-blind security vaults for global technology companies.",
        "employeesCount": "800+",
        "location": "Dallas, TX"
    }
]

MOCK_REVIEWS = {}
MOCK_QNA = {}

MOCK_SALARIES = {
    "Flutter Developer": {
        "title": "Flutter Developer",
        "low": 85000,
        "median": 115000,
        "high": 150000,
        "avg": 118000,
        "curve": [40, 55, 78, 95, 78, 48, 25]
    },
    "Python Backend Developer": {
        "title": "Python Backend Developer",
        "low": 95000,
        "median": 130000,
        "high": 175000,
        "avg": 134000,
        "curve": [30, 48, 72, 98, 88, 55, 30]
    },
    "UI/UX Designer": {
        "title": "UI/UX Designer",
        "low": 75000,
        "median": 105000,
        "high": 140000,
        "avg": 108000,
        "curve": [45, 60, 85, 90, 68, 38, 15]
    }
}

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
        else:
            companies = list(MOCK_COMPANIES)

        # If a search query is provided, check if there's any match in the database
        if search_query:
            query_lower = search_query.lower()
            matches = [c for c in companies if query_lower in c.get('name', '').lower() or query_lower in c.get('industry', '').lower() or query_lower in c.get('location', '').lower()]
            
            # If no matches, dynamically generate the company profile via Gemini
            if not matches:
                new_company = generate_company_profile_via_ai(search_query)
                if new_company:
                    # Save to DB or Mock
                    if firebase_initialized and db:
                        db.collection('companies').document(new_company['id']).set(new_company)
                    else:
                        MOCK_COMPANIES.append(new_company)
                    companies.append(new_company)
                    matches = [new_company]
            return jsonify({"companies": matches}), 200

        # Seed Firestore if empty on first load
        if not companies:
            if firebase_initialized and db:
                for comp in MOCK_COMPANIES:
                    db.collection('companies').document(comp['id']).set(comp)
            return jsonify({"companies": MOCK_COMPANIES}), 200
        return jsonify({"companies": companies}), 200
    except Exception as e:
        print(f"Error listing companies: {e}")
        return jsonify({"companies": MOCK_COMPANIES}), 200

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
        found = next((comp for comp in MOCK_COMPANIES if comp['id'] == company_id), None)
        if found:
            return jsonify({"company": found}), 200
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
        else:
            reviews = MOCK_REVIEWS.get(company_id, [])

        if not reviews:
            # Dynamically generate reviews for the company using Gemini
            company_name = None
            if firebase_initialized and db:
                comp_doc = db.collection('companies').document(company_id).get()
                if comp_doc.exists:
                    company_name = comp_doc.to_dict().get('name')
            else:
                comp_found = next((c for c in MOCK_COMPANIES if c['id'] == company_id), None)
                if comp_found:
                    company_name = comp_found.get('name')

            if company_name:
                generated_reviews = generate_company_reviews_via_ai(company_id, company_name)
                if generated_reviews:
                    if firebase_initialized and db:
                        for r in generated_reviews:
                            db.collection('companies').document(company_id).collection('reviews').add(r)
                    else:
                        MOCK_REVIEWS[company_id] = generated_reviews
                    reviews = generated_reviews

        return jsonify({"reviews": reviews}), 200
    except Exception as e:
        print(f"Error listing reviews for {company_id}: {e}")
        return jsonify({"reviews": MOCK_REVIEWS.get(company_id, [])}), 200

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
        
        if company_id not in MOCK_REVIEWS:
            MOCK_REVIEWS[company_id] = []
        review_data['id'] = f"mock-rev-{random.randint(100, 999)}"
        MOCK_REVIEWS[company_id].insert(0, review_data)
        return jsonify({"status": "success", "review": review_data}), 201
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
        return jsonify({"qna": MOCK_QNA.get(company_id, [])}), 200
    except Exception as e:
        print(f"Error fetching QnA: {e}")
        return jsonify({"qna": MOCK_QNA.get(company_id, [])}), 200

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

        if company_id not in MOCK_QNA:
            MOCK_QNA[company_id] = []
        qna_data['id'] = f"mock-qna-{random.randint(100, 999)}"
        MOCK_QNA[company_id].insert(0, qna_data)
        return jsonify({"status": "success", "qna": qna_data}), 201
    except Exception as e:
        print(f"Error posting QnA: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/stats/salaries', methods=['GET'])
def get_salary_stats():
    # Return salary averages by tech position
    return jsonify({"salaries": MOCK_SALARIES}), 200

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

MOCK_WEBHOOKS = []

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
        
        # Merge with in-memory mock webhooks
        for item in MOCK_WEBHOOKS:
            if item.get('url') and item['url'] not in urls:
                urls.append(item['url'])

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
            if not subs:
                return jsonify({"subscriptions": MOCK_WEBHOOKS}), 200
            return jsonify({"subscriptions": subs}), 200
        return jsonify({"subscriptions": MOCK_WEBHOOKS}), 200
    except Exception as e:
        print(f"Error listing webhook subscriptions: {e}")
        return jsonify({"subscriptions": MOCK_WEBHOOKS}), 200

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
        
        sub_data['id'] = f"mock-sub-{random.randint(100, 999)}"
        MOCK_WEBHOOKS.append(sub_data)
        return jsonify({"status": "success", "subscription": sub_data}), 201
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

MOCK_USERS = [
    {
        "uid": "mock_uid_123",
        "fullName": "Jane Doe",
        "email": "jane.doe@careercraft.com",
        "role": "candidate",
        "phone": "+1 (555) 019-2834",
        "createdAt": "2026-05-01T12:00:00Z"
    },
    {
        "uid": "mock_uid_456",
        "fullName": "Jane Smith",
        "email": "jane.smith@example.com",
        "role": "candidate",
        "phone": "987-654-3210",
        "createdAt": "2026-05-02T12:00:00Z"
    },
    {
        "uid": "mock_uid_789",
        "fullName": "Bob Johnson",
        "email": "bob.johnson@example.com",
        "role": "candidate",
        "phone": "555-123-4567",
        "createdAt": "2026-05-03T12:00:00Z"
    },
    {
        "uid": "mock_recruiter_999",
        "fullName": "Alice Recruiter",
        "email": "alice.recruiter@example.com",
        "role": "recruiter",
        "phone": "444-123-4567",
        "createdAt": "2026-05-04T12:00:00Z"
    },
    {
        "uid": "mock_recruiter_888",
        "fullName": "Charlie Recruiter",
        "email": "charlie@example.com",
        "role": "recruiter",
        "phone": "333-123-4567",
        "createdAt": "2026-05-05T12:00:00Z"
    }
]

MOCK_CONNECTIONS = []

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
            docs = db.collection('users').stream()
            for doc in docs:
                u = doc.to_dict()
                uid = u.get('uid')
                if uid == current_uid:
                    continue  # Exclude self
                u_data = {
                    "uid": uid,
                    "fullName": u.get('fullName', 'Anonymous User'),
                    "email": u.get('email', ''),
                    "role": u.get('role', 'candidate'),
                    "phone": u.get('phone', '')
                }
                
                # Apply filters
                if role_filter and u_data['role'].lower() != role_filter:
                    continue
                if search_query:
                    name = u_data['fullName'].lower()
                    email = u_data['email'].lower()
                    if search_query not in name and search_query not in email:
                        continue
                    users_list.append(u_data)
                else:
                    users_list.append(u_data)
        else:
            # Fallback mock users
            for u in MOCK_USERS:
                uid = u.get('uid')
                if uid == current_uid:
                    continue  # Exclude self
                
                # Apply filters
                if role_filter and u['role'].lower() != role_filter:
                    continue
                if search_query:
                    name = u['fullName'].lower()
                    email = u['email'].lower()
                    if search_query not in name and search_query not in email:
                        continue
                    users_list.append(u)
                else:
                    users_list.append(u)
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
            # Check mock connections
            found_existing = next((c for c in MOCK_CONNECTIONS if (c['senderId'] == current_uid and c['receiverId'] == receiver_id) or (c['senderId'] == receiver_id and c['receiverId'] == current_uid)), None)
            if found_existing:
                return jsonify({"error": "Connection request already exists or is active between these users"}), 400

            sender_doc = next((u for u in MOCK_USERS if u['uid'] == current_uid), None)
            if sender_doc:
                sender_name = sender_doc.get('fullName', sender_name)
                sender_email = sender_doc.get('email', sender_email)
                sender_role = sender_doc.get('role', sender_role)

            receiver_doc = next((u for u in MOCK_USERS if u['uid'] == receiver_id), None)
            if receiver_doc:
                receiver_name = receiver_doc.get('fullName', receiver_name)
                receiver_email = receiver_doc.get('email', receiver_email)
                receiver_role = receiver_doc.get('role', receiver_role)

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
        else:
            conn_data['id'] = f"mock-conn-{random.randint(1000, 9999)}"
            MOCK_CONNECTIONS.append(conn_data)

            # Send mock notification
            notif = {
                "id": f"mock-notif-{random.randint(100, 999)}",
                "candidateId": receiver_id,
                "title": "Connection Invitation",
                "message": f"{sender_name} wants to connect with you and start a conversation.",
                "timestamp": now_str,
                "read": False
            }
            MOCK_NOTIFICATIONS.append(notif)
            print(f"[MOCK NOTIF] Alert created for {receiver_id}: {notif['message']}")

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
        else:
            # Filter mock list
            conns = [c for c in MOCK_CONNECTIONS if c['senderId'] == current_uid or c['receiverId'] == current_uid]
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
            conn_idx = next((i for i, c in enumerate(MOCK_CONNECTIONS) if c['id'] == connection_id), -1)
            if conn_idx == -1:
                return jsonify({"error": "Connection record not found"}), 404
            conn_data = MOCK_CONNECTIONS[conn_idx]

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
        else:
            # Handle mock response
            # Create notification for sender
            notif = {
                "id": f"mock-notif-{random.randint(100, 999)}",
                "candidateId": sender_id,
                "title": "Connection Accepted" if status == 'accepted' else "Connection Request Update",
                "message": f"{receiver_name} has accepted your connection request!" if status == 'accepted' else f"{receiver_name} declined your connection request.",
                "timestamp": now_str,
                "read": False
            }
            MOCK_NOTIFICATIONS.append(notif)
            print(f"[MOCK NOTIF] Alert created for {sender_id}: {notif['message']}")

            if status == 'accepted':
                # Create Direct Chat Room
                candidate_id = sender_id if conn_data['senderRole'] == 'candidate' else current_uid
                recruiter_id = sender_id if conn_data['senderRole'] == 'recruiter' else current_uid
                cand_name = sender_name if conn_data['senderRole'] == 'candidate' else receiver_name
                rec_name = sender_name if conn_data['senderRole'] == 'recruiter' else receiver_name

                found_chat = next((c for c in MOCK_CHATS if c['candidateId'] == candidate_id and c['recruiterId'] == recruiter_id and c['jobId'] == 'connection_chat'), None)
                if not found_chat:
                    import uuid
                    new_chat_id = str(uuid.uuid4())
                    new_chat = {
                        "id": new_chat_id,
                        "candidateId": candidate_id,
                        "recruiterId": recruiter_id,
                        "jobId": "connection_chat",
                        "jobTitle": "Direct Connection",
                        "candidateName": cand_name,
                        "recruiterName": rec_name,
                        "lastMessage": "You are now connected! Start chatting.",
                        "lastMessageTimestamp": now_str
                    }
                    MOCK_CHATS.append(new_chat)

                    # Initial message
                    msg_data = {
                        "id": f"mock-msg-{random.randint(1000, 9999)}",
                        "senderId": "system",
                        "senderName": "System",
                        "text": "Connection established. You can now message each other directly.",
                        "timestamp": now_str,
                        "chatId": new_chat_id
                    }
                    if new_chat_id not in MOCK_MESSAGES:
                        MOCK_MESSAGES[new_chat_id] = []
                    MOCK_MESSAGES[new_chat_id].append(msg_data)

        # Update in memory if mock
        if not firebase_initialized or not db:
            conn_idx = next((i for i, c in enumerate(MOCK_CONNECTIONS) if c['id'] == connection_id), -1)
            if conn_idx != -1:
                MOCK_CONNECTIONS[conn_idx]['status'] = status
                MOCK_CONNECTIONS[conn_idx]['updatedAt'] = now_str

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
            alerts = [a for a in MOCK_JOB_ALERTS if a['userId'] == uid]
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
        else:
            import uuid
            alert['id'] = str(uuid.uuid4())
            MOCK_JOB_ALERTS.append(alert)
        return jsonify({'status': 'created', 'alert': alert}), 201
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
            global MOCK_JOB_ALERTS
            MOCK_JOB_ALERTS = [a for a in MOCK_JOB_ALERTS if not (a['id'] == alert_id and a['userId'] == uid)]
        return jsonify({'status': 'deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# In-memory store for mock mode
MOCK_JOB_ALERTS: list = []


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
            mock_user = next((u for u in MOCK_USERS if u.get('uid') == uid), {})
            user_data = mock_user
            resume_exists = False
        result = _calc_completion(user_data, resume_exists)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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