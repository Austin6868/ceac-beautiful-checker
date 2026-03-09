import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import util from "util";

const execAsync = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { case_number, passport, surname, location } = body;

    // Validate inputs
    if (!case_number || !passport || !surname || !location) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Resolve paths
    const backendDir = path.resolve(process.cwd(), "../backend");
    const scriptPath = path.join(backendDir, "ceac_checker.py");
    
    // Command
    const command = `python3 ${scriptPath} --case "${case_number}" --passport "${passport}" --surname "${surname}" --location "${location}"`;

    const { stdout, stderr } = await execAsync(command, {
      cwd: backendDir,
      timeout: 60000 // 60 second timeout for the playwright check
    });

    if (stderr && stderr.toLowerCase().includes("error")) {
      console.error("stderr:", stderr);
    }

    // Attempt to parse the stdout using simple regex/string matching
    // since the Python script prints formatted strings.
    const result = {
      rawOutput: stdout,
      status: "Unknown",
      caseCreated: "",
      caseUpdated: "",
      description: ""
    };

    const statusMatch = stdout.match(/Status:\s*(.+)/);
    if (statusMatch) result.status = statusMatch[1].trim();

    const createdMatch = stdout.match(/Case Created:\s*(.+)/);
    if (createdMatch) result.caseCreated = createdMatch[1].trim();

    const updatedMatch = stdout.match(/Case Last Updated:\s*(.+)/);
    if (updatedMatch) result.caseUpdated = updatedMatch[1].trim();

    const descMatch = stdout.match(/Description:\s*(.+)\n---/s) || stdout.match(/Description:\s*(.+)/);
    if (descMatch) result.description = descMatch[1].trim();
    
    // Parse any functional errors from CEAC output (e.g. timeout or bad captcha)
    if (stdout.includes("--- ERROR ---")) {
       const errorMatch = stdout.match(/--- ERROR ---\n(.*?)\n-------------/s);
       if (errorMatch) {
         return NextResponse.json(
           { error: errorMatch[1].trim(), rawOutput: stdout },
           { status: 422 }
         );
       }
       return NextResponse.json(
           { error: "Unknown CEAC Form Error", rawOutput: stdout },
           { status: 422 }
       );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error executing Python script:", error);
    return NextResponse.json(
      { error: "Failed to fetch visa status. Background process error." },
      { status: 500 }
    );
  }
}
