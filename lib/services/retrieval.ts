import { db } from "@/db";
import { pianiAlimentari, pasti, pianiPasti } from "@/db/schema";
import { desc, count, eq, inArray, sql, gte } from "drizzle-orm";
import { generateEmbedding } from "./bedrock";

const CONFIG = {
  PESO_FREQUENZA_RETRIEVAL: 0.7,
  PESO_SIMILARITA_RETRIEVAL: 0.3,
} as const;

// Helper duplicato per evitare dipendenze circolari o modifiche a file esistenti
async function getPianiRecentiIds(
  periodoIntervallo: number
): Promise<number[]> {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - periodoIntervallo);

  const result = await db
    .select({ id: pianiAlimentari.id })
    .from(pianiAlimentari)
    .where(
      gte(pianiAlimentari.dataCreazione, dataLimite.toISOString().split("T")[0])
    )
    .orderBy(desc(pianiAlimentari.id));

  return result.map((row) => row.id);
}

export async function getTopPastiFrequenza(periodoIntervallo: number): Promise<
  Array<{
    id: number;
    descrizione: string;
    tipo_pasto: string;
    frequenza: number;
    score_frequenza: number;
  }>
> {
  const pianiRecentiIds = await getPianiRecentiIds(periodoIntervallo);

  if (pianiRecentiIds.length === 0) {
    return [];
  }

  const result = await db
    .select({
      id: pasti.id,
      descrizione: pasti.descrizioneDettagliata,
      tipo_pasto: pasti.tipoPasto,
      frequenza: count(),
    })
    .from(pianiPasti)
    .innerJoin(pasti, eq(pianiPasti.pastoId, pasti.id))
    .where(inArray(pianiPasti.pianoId, pianiRecentiIds))
    .groupBy(pasti.id, pasti.descrizioneDettagliata, pasti.tipoPasto)
    .orderBy(desc(count()))
    .limit(8);

  const maxFreq = Math.max(...result.map((r) => Number(r.frequenza)));

  return result.map((row) => ({
    id: row.id,
    descrizione: row.descrizione,
    tipo_pasto: row.tipo_pasto,
    frequenza: Number(row.frequenza),
    score_frequenza: maxFreq > 0 ? Number(row.frequenza) / maxFreq : 0,
  }));
}

export async function getTopPastiSimilarita(embedding: number[]): Promise<
  Array<{
    id: number;
    descrizione: string;
    tipo_pasto: string;
    similarita: number;
    score_similarita: number;
  }>
> {
  try {
    const result = await db
      .select({
        id: pasti.id,
        descrizione: pasti.descrizioneDettagliata,
        tipo_pasto: pasti.tipoPasto,
        similarita: sql<number>`1 - (${pasti.embedding} <=> ${JSON.stringify(
          embedding
        )}::vector)`,
      })
      .from(pasti)
      .where(sql`${pasti.embedding} IS NOT NULL`)
      .orderBy(sql`${pasti.embedding} <=> ${JSON.stringify(embedding)}::vector`)
      .limit(8);

    const maxSim = Math.max(...result.map((r) => Number(r.similarita)));

    return result.map((row) => ({
      id: row.id,
      descrizione: row.descrizione,
      tipo_pasto: row.tipo_pasto,
      similarita: Number(row.similarita),
      score_similarita: maxSim > 0 ? Number(row.similarita) / maxSim : 0,
    }));
  } catch (error) {
    console.error("Errore nella ricerca vettoriale:", error);
    return [];
  }
}

export async function getRetrievalIbrido(
  preferenze: string[],
  esclusioni: string[],
  periodoIntervallo: number
): Promise<
  Array<{
    id: number;
    descrizione: string;
    tipo_pasto: string;
    score_finale: number;
    dettagli: {
      frequenza?: number;
      score_frequenza: number;
      similarita?: number;
      score_similarita: number;
      fonte: "frequenza" | "similarita" | "entrambi";
    };
  }>
> {
  console.log("Inizio retrieval ibrido...");

  const embedding = await generateEmbedding(preferenze, esclusioni);
  const pastiFrequenza = await getTopPastiFrequenza(periodoIntervallo);
  const pastiSimilarita = await getTopPastiSimilarita(embedding);

  const PESO_FREQUENZA = CONFIG.PESO_FREQUENZA_RETRIEVAL;
  const PESO_SIMILARITA = CONFIG.PESO_SIMILARITA_RETRIEVAL;

  const pastiCombinati = new Map<
    number,
    {
      id: number;
      descrizione: string;
      tipo_pasto: string;
      score_frequenza: number;
      score_similarita: number;
      frequenza?: number;
      similarita?: number;
      fonte: "frequenza" | "similarita" | "entrambi";
    }
  >();

  pastiFrequenza.forEach((pasto) => {
    pastiCombinati.set(pasto.id, {
      id: pasto.id,
      descrizione: pasto.descrizione,
      tipo_pasto: pasto.tipo_pasto,
      score_frequenza: pasto.score_frequenza,
      score_similarita: 0,
      frequenza: pasto.frequenza,
      fonte: "frequenza",
    });
  });

  pastiSimilarita.forEach((pasto) => {
    if (pastiCombinati.has(pasto.id)) {
      const esistente = pastiCombinati.get(pasto.id);
      if (esistente) {
        esistente.score_similarita = pasto.score_similarita;
        esistente.similarita = pasto.similarita;
        esistente.fonte = "entrambi";
      }
    } else {
      pastiCombinati.set(pasto.id, {
        id: pasto.id,
        descrizione: pasto.descrizione,
        tipo_pasto: pasto.tipo_pasto,
        score_frequenza: 0,
        score_similarita: pasto.score_similarita,
        similarita: pasto.similarita,
        fonte: "similarita",
      });
    }
  });

  const risultatiFinali = Array.from(pastiCombinati.values()).map((pasto) => ({
    id: pasto.id,
    descrizione: pasto.descrizione,
    tipo_pasto: pasto.tipo_pasto,
    score_finale:
      pasto.score_frequenza * PESO_FREQUENZA +
      pasto.score_similarita * PESO_SIMILARITA,
    dettagli: {
      frequenza: pasto.frequenza,
      score_frequenza: pasto.score_frequenza,
      similarita: pasto.similarita,
      score_similarita: pasto.score_similarita,
      fonte: pasto.fonte,
    },
  }));

  risultatiFinali.sort((a, b) => b.score_finale - a.score_finale);

  console.log(
    `Retrieval ibrido completato: ${risultatiFinali.length} pasti trovati`
  );

  return risultatiFinali;
}
