import datetime
import os
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# Define the scopes required for Google Calendar API
SCOPES = ['https://www.googleapis.com/auth/calendar.events']

def get_google_calendar_service():
    """
    Authenticates and returns a Google Calendar API service object.
    This is a simplified authentication flow for development.
    For production, implement a robust OAuth 2.0 flow to store and refresh user tokens.
    """
    creds = None
    # The file token.pickle stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Ensure credentials.json (downloaded from Google Cloud Console) is in the backend directory
            if not os.path.exists('credentials.json'):
                print("Error: credentials.json not found. Please download it from Google Cloud Console and place it in the backend directory.")
                raise FileNotFoundError("credentials.json missing for Google Calendar API.")
            
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            # IMPORTANT: Changed port=5000 to 5003 to prevent port collision with Flask backend
            # Ensure this port is registered in Google Cloud Console -> OAuth client ID -> Authorized redirect URIs
            creds = flow.run_local_server(port=5003, success_message='Authentication complete. You can close this window.') 
        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    
    service = build('calendar', 'v3', credentials=creds)
    return service

def create_calendar_event(
    summary: str,
    description: str,
    start_time: datetime.datetime,
    end_time: datetime.datetime,
    attendees: list[str],
    time_zone: str = 'America/New_York' # Default to Eastern Time
):
    """
    Creates an event in the primary Google Calendar.

    Args:
        summary (str): Event title.
        description (str): Event description.
        start_time (datetime.datetime): Start time of the event.
        end_time (datetime.datetime): End time of the event.
        attendees (list[str]): List of attendee emails.
        time_zone (str): Time zone for the event.
    """
    service = get_google_calendar_service()

    event = {
        'summary': summary,
        'description': description,
        'start': {
            'dateTime': start_time.isoformat(),
            'timeZone': time_zone,
        },
        'end': {
            'dateTime': end_time.isoformat(),
            'timeZone': time_zone,
        },
        'attendees': [{'email': email} for email in attendees],
        'reminders': {
            'useDefault': False,
            'overrides': [
                {'method': 'email', 'minutes': 24 * 60},  # 24 hours prior
                {'method': 'popup', 'minutes': 10},      # 10 minutes prior
            ],
        },
        'conferenceData': { # Add Google Meet link
            'createRequest': {
                'requestId': 'meeting_request_id',
                'conferenceSolutionKey': {
                    'type': 'hangoutsMeet'
                }
            }
        }
    }

    event = service.events().insert(calendarId='primary', 
                                    sendNotifications=True, # Send email invitations
                                    conferenceDataVersion=1, # Required for conferenceData
                                    body=event).execute()
    
    print(f"Event created: {event.get('htmlLink')}")
    return event.get('htmlLink')

if __name__ == '__main__':
    # Example usage for testing (run this file directly once to authenticate)
    print("Running Google Calendar utility for initial authentication...")
    try:
        service = get_google_calendar_service()
        print("Authentication successful. Service object created.")
        # You can now test event creation if needed
        # Example:
        # now = datetime.datetime.now(datetime.timezone.utc).astimezone()
        # future = now + datetime.timedelta(hours=1)
        # create_calendar_event(
        #     "Test Interview with Candidate X",
        #     "Discussion about Python Intern role.",
        #     now,
        #     future,
        #     ["recruiter@example.com", "candidate@example.com"]
        # )
    except Exception as e:
        print(f"Authentication failed: {e}")

