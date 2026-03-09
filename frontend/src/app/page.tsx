"use client";

import { useState } from "react";

export default function Home() {
  const [caseNumber, setCaseNumber] = useState("");
  const [passport, setPassport] = useState("");
  const [surname, setSurname] = useState("");
  const [location, setLocation] = useState("BEJ");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_number: caseNumber,
          passport,
          surname,
          location,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check visa status");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-2xl bg-white p-4 font-bold text-neutral-950 transition-all hover:bg-neutral-200 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] mt-8"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-shine" />
              <span className="relative flex items-center justify-center gap-3">
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-neutral-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Solving Captchas & Checking...
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

            <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-3xl w-full text-center">
                <p className="text-blue-200/80 text-sm leading-relaxed">
                  {result.description || result.rawOutput.substring(0, 300) + "..."}
                </p>
            </div>

            <button
              onClick={() => setResult(null)}
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
