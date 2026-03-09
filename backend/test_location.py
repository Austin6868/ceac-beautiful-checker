import asyncio
from playwright.async_api import async_playwright
import time

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("Navigating...")
        await page.goto("https://ceac.state.gov/CEACStatTracker/Default.aspx?App=NIV", wait_until="domcontentloaded")
        
        await page.wait_for_selector("#Visa_Application_Type")
        await page.select_option("#Visa_Application_Type", "NIV")
        
        print("Waiting for Location dropdown to populate...")
        # Wait until the 'BEJ' option is actually present
        await page.wait_for_selector("select[name='ctl00$ContentPlaceHolder1$Location_Dropdown'] option[value='BEJ']", timeout=15000)
        
        print("Selecting BEJ...")
        try:
             await page.select_option("select[name='ctl00$ContentPlaceHolder1$Location_Dropdown']", value="BEJ")
             print("SUCCESS")
        except Exception as e:
             print("ERR", e)
             
        # Verify it
        val = await page.evaluate("document.querySelector('select[name=\"ctl00$ContentPlaceHolder1$Location_Dropdown\"]').value")
        print("Current value in DOM:", val)
        
        await browser.close()
        
if __name__ == "__main__":
    asyncio.run(main())
