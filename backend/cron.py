import sqlite3
import asyncio
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", SMTP_USERNAME)

DB_PATH = os.path.join(os.path.dirname(__file__), "subscriptions.db")

def send_email(to_email, subject, body):
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print(f"[MAIL_STUB] Would have sent to {to_email}: {subject}")
        return

    msg = MIMEMultipart()
    msg['From'] = FROM_EMAIL
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"Sent email to {to_email}")
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")


async def check_visa(case_number, passport, surname, location):
    # Run the core logic checker in a completely isolated subprocess
    # This ensures Playwright instances don't crash from sharing same thread logic
    script_path = os.path.join(os.path.dirname(__file__), "ceac_checker.py")
    
    cmd = [
        "python3", script_path,
        "--case", case_number,
        "--passport", passport,
        "--surname", surname,
        "--location", location
    ]
    
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    stdout, stderr = await process.communicate()
    output = stdout.decode()
    
    # Parse output just like the API boundary does
    status = None
    for line in output.split("\n"):
        if line.startswith("Status:"):
            status = line.split(":", 1)[1].strip()
            break
            
    return status, output


async def process_subscriber(sub, db_conn):
    sub_id, email, case_number, passport, surname, location, last_status = sub
    
    print(f"[{case_number}] Checking status for {email}...")
    status, output = await check_visa(case_number, passport, surname, location)
    
    if not status:
        print(f"[{case_number}] Failed to get status for {email}. (Timeout/Captcha error?)")
        return

    # If status has changed or not yet set
    if status != last_status:
        print(f"[{case_number}] Status changed! {last_status} -> {status}. Sending email.")
        
        subject = f"CEAC Visa Status Update: {case_number} is now {status}"
        body = f"Hello,\n\nYour US Visa processing status has changed!\n\nNew Status: {status}\n\nFull Logs:\n\n{output}\n\n- CEAC Tracker Bot"
        
        send_email(email, subject, body)
        
        # Update db
        cursor = db_conn.cursor()
        cursor.execute("UPDATE subscribers SET last_status = ? WHERE id = ?", (status, sub_id))
        db_conn.commit()
    else:
        print(f"[{case_number}] Unchanged ({status}).")


async def main():
    if not os.path.exists(DB_PATH):
        print("Database not found. Make sure the API route has created it first.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, email, case_number, passport, surname, location, last_status FROM subscribers")
        subscribers = cursor.fetchall()
    except sqlite3.OperationalError:
       print("Subscribers table doesn't exist yet! No one has subscribed.")
       return

    print(f"Found {len(subscribers)} subscribers. Checking in parallel...")

    # Limit concurrency to 5 browsers at a time to prevent RAM overload
    semaphore = asyncio.Semaphore(5)
    
    async def sem_process(sub):
        async with semaphore:
            await process_subscriber(sub, conn)
            
    tasks = [sem_process(sub) for sub in subscribers]
    
    # Run all tasks concurrently
    await asyncio.gather(*tasks)
    
    conn.close()
    print("Cron job finished!")


if __name__ == "__main__":
    asyncio.run(main())
