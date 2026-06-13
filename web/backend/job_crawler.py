import threading
import time
import datetime
import random
from firebase_utils import db, firebase_initialized

# Predefined crawler feed containing modern tech roles to ingest
CRAWLER_FEED = [
    {
        "title": "Junior Mobile Flutter developer",
        "company": "Appify Solutions",
        "location": "Austin, TX (Hybrid)",
        "jobType": "Full-Time",
        "salary": "$85,000 - $105,000",
        "description": "We are seeking a Junior Flutter Developer to join our client-centric mobile development team. Experience with state management (Provider or Bloc) and clean code layout is required."
    },
    {
        "title": "Staff Cloud Infrastructure Architect",
        "company": "Nexus Dynamics",
        "location": "Dallas, TX (On-Site)",
        "jobType": "Full-Time",
        "salary": "$180,000 - $220,000",
        "description": "Lead Nexus Dynamics global infrastructure scaling. Deep expertise in Terraform, Kubernetes orchestration, multi-zone security VPCs, and database synchronization."
    },
    {
        "title": "Senior AI Prompt Engineer",
        "company": "Brainwave Systems",
        "location": "Remote, USA",
        "jobType": "Contract",
        "salary": "$120 - $160 / hr",
        "description": "We are looking for a Prompt Architect to tune Gemini and GPT models for multi-turn conversational agents. Experience evaluating hallucination rates is preferred."
    },
    {
        "title": "Lead UI/UX Glassmorphic Architect",
        "company": "Vivid Design Agency",
        "location": "New York, NY",
        "jobType": "Full-Time",
        "salary": "$135,000 - $165,000",
        "description": "Help shape premium design languages. Perfect understanding of CSS filters, glassmorphic card overlays, motion behaviors, and responsive grid layouts."
    },
    {
        "title": "Flask Backend Security Engineer",
        "company": "CyberShield Labs",
        "location": "Chicago, IL (Remote)",
        "jobType": "Full-Time",
        "salary": "$140,000 - $170,000",
        "description": "Secure our Python APIs. Maintain roles-based token authenticators, prevent database injections, and setup double-blind profile checks."
    }
]

MOCK_JOBS = [
    {
        "id": "job-1",
        "title": "Remote Flutter Software Engineer",
        "company": "TechCorp Systems",
        "location": "Remote, US",
        "jobType": "Full-Time",
        "description": "We are looking for a Senior Flutter Developer to build premium, high-performance, glassmorphic applications. Must have experience with Cloud Firestore, Firebase Storage rules, and state orchestration."
    },
    {
        "id": "job-2",
        "title": "Senior Python Backend Architect",
        "company": "Nexus Dynamics",
        "location": "Dallas, TX",
        "jobType": "Full-Time",
        "description": "Develop scalable backend endpoints with Python and Flask. Setup identity checks using face biometrics API and Gemini models. Coordinate secure, roles-based API services."
    },
    {
        "id": "job-3",
        "title": "React Frontend Developer",
        "company": "Vivid Design Agency",
        "location": "Remote, UK",
        "jobType": "Contract",
        "description": "Design modern customer experiences using Next.js and Tailwind. Implement responsive screens for all device classes: folded displays, ipads, and desktops."
    }
]

def crawl_jobs_to_db():
    """
    Crawls simulated jobs feed and inserts them directly into Cloud Firestore 'jobs' collection.
    If firebase is not initialized, it prints out the result simulating a successful sync.
    """
    crawled_count = 0
    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    
    # Shuffle or select randomly to simulate fetching fresh jobs
    selected_jobs = random.sample(CRAWLER_FEED, k=random.randint(2, 4))
    
    print(f"[{now_str}] Job crawler started. Ingesting {len(selected_jobs)} jobs...")
    
    for job in selected_jobs:
        job_data = {
            "title": job["title"],
            "company": job["company"],
            "location": job["location"],
            "jobType": job["jobType"],
            "salary": job["salary"],
            "description": job["description"],
            "crawledAt": now_str,
            "crawled": True,
            "postedAt": now_str,
            "recruiterId": "crawler_system_node"
        }
        
        try:
            if firebase_initialized and db:
                # Add to Firestore collection 'jobs'
                db.collection('jobs').add(job_data)
                crawled_count += 1
            else:
                # Fallback to backend local MOCK list
                # Since routes imports this, routes.py can hook the fallback directly
                # Generate unique mock ID
                job_data["id"] = f"crawled-{random.randint(1000, 9999)}"
                MOCK_JOBS.append(job_data)
                crawled_count += 1
        except Exception as e:
            print(f"Error ingesting job {job['title']}: {e}")
            
    print(f"Successfully ingested {crawled_count} fresh job requisitions.")
    return crawled_count

class IngestionScheduler:
    """
    Spawns background multi-threaded ingestion loops.
    """
    def __init__(self, interval_seconds=3600):
        self.interval = interval_seconds
        self.running = False
        self._thread = None
        
    def _loop(self):
        while self.running:
            try:
                crawl_jobs_to_db()
            except Exception as e:
                print(f"Crawler background thread error: {e}")
            time.sleep(self.interval)
            
    def start(self):
        if not self.running:
            self.running = True
            self._thread = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
            print("Background Job Ingestion Crawler thread successfully launched.")
            
    def stop(self):
        self.running = False
        print("Background Job Ingestion Crawler thread stopped.")
