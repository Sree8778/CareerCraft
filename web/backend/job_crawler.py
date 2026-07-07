import threading
import time
import datetime

# CRAWLER_FEED and MOCK_JOBS removed — all job data comes from Firebase.
# To add jobs, use the recruiter dashboard or seed the Firestore 'jobs' collection directly.

MOCK_JOBS = []  # kept as empty list so existing imports don't break

def crawl_jobs_to_db():
    """
    Placeholder — real job ingestion requires an external feed.
    Returns 0; no hardcoded jobs are inserted into Firebase.
    """
    print(f"[{datetime.datetime.utcnow().isoformat()}Z] Job crawler: no feed configured. Skipping ingestion.")
    return 0

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
