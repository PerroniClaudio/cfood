import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  pianiAlimentari,
  dettagliNutrizionaliGiornalieri,
  pianiPasti,
  pasti,
  DettaglioNutrizionale,
  PianoPasto,
  Pasto,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import type {
  GiornoView,
  PastoSanitized,
  DettagliResponse as DettagliResponseType,
} from "@/types/piani";

// GET /api/piani - ritorna lista di piani e dettagli dell'ultimo piano
export async function GET() {
  try {
    console.log("🔍 Starting GET /api/piani");
    console.log("📊 Database connection status: OK");

    // Lista piani ordinata per data creazione desc
    const lista = await db
      .select()
      .from(pianiAlimentari)
      .orderBy(desc(pianiAlimentari.id))
      .limit(50);

    console.log(`📋 Found ${lista.length} plans`);

    // Prendi l'ultimo piano (il più recente)
    const ultimo = lista[0];

    let dettagli: DettagliResponseType = null;

    if (ultimo) {
      console.log(`🔍 Loading details for plan ${ultimo.id}`);

      // Prendi dettagli nutrizionali giornalieri per il piano
      const giornali: DettaglioNutrizionale[] = await db
        .select()
        .from(dettagliNutrizionaliGiornalieri)
        .where(eq(dettagliNutrizionaliGiornalieri.pianoId, ultimo.id));

      console.log(`📅 Found ${giornali.length} daily details`);

      // Prendi i pasti collegati per costruire una vista semplice
      const relazioni: PianoPasto[] = await db
        .select()
        .from(pianiPasti)
        .where(eq(pianiPasti.pianoId, ultimo.id));

      console.log(`🔗 Found ${relazioni.length} meal relations`);

      // Mappa pastoId -> pasto
      const pastoIds = relazioni.map((r) => r.pastoId);
      const pastiRows: Pasto[] =
        pastoIds.length > 0
          ? await db.select().from(pasti).where(inArray(pasti.id, pastoIds))
          : [];

      console.log(`🍽️ Found ${pastiRows.length} meals`);

      // Remove embedding vectors before returning over HTTP
      const sanitizedPasti: PastoSanitized[] = pastiRows.map(
        ({ embedding: _embedding, ...rest }) =>
          rest as unknown as PastoSanitized
      );

      // Organizza per giorno
      const giorni: GiornoView[] = giornali.map((g) => ({
        giorno: g.giornoSettimana,
        calorie: g.calorieTotaliKcal ?? undefined,
        proteine: g.proteineTotaliG ?? undefined,
        carboidrati: g.carboidratiTotaliG ?? undefined,
        grassi: g.grassiTotaliG ?? undefined,
      }));

      dettagli = {
        piano: ultimo,
        giornali,
        relazioni,
        pasti: sanitizedPasti,
        giorni,
      };
    }

    console.log("✅ GET /api/piani completed successfully");
    return NextResponse.json({ success: true, lista, ultimo: dettagli });
  } catch (error) {
    console.error("❌ Errore GET /api/piani", error);
    console.error("🔍 Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: String(error),
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
