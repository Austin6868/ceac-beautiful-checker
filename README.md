# CEAC Visa Status Checker

An automated, full-stack application for checking US Visa application statuses on the [Consular Electronic Application Center (CEAC)](https://ceac.state.gov/CEACStatTracker/Default.aspx?App=NIV) website.

Built to bypass CEAC's complex anti-bot measures (ViewState, dynamic CAPTCHAs, and session lockouts), this tool provides a sleek Web UI for real-time status tracking and an automated background cron job for daily status update emails.

![Web UI Demo](frontend/public/favicon.ico) <!-- Placeholder for actual screenshots if added later -->

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (for Next.js)
- **Python**: 3.10+
- **Playwright**: Browser binaries

### Backend Setup
1. Navigate to the backend directory and install Python dependencies via the provided npm script:
   ```bash
   cd backend
   npm run install-deps
   ```
2. Create a `.env` file in the root directory. You can configure your Gemini API key (optional, if you plan to use the fallback solver) and your SMTP credentials for the daily email cron job:
   ```env
   # Captcha Fallback API
   GEMINI_API_KEY=your_google_ai_studio_key

   # Email Subscription Service
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your_email@gmail.com
   SMTP_PASSWORD=your_app_password
   FROM_EMAIL=your_email@gmail.com
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`.

---

## 🌟 Features

- **Automated CEAC Form Submission**: Uses Playwright to navigate the CEAC WebForms architecture, handling JavaScript postbacks and dynamic dropdowns automatically.
- **Dual CAPTCHA Solvers**:
  - **Local ONNX Model (Fast & Free)**: An embedded neural network trained specifically on US State Department captchas. Evaluates image tensors in milliseconds entirely offline.
  - **Google Gemini 2.5 Pro (Fallback)**: High-accuracy generative AI vision model for tricky or highly obscured CAPTCHAs.
- **Real-Time Log Streaming**: The Next.js API route streams standard output directly from the Python child process to the browser via Server-Sent Events (SSE).
- **Daily Email Subscriptions**: Users can subscribe to receive automatic daily emails if their visa status changes. Powered by a local SQLite database and an asynchronous Python cron script.
- **Premium Glassmorphic UI**: Built with Next.js and Tailwind CSS for a modern, responsive, and beautiful user experience. 

---

## 🏗️ Architecture

The repository is split into two tightly integrated components:

### 1. The Backend (`/backend`)
A Python ecosystem responsible for browser automation and AI inference.
- `ceac_checker.py`: The core headless Playwright script. Handles navigation, dropdowns, CAPTCHA interception, and result parsing.
- `onnx_solver.py`: Intercepts screenshot bytes and runs mathematical tensor inferences against the included `captcha.onnx` weights file.
- `cron.py`: An asynchronous script meant to be run daily (e.g., via crontab) that queries the local `subscriptions.db`, runs the checker in parallel for all subscribers via `asyncio.subprocess`, and dispatches SMTP emails on status changes.
- `package.json`: Contains the `npm run install-deps` script to easily bootstrap the Python Pip environment and Chromium headless browsers.

### 2. The Frontend (`/frontend`)
A modern React application built on the Next.js App Router.
- `src/app/page.tsx`: The main landing page. Handles user inputs, solver selection, SSE log parsing, and the subscription modal.
- `src/app/api/check/route.ts`: Starts the Python script using Node's `child_process.spawn()` and streams the stdout back to the client.
- `src/app/api/subscribe/route.ts`: Manages the local SQLite database (`subscriptions.db`) using `better-sqlite3`.

---

## 🛠️ Manual CLI Usage

You can completely bypass the Next.js frontend and query the CEAC tracker directly from your terminal using the Python backend.

```bash
python3 backend/ceac_checker.py \
  --case AA00000000 \
  --passport P1234567 \
  --surname SMITH \
  --location BEJ \
  --solver onnx
```

**Options:**
- `--location`: The 3-letter Embassy/Consulate code (e.g., `BEJ` for Beijing, `GUZ` for Guangzhou, `SHG` for Shanghai).
- `--solver`: Choose between `onnx` (local, free) or `gemini` (cloud API).

---

## ⏰ Setting up the Daily Cron Job

To automatically send daily email updates to users who subscribed through the Web UI, add the `cron.py` script to your system's crontab.

1. Open your crontab editor:
   ```bash
   crontab -e
   ```
2. Add the following line to run the script every day at 8:00 AM:
   ```bash
   0 8 * * * cd /path/to/ceac-llm-checker/backend && python3 cron.py >> /var/log/ceac_cron.log 2>&1
   ```

---

## 📜 Acknowledgements
- Local ONNX Captcha Tensor Model weights provided by the [Andision/CEACStatusBot](https://github.com/Andision/CEACStatusBot) project.
