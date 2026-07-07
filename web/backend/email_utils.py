"""
email_utils.py — Transactional email via Resend.
All public send_* functions are fire-and-forget; errors are logged but never raised.
"""

import os
import threading
import logging

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_ADDRESS = os.environ.get("EMAIL_FROM", "RecruitEdge <onboarding@resend.dev>")
PLATFORM_NAME = "RecruitEdge"
PLATFORM_URL = os.environ.get("PLATFORM_URL", "http://localhost:3000")

# ---------------------------------------------------------------------------
# Base HTML shell — dark-themed, inline-styled for email clients
# ---------------------------------------------------------------------------
def _html_shell(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;padding:0;background:#0a0d14;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0d14;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1f2937;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#0891b2);padding:32px 40px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
              ✦ {PLATFORM_NAME}
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;
                      letter-spacing:2px;">AI-Powered Career Platform</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            {body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#0d1117;padding:20px 40px;border-top:1px solid #1f2937;">
            <p style="margin:0;color:#6b7280;font-size:11px;text-align:center;">
              You received this email from {PLATFORM_NAME} ·
              <a href="{PLATFORM_URL}" style="color:#6366f1;text-decoration:none;">Visit Platform</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _badge(text: str, color: str = "#4f46e5") -> str:
    return (f'<span style="display:inline-block;background:{color}22;color:{color};'
            f'border:1px solid {color}44;border-radius:20px;padding:4px 12px;'
            f'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">'
            f'{text}</span>')


def _btn(text: str, href: str) -> str:
    return (f'<a href="{href}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#0891b2);'
            f'color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;'
            f'font-size:14px;margin-top:24px;">{text}</a>')


# ---------------------------------------------------------------------------
# Low-level sender
# ---------------------------------------------------------------------------
def _send(to: str, subject: str, html: str):
    """Send via Resend SDK. Runs synchronously — call from a thread for fire-and-forget."""
    if not RESEND_API_KEY:
        logger.warning("[EMAIL] RESEND_API_KEY not set — skipping email to %s", to)
        return
    try:
        import resend  # pip install resend
        resend.api_key = RESEND_API_KEY
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        logger.info("[EMAIL] Sent '%s' to %s", subject, to)
    except Exception as exc:
        logger.error("[EMAIL] Failed to send '%s' to %s: %s", subject, to, exc)


def _async(to: str, subject: str, html: str):
    """Fire-and-forget wrapper so routes never block on email."""
    threading.Thread(target=_send, args=(to, subject, html), daemon=True).start()


# ---------------------------------------------------------------------------
# 1. Application status update
# ---------------------------------------------------------------------------
STATUS_COLORS = {
    "Hired": "#10b981",
    "Offer Extended": "#10b981",
    "Interview Scheduled": "#6366f1",
    "Interviewed": "#6366f1",
    "Under Review": "#f59e0b",
    "Shortlisted": "#f59e0b",
    "Rejected": "#ef4444",
}

def send_application_status_email(to: str, candidate_name: str, job_title: str,
                                   company: str, new_status: str, recruiter_notes: str = ""):
    color = STATUS_COLORS.get(new_status, "#6366f1")
    notes_block = ""
    if recruiter_notes:
        notes_block = (f'<div style="margin-top:20px;background:#1a2332;border-left:3px solid {color};'
                       f'padding:14px 18px;border-radius:0 8px 8px 0;">'
                       f'<p style="margin:0;color:#9ca3af;font-size:12px;font-weight:700;'
                       f'text-transform:uppercase;letter-spacing:1px;">Recruiter Note</p>'
                       f'<p style="margin:8px 0 0;color:#e5e7eb;font-size:14px;line-height:1.6;">'
                       f'{recruiter_notes}</p></div>')

    body = f"""
    <p style="margin:0 0 6px;color:#9ca3af;font-size:13px;">Hi {candidate_name},</p>
    <h2 style="margin:0 0 20px;color:#f9fafb;font-size:20px;font-weight:800;">
      Your application status has been updated
    </h2>
    <div style="background:#1f2937;border-radius:12px;padding:20px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0;color:#9ca3af;font-size:13px;width:120px;">Position</td>
          <td style="padding:6px 0;color:#f9fafb;font-weight:700;font-size:14px;">{job_title}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Company</td>
          <td style="padding:6px 0;color:#f9fafb;font-weight:700;font-size:14px;">{company}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#9ca3af;font-size:13px;">New Status</td>
          <td style="padding:6px 0;">{_badge(new_status, color)}</td>
        </tr>
      </table>
    </div>
    {notes_block}
    {_btn("View Application →", f"{PLATFORM_URL}/candidate/jobs")}
    <p style="margin:28px 0 0;color:#6b7280;font-size:12px;">
      Good luck with your application! The {PLATFORM_NAME} team is rooting for you.
    </p>
    """
    _async(to, f"Application Update: {new_status} — {job_title} at {company}",
           _html_shell(f"Application Update — {PLATFORM_NAME}", body))


# ---------------------------------------------------------------------------
# 2. Interview scheduled
# ---------------------------------------------------------------------------
def send_interview_scheduled_email(to: str, candidate_name: str, job_title: str,
                                    company: str, interview_datetime: str, meet_link: str = ""):
    meet_block = ""
    if meet_link:
        meet_block = (f'<p style="margin:12px 0 0;"><a href="{meet_link}" '
                      f'style="color:#0891b2;font-size:13px;font-weight:600;">🎥 Join Google Meet</a></p>')
    body = f"""
    <p style="margin:0 0 6px;color:#9ca3af;font-size:13px;">Hi {candidate_name},</p>
    <h2 style="margin:0 0 20px;color:#f9fafb;font-size:20px;font-weight:800;">
      Interview Scheduled
    </h2>
    <div style="background:#1f2937;border-radius:12px;padding:20px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0;color:#9ca3af;font-size:13px;width:120px;">Position</td>
          <td style="padding:6px 0;color:#f9fafb;font-weight:700;font-size:14px;">{job_title}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Company</td>
          <td style="padding:6px 0;color:#f9fafb;font-weight:700;font-size:14px;">{company}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Date &amp; Time</td>
          <td style="padding:6px 0;color:#6366f1;font-weight:700;font-size:14px;">{interview_datetime}</td>
        </tr>
      </table>
      {meet_block}
    </div>
    <div style="background:#1a2332;border-left:3px solid #6366f1;padding:14px 18px;
                border-radius:0 8px 8px 0;margin-bottom:4px;">
      <p style="margin:0;color:#e5e7eb;font-size:13px;line-height:1.6;">
        Make sure your microphone and camera are tested before the interview.
        The AI-proctored arena will verify your identity automatically.
      </p>
    </div>
    {_btn("Go to Interview Arena →", f"{PLATFORM_URL}/candidate/interview")}
    """
    _async(to, f"Interview Scheduled — {job_title} at {company}",
           _html_shell(f"Interview Scheduled — {PLATFORM_NAME}", body))


# ---------------------------------------------------------------------------
# 3. Connection request received
# ---------------------------------------------------------------------------
def send_connection_request_email(to: str, recipient_name: str, sender_name: str, sender_role: str):
    role_badge = _badge(sender_role.capitalize(), "#f59e0b")
    body = f"""
    <p style="margin:0 0 6px;color:#9ca3af;font-size:13px;">Hi {recipient_name},</p>
    <h2 style="margin:0 0 20px;color:#f9fafb;font-size:20px;font-weight:800;">
      New Connection Request
    </h2>
    <div style="background:#1f2937;border-radius:12px;padding:20px;margin-bottom:20px;
                display:flex;align-items:center;gap:16px;">
      <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#0891b2);
                  display:flex;align-items:center;justify-content:center;
                  color:#fff;font-size:20px;font-weight:800;flex-shrink:0;">
        {sender_name[0].upper()}
      </div>
      <div>
        <p style="margin:0;color:#f9fafb;font-weight:700;font-size:15px;">{sender_name}</p>
        <p style="margin:4px 0 0;">{role_badge}</p>
      </div>
    </div>
    <p style="color:#9ca3af;font-size:13px;line-height:1.6;">
      wants to connect with you on {PLATFORM_NAME}.
      Accept to start messaging and grow your professional network.
    </p>
    {_btn("View Request →", f"{PLATFORM_URL}/candidate/network")}
    """
    _async(to, f"{sender_name} wants to connect with you on {PLATFORM_NAME}",
           _html_shell(f"New Connection Request — {PLATFORM_NAME}", body))


# ---------------------------------------------------------------------------
# 4. Connection accepted
# ---------------------------------------------------------------------------
def send_connection_accepted_email(to: str, sender_name: str, acceptor_name: str):
    body = f"""
    <p style="margin:0 0 6px;color:#9ca3af;font-size:13px;">Hi {sender_name},</p>
    <h2 style="margin:0 0 20px;color:#f9fafb;font-size:20px;font-weight:800;">
      Connection Accepted 🎉
    </h2>
    <div style="background:#1f2937;border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0;color:#e5e7eb;font-size:14px;line-height:1.6;">
        <strong style="color:#10b981;">{acceptor_name}</strong> accepted your connection request.
        You can now message each other directly on {PLATFORM_NAME}.
      </p>
    </div>
    {_btn("Start Messaging →", f"{PLATFORM_URL}/candidate/messages")}
    """
    _async(to, f"{acceptor_name} accepted your connection on {PLATFORM_NAME}",
           _html_shell(f"Connection Accepted — {PLATFORM_NAME}", body))


# ---------------------------------------------------------------------------
# 5. Job alert match
# ---------------------------------------------------------------------------
def send_job_alert_email(to: str, candidate_name: str, alert_keywords: str, matched_jobs: list):
    jobs_html = ""
    for job in matched_jobs[:5]:
        jobs_html += f"""
        <div style="background:#1a2332;border:1px solid #1f2937;border-radius:10px;
                    padding:16px;margin-bottom:12px;">
          <p style="margin:0;color:#f9fafb;font-weight:700;font-size:14px;">{job.get('title','')}</p>
          <p style="margin:4px 0;color:#9ca3af;font-size:12px;">
            {job.get('company','')} · {job.get('location','')}
          </p>
          <p style="margin:6px 0 0;color:#6366f1;font-size:12px;font-weight:600;">
            {job.get('salary','Competitive')}
          </p>
        </div>"""

    body = f"""
    <p style="margin:0 0 6px;color:#9ca3af;font-size:13px;">Hi {candidate_name},</p>
    <h2 style="margin:0 0 6px;color:#f9fafb;font-size:20px;font-weight:800;">
      New jobs match your alert
    </h2>
    <p style="margin:0 0 24px;color:#9ca3af;font-size:13px;">
      Alert: {_badge(alert_keywords, "#6366f1")}
    </p>
    {jobs_html}
    {_btn(f"View All {len(matched_jobs)} Matches →", f"{PLATFORM_URL}/candidate/jobs")}
    <p style="margin:28px 0 0;color:#6b7280;font-size:12px;">
      Manage your job alerts in <a href="{PLATFORM_URL}/candidate/jobs"
      style="color:#6366f1;">Settings → Job Alerts</a>.
    </p>
    """
    _async(to, f"{len(matched_jobs)} new job{'s' if len(matched_jobs) > 1 else ''} match your alert: {alert_keywords}",
           _html_shell(f"Job Alert — {PLATFORM_NAME}", body))


# ---------------------------------------------------------------------------
# 6. 2FA OTP email (backup channel)
# ---------------------------------------------------------------------------
def send_2fa_otp_email(to: str, name: str, otp: str):
    body = f"""
    <p style="margin:0 0 6px;color:#9ca3af;font-size:13px;">Hi {name},</p>
    <h2 style="margin:0 0 20px;color:#f9fafb;font-size:20px;font-weight:800;">
      Your verification code
    </h2>
    <div style="background:#1f2937;border-radius:12px;padding:32px;text-align:center;
                margin-bottom:20px;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;
                letter-spacing:2px;margin-bottom:12px;">One-Time Passcode</p>
      <span style="font-size:40px;font-weight:900;color:#6366f1;letter-spacing:10px;
                   font-family:monospace;">{otp}</span>
      <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">
        Valid for 10 minutes. Do not share this code.
      </p>
    </div>
    <p style="color:#6b7280;font-size:12px;">
      If you did not request this, please secure your account immediately.
    </p>
    """
    _async(to, f"Your {PLATFORM_NAME} verification code: {otp}",
           _html_shell(f"Verification Code — {PLATFORM_NAME}", body))
