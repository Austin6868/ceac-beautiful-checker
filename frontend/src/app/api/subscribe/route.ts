import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, case_number, passport, surname, location } = body;

    if (!email || !case_number || !passport || !surname || !location) {
      return NextResponse.json(
        { error: "Missing required fields for subscription." },
        { status: 400 }
      );
    }

    // Resolve SQLite database path in the backend folder
    const dbPath = path.resolve(process.cwd(), "../backend/subscriptions.db");
    const db = new Database(dbPath);

    // Create table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        case_number TEXT NOT NULL,
        passport TEXT NOT NULL,
        surname TEXT NOT NULL,
        location TEXT NOT NULL,
        last_status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(email, case_number)
      )
    `);

    // Insert or silently ignore if email+case combo already exists 
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO subscribers (email, case_number, passport, surname, location)
      VALUES (?, ?, ?, ?, ?)
    `);

    const info = stmt.run(email, case_number, passport, surname, location);
    db.close();

    if (info.changes > 0) {
      return NextResponse.json({ success: true, message: "Subscribed successfully!" });
    } else {
      return NextResponse.json({ success: true, message: "Already subscribed to this case." });
    }

  } catch (error: any) {
    console.error("Subscription Error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe down to database level." },
      { status: 500 }
    );
  }
}
