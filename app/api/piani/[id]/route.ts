import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import {
  pianiAlimentari,
  dettagliNutrizionaliGiornalieri,
  pianiPasti,
  pasti,
  PianoPasto,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { PastoSanitized } from "@/types/piani";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // context.params can be a Promise or a direct object depending on Next version
    const resolvedParams = await (context.params as
      | Promise<{ id: string }>
      | { id: string });
    const id = Number(resolvedParams.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid id" },
        { status: 400 }
      );
    }

    const piano = await db
      .select()
      .from(pianiAlimentari)
      .where(eq(pianiAlimentari.id, id));
    if (!piano || piano.length === 0) {
      return NextResponse.json(
        { success: false, error: "Piano non trovato" },
        { status: 404 }
      );
    }

    const giornali = await db
      .select()
      .from(dettagliNutrizionaliGiornalieri)
      .where(eq(dettagliNutrizionaliGiornalieri.pianoId, id));
    const relazioni: PianoPasto[] = await db
      .select()
      .from(pianiPasti)
      .where(eq(pianiPasti.pianoId, id));
    const pastoIds = relazioni.map((r) => r.pastoId);
    const pastiRows =
      pastoIds.length > 0
        ? await db.select().from(pasti).where(inArray(pasti.id, pastoIds))
        : [];

    // Remove embedding vectors before returning over HTTP
    const sanitizedPasti: PastoSanitized[] = pastiRows.map(
      ({ embedding: _embedding, ...rest }) => rest as unknown as PastoSanitized
    );

    // Funzione helper per normalizzare i nomi dei giorni
    const normalizeDay = (day: string): string => {
      return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
    };

    // Trasforma i dati giornalieri per la UI
    const giorni = giornali.map((g) => ({
      giorno: normalizeDay(g.giornoSettimana || ""), // Normalizza il formato
      data: undefined, // Non abbiamo la data specifica nei dettagli
      calorie: g.calorieTotaliKcal,
      proteine: g.proteineTotaliG,
      carboidrati: g.carboidratiTotaliG,
      grassi: g.grassiTotaliG,
    }));

    // Normalizza anche le relazioni per matching coerente
    const relazioniNormalized = relazioni.map((r) => ({
      ...r,
      giornoSettimana: normalizeDay(r.giornoSettimana),
    }));

    // 🔍 DEBUG COMPLETO per capire il problema
    console.log("🔍 Debug completo matching:");
    console.log("Piano ID:", id);
    console.log("Giorni trovati:", giorni.length);
    console.log("Relazioni trovate:", relazioniNormalized.length);
    console.log("Pasti trovati:", sanitizedPasti.length);

    // 🎯 SIMULA IL COMPORTAMENTO DELL'UI
    console.log("\n🎯 Simulazione filtering UI:");
    giorni.forEach((g, _idx) => {
      console.log(`\n--- Giorno: ${g.giorno} ---`);

      const relsForDay = relazioniNormalized
        .filter((r) => String(r.giornoSettimana) === String(g.giorno))
        .sort(
          (a, b) =>
            (Number(a.ordineNelGiorno) || 0) - (Number(b.ordineNelGiorno) || 0)
        );

      console.log(`Relazioni filtrate per ${g.giorno}:`, relsForDay.length);
      relsForDay.forEach((r) =>
        console.log(`  - pastoId: ${r.pastoId}, ordine: ${r.ordineNelGiorno}`)
      );

      const meals = relsForDay
        .map((r) =>
          sanitizedPasti.find((p) => Number(p.id) === Number(r.pastoId))
        )
        .filter(Boolean);

      console.log(`Pasti trovati per ${g.giorno}:`, meals.length);
      meals.forEach((m) =>
        console.log(
          `  - ${m?.tipoPasto}: ${m?.descrizioneDettagliata?.substring(
            0,
            50
          )}...`
        )
      );
    });

    return NextResponse.json({
      success: true,
      piano: piano[0],
      giornali,
      relazioni: relazioniNormalized, // Usa le relazioni normalizzate
      pasti: sanitizedPasti,
      giorni, // Aggiungi il campo giorni trasformato
    });
  } catch (error) {
    console.error("Errore GET /api/piani/[id]", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
