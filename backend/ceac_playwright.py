import asyncio
import base64
import time
from playwright.async_api import async_playwright
from google import genai
import PIL.Image
import io
import os
import sys
import argparse
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("Error: GEMINI_API_KEY environment variable not set.")
    sys.exit(1)

async def solve_captcha(img_bytes):
    print("Sending captcha to Google Gemini API...")
    try:
        client = genai.Client(api_key=API_KEY)
        img = PIL.Image.open(io.BytesIO(img_bytes))
        prompt = "Read the text in this CAPTCHA image. Reply ONLY with the exact letters and numbers shown, with no other text, spaces, or punctuation."
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=[prompt, img]
        )
        solution = response.text.strip()
        print(f"Captcha solved: {solution}")
        return solution
    except Exception as e:
        print(f"Error solving captcha with Gemini: {e}")
        return None

async def handle_dialog(dialog):
    print(f"Javascript Alert: {dialog.message}")
    await dialog.accept()

async def main():
    parser = argparse.ArgumentParser(description="CEAC Visa Status Checker")
    parser.add_argument("--case", required=True, help="Application ID or Case Number (e.g., AA00F7XQGR)")
    parser.add_argument("--passport", required=True, help="Passport Number")
    parser.add_argument("--surname", required=True, help="First 5 letters of Surname")
    parser.add_argument("--location", required=True, help="Location Code (e.g., BEJ for Beijing, GUZ for Guangzhou)")
    args = parser.parse_args()

    print("CEAC Visa Status Checker using Playwright and Google Gemini API")
    print("-" * 40)
    
    case_number = args.case
    passport = args.passport
    surname = args.surname
    location = args.location
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()
        
        # Intercept and log any Javascript alerts/dialogs
        page.on("dialog", lambda dialog: asyncio.create_task(handle_dialog(dialog)))
        
        print("Navigating to CEAC status page...")
        await page.goto("https://ceac.state.gov/CEACStatTracker/Default.aspx?App=NIV", wait_until="domcontentloaded")
        
        # CEAC often redirects from Default.aspx to Status.aspx. Wait for it.
        if "Default.aspx" in page.url:
            print("Waiting for redirect to Status.aspx...")
            await page.wait_for_url("**/Status.aspx*", timeout=15000)
            
        # Give JS time to initialize the form
        await asyncio.sleep(2)
        
        # Wait for the captcha image to appear
        print("Waiting for CAPTCHA image to load...")
        try:
            await page.wait_for_selector("#c_status_ctl00_contentplaceholder1_defaultcaptcha_CaptchaImage", timeout=10000)
            
            # The CAPTCHA image often needs a little time to fully render the text
            await asyncio.sleep(2)
            
            # Get the image element and take a screenshot of just the CAPTCHA
            captcha_element = await page.query_selector("#c_status_ctl00_contentplaceholder1_defaultcaptcha_CaptchaImage")
            if not captcha_element:
                print("CAPTCHA image element not found.")
                return
                
            img_bytes = await captcha_element.screenshot()
            
            # Solve CAPTCHA using Gemini
            captcha_text = await solve_captcha(img_bytes)
            if not captcha_text:
                return
            
            # Fill out the form
            print("Filling out form...")
            # Application Type (default is usually NIV, but lets explicitly set it just in case)
            print("Selecting Application Type...")
            await page.wait_for_selector("#Visa_Application_Type")
            await page.select_option("#Visa_Application_Type", "NIV")
            
            # Location (The value is the first 3 letters of case number, e.g. "AA0" -> "AA0" or "BEJ" -> "BEJ", wait for dropdown to populate)
            print("Selecting location...")
            await asyncio.sleep(3) # wait for application type postback
            import os
            cwd = os.getcwd()
            await page.screenshot(path=f"{cwd}/playwright_step1_apptype.png")
            
            location_code = case_number[:3]
            try:
                await page.wait_for_selector("#Location_Dropdown", timeout=10000)
                options = await page.locator("#Location_Dropdown option").all_text_contents()
                # Forcefully set the underlying value and manually trigger its required WebForms postback
                await page.select_option("select[name='ctl00$ContentPlaceHolder1$Location_Dropdown']", value=location, force=True)
                await page.evaluate("__doPostBack('ctl00$ContentPlaceHolder1$Location_Dropdown','')")
                print(f"Successfully selected {location} and triggered postback")
            except Exception as e:
                print(f"Could not select location {location}: {e}")
                
            # Case Number
            print("Filling case number...")
            await asyncio.sleep(2) # wait for location postback
            await page.screenshot(path=f"{cwd}/playwright_step2_location.png")
            await page.type("#Visa_Case_Number", case_number, delay=100)
            
            # Passport Number (might not be visible immediately, handle if needed)
            if await page.is_visible("#Passport_Number"):
                 await page.type("#Passport_Number", passport, delay=100)
            
            # Surname (might not be visible immediately)
            if await page.is_visible("#Surname"):
                 await page.type("#Surname", surname, delay=100)
            
            # CAPTCHA Code
            await page.type("#Captcha", captcha_text, delay=100)
            
            # Submit form
            print("Submitting form...")
            await asyncio.sleep(1) # Let TS scripts register the inputs
            
            await page.screenshot(path=f"{cwd}/playwright_before_submit.png")
            print(f"Saved screenshot to {cwd}/playwright_before_submit.png")
            
            # Use mouse click to ensure it triggers any attached event listeners
            submit_btn = await page.query_selector("#ctl00_ContentPlaceHolder1_btnSubmit")
            if submit_btn:
                await submit_btn.scroll_into_view_if_needed()
                await submit_btn.click()
            else:
                await page.click("#ctl00_ContentPlaceHolder1_btnSubmit")
                
            print("Waiting for response page...")
            await page.wait_for_load_state("networkidle", timeout=15000)
            
            # Check for error message
            error_elem = await page.query_selector("#ctl00_ContentPlaceHolder1_lblError")
            if error_elem:
                error_text = await error_elem.inner_text()
                if error_text.strip():
                    print(f"Error from CEAC: {error_text.strip()}")
            
            # Check for status message
            status_elem = await page.query_selector("#ctl00_ContentPlaceHolder1_ucApplicationStatusUpdate_lblMessage")
            date_elem = await page.query_selector("#ctl00_ContentPlaceHolder1_ucApplicationStatusUpdate_lblSubmitDate")
            desc_elem = await page.query_selector(".status-text")
            
            if status_elem:
                status_text = await status_elem.inner_text()
                print("\n--- STATUS RESULT ---")
                print(f"Status: {status_text.strip()}")
                
                if date_elem:
                    date_text = await date_elem.inner_text()
                    print(f"Date: {date_text.strip()}")
                    
                if desc_elem:
                    desc_text = await desc_elem.inner_text()
                    print(f"Description: {desc_text.strip()}")
                print("---------------------\n")
            else:
                print("Could not find status information on the resulting page.")

        except Exception as e:
            print(f"An error occurred: {e}")
            
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
