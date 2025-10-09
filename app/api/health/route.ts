import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Test di connessione base
    const result = await db.execute(sql`SELECT 1 as test`);

    // Test variabili d'ambiente
    const envCheck = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      AWS_REGION: !!process.env.AWS_REGION,
      AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
      DATABASE_URL_PREVIEW: process.env.DATABASE_URL?.substring(0, 50) + "...",
    };

    return NextResponse.json({
      success: true,
      message: "Database connection successful",
      dbTest: result,
      environment: envCheck,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
        environment: {
          DATABASE_URL: !!process.env.DATABASE_URL,
          NODE_ENV: process.env.NODE_ENV,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
