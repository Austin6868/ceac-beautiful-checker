import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { case_number, passport, surname, location, solver } = body;

    // Validate inputs
    if (!case_number || !passport || !surname || !location) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const backendDir = path.resolve(process.cwd(), "../backend");
    const scriptPath = path.join(backendDir, "ceac_checker.py");
    
    const stream = new ReadableStream({
      start(controller) {
        const pyProcess = spawn("python3", [
          scriptPath,
          "--case", case_number,
          "--passport", passport,
          "--surname", surname,
          "--location", location,
          "--solver", solver || "onnx"
        ], {
          cwd: backendDir,
          env: { ...process.env, PYTHONUNBUFFERED: "1" }
        });

        let fullStdout = "";

        const sendEvent = (type: string, payload: any) => {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type, payload })}\n\n`));
        };

        pyProcess.stdout.on("data", (data) => {
          const text = data.toString();
          fullStdout += text;
          // Send pure logs to frontend
          const lines = text.split("\n").filter((l: string) => l.trim().length > 0);
          for (const line of lines) {
             sendEvent("log", line);
          }
        });

        pyProcess.stderr.on("data", (data) => {
          console.error(`Python stderr: ${data}`);
        });

        pyProcess.on("close", (code) => {
          // Process finished, parse the fullStdout for the final result
          if (fullStdout.includes("--- ERROR ---")) {
             const errorMatch = fullStdout.match(/--- ERROR ---\n(.*?)\n-------------/s);
             if (errorMatch) {
               sendEvent("error", { error: errorMatch[1].trim() });
             } else {
               sendEvent("error", { error: "Unknown CEAC Form Error" });
             }
             controller.close();
             return;
          }

          const result = {
            rawOutput: fullStdout,
            status: "Unknown",
            caseCreated: "",
            caseUpdated: "",
            description: ""
          };

          const statusMatch = fullStdout.match(/Status:\s*(.+)/);
          if (statusMatch) result.status = statusMatch[1].trim();

          const createdMatch = fullStdout.match(/Case Created:\s*(.+)/);
          if (createdMatch) result.caseCreated = createdMatch[1].trim();

          const updatedMatch = fullStdout.match(/Case Last Updated:\s*(.+)/);
          if (updatedMatch) result.caseUpdated = updatedMatch[1].trim();

          const descMatch = fullStdout.match(/Description:\s*(.+)\n---/s) || fullStdout.match(/Description:\s*(.+)/);
          if (descMatch) result.description = descMatch[1].trim();

          // if we missing status, it might be an unhandled error
          if (result.status === "Unknown" && !fullStdout.includes("--- STATUS RESULT ---")) {
              sendEvent("error", { error: "Failed to parse CEAC status from page." });
          } else {
              sendEvent("result", result);
          }
          
          controller.close();
        });

        // Kill process if client disconnects
        req.signal.addEventListener("abort", () => {
           pyProcess.kill();
        });
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (error: any) {
    console.error("Error setting up python script:", error);
    return NextResponse.json(
      { error: "Failed to initialize visa check." },
      { status: 500 }
    );
  }
}
