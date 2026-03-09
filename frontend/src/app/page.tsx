"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [caseNumber, setCaseNumber] = useState("");
  const [passport, setPassport] = useState("");
  const [surname, setSurname] = useState("");
  const [location, setLocation] = useState("BEJ");
  const [solver, setSolver] = useState("onnx");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);

  // Subscription States
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [subMessage, setSubMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const runCheck = async (): Promise<boolean> => {
    return new Promise(async (resolve) => {
      try {
        const response = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            case_number: caseNumber,
            passport,
            surname,
            location,
            solver,
          }),
        });

        if (!response.ok) {
           const errData = await response.json();
           setError(errData.error || "Failed API call");
           return resolve(false);
        }

        if (!response.body) {
           setError("No response body");
           return resolve(false);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let successfulResult = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const events = chunk.split("\n\n");
            
            for (const ev of events) {
              if (ev.startsWith("data: ")) {
                try {
                  const dataStr = ev.substring(6);
                  if (!dataStr.trim()) continue;
                  const payload = JSON.parse(dataStr);
                  
                  if (payload.type === "log") {
                     setLogs(prev => [...prev, payload.payload]);
                     console.log("[Backend log]:", payload.payload);
                  } else if (payload.type === "result") {
                     setResult(payload.payload);
                     successfulResult = true;
                  } else if (payload.type === "error") {
                     setError(payload.payload.error);
                  }
                } catch (e) {
                   // ignoring partial json chunks if any
                }
              }
            }
          }
        }
        resolve(successfulResult);
      } catch (err: any) {
        setError(err.message);
        resolve(false);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setLogs([]);
    setAttemptCount(0);

    const maxRetries = 3;
    let success = false;

    for (let i = 1; i <= maxRetries; i++) {
        setAttemptCount(i);
        setLogs(prev => [...prev, `[System] -> Starting Check Attempt ${i} of ${maxRetries}...`]);
        setError(null); 
        
        success = await runCheck();
        
        if (success) {
            break;
        }
        
        if (i < maxRetries) {
            setLogs(prev => [...prev, `[System] -> Attempt ${i} failed. Retrying in 2 seconds...`]);
            await new Promise(r => setTimeout(r, 2000));
        } else {
            setLogs(prev => [...prev, `[System] -> All ${maxRetries} attempts failed.`]);
            if (!error) setError(`Failed after ${maxRetries} attempts.`);
        }
    }

    setLoading(false);
  };

  const handleSubscribe = async () => {
    if (!email || !email.includes("@")) {
       setSubMessage({ text: "Please enter a valid email.", isError: true });
       return;
    }
    setSubscribing(true);
    setSubMessage(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, case_number: caseNumber, passport, surname, location })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubMessage({ text: data.message, isError: false });
      setEmail("");
    } catch (e: any) {
      setSubMessage({ text: e.message || "Failed to subscribe.", isError: true });
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden font-sans text-neutral-100">
      
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

      <div className="z-10 text-center mb-10 w-full max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
          CEAC Visa Tracker
        </h1>
        <p className="text-neutral-400 text-lg max-w-lg mx-auto leading-relaxed">
          Instantly check your US visa status through an automated headless browser bypassing the CAPTCHA maze.
        </p>
      </div>

      <div className="z-10 w-full max-w-xl bg-neutral-900/40 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 shadow-2xl transition-all duration-500 hover:border-neutral-700/60 hover:shadow-purple-500/10 hover:shadow-2xl flex flex-col items-center">
        
        {!result && (
          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              <div className="space-y-2 col-span-1 sm:col-span-2">
                <label className="text-sm font-semibold text-neutral-300 ml-1">Case Number</label>
                <input
                  type="text"
                  required
                  placeholder="AA00000000"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  className="w-full bg-neutral-950/50 border border-neutral-800 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-neutral-200 placeholder:text-neutral-600 font-mono shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-300 ml-1">Passport</label>
                <input
                  type="text"
                  required
                  placeholder="E00000000"
                  value={passport}
                  onChange={(e) => setPassport(e.target.value)}
                  className="w-full bg-neutral-950/50 border border-neutral-800 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-neutral-200 placeholder:text-neutral-600 font-mono shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-300 ml-1">Surname (5 letters)</label>
                <input
                  type="text"
                  required
                  placeholder="SMITH"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="w-full bg-neutral-950/50 border border-neutral-800 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-neutral-200 placeholder:text-neutral-600 font-mono uppercase shadow-inner"
                />
              </div>

              <div className="space-y-2 col-span-1 sm:col-span-2">
                <label className="text-sm font-semibold text-neutral-300 ml-1">Location Code</label>
                <select
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-neutral-950/50 border border-neutral-800 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-neutral-200 appearance-none shadow-inner"
                >
                  <option value="BEJ">Beijing (BEJ)</option>
                  <option value="GUZ">Guangzhou (GUZ)</option>
                  <option value="SHG">Shanghai (SHG)</option>
                  <option value="SHY">Shenyang (SHY)</option>
                  <option value="CDT">Chengdu (CDT)</option>
                  <option value="HNK">Hong Kong (HNK)</option>
                  <option value="TPI">Taipei (TPI)</option>
                </select>
              </div>

              <div className="space-y-2 col-span-1 sm:col-span-2">
                <label className="text-sm font-semibold text-neutral-300 ml-1">CAPTCHA AI Solver</label>
                <select
                  required
                  value={solver}
                  onChange={(e) => setSolver(e.target.value)}
                  className="w-full bg-neutral-950/50 border border-neutral-800 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all text-neutral-200 appearance-none shadow-inner"
                >
                  <option value="onnx">Local ONNX Model (Fast & Free)</option>
                  <option value="gemini">Google Gemini 2.5 Pro (Slower & High Quality)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-2xl bg-white p-4 font-bold text-neutral-950 transition-all hover:bg-neutral-200 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] mt-8 flex flex-col items-center justify-center gap-1"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-shine" />
              <span className="relative flex items-center justify-center gap-3">
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-neutral-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {attemptCount > 0 ? `Checking... (Try ${attemptCount}/3)` : "Initializing..."}
                  </>
                ) : (
                  "Check Visa Status"
                )}
              </span>
            </button>
            
            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2">
                {error}
              </div>
            )}
            
            {/* Live streaming logs block */}
            {logs.length > 0 && !result && (
               <div className="mt-6 w-full rounded-xl bg-neutral-950/80 border border-neutral-800 p-4 font-mono text-xs text-green-400 shadow-inner max-h-48 overflow-y-auto">
                 {logs.map((log, idx) => (
                   <div key={idx} className="mb-1 leading-relaxed opacity-90">{log}</div>
                 ))}
                 <div ref={logsEndRef} />
               </div>
            )}
          </form>
        )}

        {result && (
          <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-300 mb-8">
              {result.status || "Status Received"}
            </h2>

            <div className="w-full space-y-4 mb-8">
               <div className="flex justify-between items-center bg-neutral-950/40 p-5 rounded-2xl border border-neutral-800 shadow-inner">
                  <span className="text-neutral-500 font-medium">Case Created</span>
                  <span className="font-semibold text-neutral-200">{result.caseCreated || "N/A"}</span>
               </div>
               <div className="flex justify-between items-center bg-neutral-950/40 p-5 rounded-2xl border border-neutral-800 shadow-inner">
                  <span className="text-neutral-500 font-medium">Last Updated</span>
                  <span className="font-semibold text-neutral-200">{result.caseUpdated || "N/A"}</span>
               </div>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-3xl w-full text-center mb-8">
                <p className="text-blue-200/80 text-sm leading-relaxed whitespace-pre-wrap">
                  {result.description || result.rawOutput}
                </p>
            </div>

            <div className="w-full bg-neutral-950/60 border border-neutral-800 p-6 rounded-3xl mb-8 flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="email"
                  placeholder="Enter email for daily updates"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-neutral-200 placeholder:text-neutral-500 shadow-inner"
                />
                <button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 sm:w-auto w-full"
                >
                  {subscribing ? "Subscribing..." : "Subscribe"}
                </button>
              </div>
              {subMessage && (
                <div className={`text-sm font-medium px-2 ${subMessage.isError ? "text-red-400" : "text-green-400"}`}>
                  {subMessage.text}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                 setResult(null);
                 setSubMessage(null);
              }}
              className="mt-8 text-neutral-400 hover:text-white transition-colors underline underline-offset-4 decoration-neutral-700 hover:decoration-white"
            >
              Check another case
            </button>
          </div>
        )}

      </div>
      
      <div className="absolute bottom-6 text-neutral-600 text-xs font-medium tracking-wide">
         Powered by Gemini 2.5 & Google DeepMind
      </div>
    </main>
  );
}
