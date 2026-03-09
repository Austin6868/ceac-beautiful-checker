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

import onnx_solver

load_dotenv()

API_KEY = os.environ.get("GEMINI_API_KEY")

async def solve_captcha_gemini(img_bytes):
    if not API_KEY:
        print("Error: GEMINI_API_KEY environment variable not set. Falling back to ONNX...")
        return onnx_solver.solve_captcha(img_bytes)
    print("Sending captcha to Google Gemini API...")
    try:
        client = genai.Client(api_key=API_KEY)
        img = PIL.Image.open(io.BytesIO(img_bytes))
        prompt = "Read the characters in this CAPTCHA image. Reply ONLY with the exact letters and numbers shown, with no other text, spaces, or punctuation."
        response = client.models.generate_content(
            model='gemini-2.5-pro',
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
    parser.add_argument("--case", required=True, help="Application ID or Case Number (e.g., AA00000000)")
    parser.add_argument("--passport", required=True, help="Passport Number")
    parser.add_argument("--surname", required=True, help="First 5 letters of Surname")
    parser.add_argument("--location", required=True, help="Location Code (e.g., BEJ for Beijing, GUZ for Guangzhou)")
    parser.add_argument("--solver", choices=["onnx", "gemini"], default="onnx", help="Backend CAPTCHA solver to use")
    args = parser.parse_args()

    print(f"CEAC Visa Status Checker using Playwright and {args.solver.upper()} solver")
    print("-" * 40)
    
    case_number = args.case
    passport = args.passport
    surname = args.surname
    location = args.location
    solver_choice = args.solver
    
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
        print("Filling out form dropdowns...")
        try:
            # Application Type (default is usually NIV, but lets explicitly set it just in case)
            print("Selecting Application Type...")
            await page.wait_for_selector("#Visa_Application_Type")
            await page.select_option("#Visa_Application_Type", "NIV")
            
            # Location
            print(f"Selecting location {location}...")
            try:
                # Forcefully set the underlying value and manually trigger its required WebForms postback
                await page.select_option("select[name='ctl00$ContentPlaceHolder1$Location_Dropdown']", value=location, force=True)
                await page.evaluate("__doPostBack('ctl00$ContentPlaceHolder1$Location_Dropdown','')")
                print(f"Successfully selected {location} and triggered postback")
            except Exception as e:
                print(f"Could not select location {location}: {e}")
                
            # Wait for any postback from Location drop to finish loading the new Captcha
            print("Waiting for final CAPTCHA to load...")
            await asyncio.sleep(3)
            
            # Now extract the CAPTCHA image
            captcha_img_element = await page.query_selector("#c_status_ctl00_contentplaceholder1_defaultcaptcha_CaptchaImage")
            if not captcha_img_element:
                print("Error: Could not find captcha image on page.")
                return
                
            img_bytes = await captcha_img_element.screenshot()
        except Exception as e:
            print(f"Error loading page or dropdowns: {e}")
            return
            
        print(f"Sending final captcha to {solver_choice.upper()} solver...")
        if solver_choice == "gemini":
            captcha_text = await solve_captcha_gemini(img_bytes)
        else:
            captcha_text = onnx_solver.solve_captcha(img_bytes)
            
        if not captcha_text:
            print("Failed to solve captcha.")
            return
            
        print(f"Captcha solved: {captcha_text}")
        
        # Fill out remaining form fields
        print("Filling case number...")
        await asyncio.sleep(2) # wait for location postback
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
        
        # Use mouse click to ensure it triggers any attached event listeners
        print("Waiting for response page...")
        try:
            async with page.expect_navigation(timeout=30000):
                await page.click("#ctl00_ContentPlaceHolder1_btnSubmit", delay=100)
        except Exception as e:
            print("Navigation timed out or failed:", e)
        
        # Check for error message
        error_elem = await page.query_selector("#ctl00_ContentPlaceHolder1_lblError")
        if error_elem:
            error_text = await error_elem.inner_text()
            if error_text.strip():
                print(f"\n--- ERROR ---")
                print(error_text.strip())
                print("-------------\n")
        
        # Check for status message
        status_elem = await page.query_selector("#ctl00_ContentPlaceHolder1_ucApplicationStatusView_lblStatus")
        date_elem = await page.query_selector("#ctl00_ContentPlaceHolder1_ucApplicationStatusView_lblSubmitDate")
        updated_elem = await page.query_selector("#ctl00_ContentPlaceHolder1_ucApplicationStatusView_lblStatusDate")
        desc_elem = await page.query_selector("#ctl00_ContentPlaceHolder1_ucApplicationStatusView_lblMessage")
        
        if status_elem:
            status_text = await status_elem.inner_text()
            print("\n--- STATUS RESULT ---")
            print(f"Status: {status_text.strip()}")
            
            if date_elem:
                date_text = await date_elem.inner_text()
                print(f"Case Created: {date_text.strip()}")
                
            if updated_elem:
                updated_text = await updated_elem.inner_text()
                print(f"Case Last Updated: {updated_text.strip()}")
                
            if desc_elem:
                desc_text = await desc_elem.inner_text()
                print(f"Description: {desc_text.strip()}")
            print("---------------------\n")
        else:
            print("Could not find status information on the resulting page.")

        # Ensure browser is closed
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
