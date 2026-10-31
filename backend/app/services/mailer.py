"""
Email service.

EMAIL_MODE=console  — prints the email to stdout/logs, labelled DEV EMAIL.
EMAIL_MODE=smtp     — sends via smtplib with STARTTLS using env SMTP_* vars.

Never claim the email was sent in console mode.
"""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """Send (or print) a password-reset email."""
    subject = "SubSentry – Reset Your Password"
    body_text = (
        f"Hi,\n\n"
        f"You requested a password reset for your SubSentry account.\n\n"
        f"Use the link below within 30 minutes:\n\n"
        f"  {reset_link}\n\n"
        f"If you did not request this, ignore this email.\n\n"
        f"— SubSentry"
    )
    body_html = f"""
<p>Hi,</p>
<p>You requested a password reset for your SubSentry account.</p>
<p>Click the button below within <strong>30 minutes</strong>:</p>
<p><a href="{reset_link}" style="padding:10px 20px;background:#4f46e5;color:#fff;
text-decoration:none;border-radius:4px;">Reset Password</a></p>
<p>Or copy this link: <code>{reset_link}</code></p>
<p>If you did not request this, ignore this email.</p>
<p>— SubSentry</p>
"""

    if settings.EMAIL_MODE == "smtp":
        _send_via_smtp(to_email, subject, body_text, body_html)
    else:
        _print_to_console(to_email, subject, reset_link, body_text)


def _print_to_console(to: str, subject: str, reset_link: str, body: str) -> None:
    """
    DEV EMAIL: print to terminal. Does NOT send an actual email.
    Use EMAIL_MODE=smtp in production.
    """
    separator = "=" * 60
    logger.info(
        "\n%s\n[DEV EMAIL] To: %s\nSubject: %s\nReset link: %s\n\n%s\n%s",
        separator, to, subject, reset_link, body, separator,
    )
    # Also print to stdout so it's visible even without a log handler
    print(f"\n{separator}")
    print(f"[DEV EMAIL] To: {to}")
    print(f"Subject: {subject}")
    print(f"Reset link: {reset_link}")
    print(f"{separator}\n")


def _send_via_smtp(to: str, subject: str, body_text: str, body_html: str) -> None:
    """Send an actual email via STARTTLS SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [to], msg.as_string())
        logger.info("Password reset email sent to %s", to)
    except Exception as exc:
        # Log but don't expose SMTP details in the API response
        logger.error("Failed to send reset email to %s: %s", to, exc)
        raise
