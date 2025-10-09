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
    // Lista piani ordinata per data creazione desc
    const lista = await db
      .select()
      .from(pianiAlimentari)
      .orderBy(desc(pianiAlimentari.dataCreazione))
      .limit(50);

    // Prendi l'ultimo piano (il più recente)
    const ultimo = lista[0];

    let dettagli: DettagliResponseType = null;

    if (ultimo) {
      // Prendi dettagli nutrizionali giornalieri per il piano
      const giornali: DettaglioNutrizionale[] = await db
        .select()
        .from(dettagliNutrizionaliGiornalieri)
        .where(eq(dettagliNutrizionaliGiornalieri.pianoId, ultimo.id));

      // Prendi i pasti collegati per costruire una vista semplice
      const relazioni: PianoPasto[] = await db
        .select()
        .from(pianiPasti)
        .where(eq(pianiPasti.pianoId, ultimo.id));

      // Mappa pastoId -> pasto
      const pastoIds = relazioni.map((r) => r.pastoId);
      const pastiRows: Pasto[] =
        pastoIds.length > 0
          ? await db.select().from(pasti).where(inArray(pasti.id, pastoIds))
          : [];

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

    return NextResponse.json({ success: true, lista, ultimo: dettagli });
  } catch (error) {
    console.error("Errore GET /api/piani", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
