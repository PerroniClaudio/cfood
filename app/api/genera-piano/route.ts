import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  pianiAlimentari,
  pasti,
  pianiPasti,
  dettagliNutrizionaliGiornalieri,
} from "@/db/schema";
import { sql, gte, desc, count, avg, eq, inArray } from "drizzle-orm";
import {
  GeneraPianoRequest,
  AnalisiStorica,
  PianoAlimentare,
  StatisticheGenerali,
  TopPasto,
  PatternTemporale,
  PreferenzaRilevata,
  ValoriNutrizionaliPasto,
  ValoriNutrizionaliGiorno,
  RisultatoCalcoloNutrizionale,
  RiepilogoNutrizionaleSettimanale,
} from "@/types/genera-piano";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  buildPromptPianoAlimentare,
  buildPromptAnalisiNutrizionale,
  buildPromptAnalisiNutrizionaleBatch,
} from "@/prompts";
import fs from "fs";
import path from "path";

// ================================
// CONFIGURAZIONE E COSTANTI
// ================================

// Directory per i log di Bedrock
const LOGS_DIR = path.join(process.cwd(), "logs");

// Funzioni di utilità per logging Bedrock responses
function ensureLogsDirectory() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function saveBedrockResponse(
  type: "piano" | "nutrizionale_batch" | "nutrizionale_single" | "embedding",
  sessionId: string,
  prompt: string,
  response: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    ensureLogsDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${timestamp}_${type}_${sessionId.substring(0, 8)}.json`;
    const logPath = path.join(LOGS_DIR, filename);

    const logData = {
      timestamp: new Date().toISOString(),
      type,
      sessionId,
      metadata,
      prompt: prompt.substring(0, 1000) + (prompt.length > 1000 ? "..." : ""), // Truncate for space
      response,
    };

    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
    console.log(`💾 Bedrock response saved: ${filename}`);
  } catch (error) {
    console.warn(`⚠️ Failed to save Bedrock response:`, error);
  }
}

function loadBedrockResponse(
  type: "piano" | "nutrizionale_batch" | "nutrizionale_single" | "embedding",
  sessionId: string
): string | null {
  try {
    ensureLogsDirectory();

    const files = fs.readdirSync(LOGS_DIR);
    const logFile = files
      .filter((f) => f.includes(`_${type}_${sessionId.substring(0, 8)}`))
      .sort()
      .pop(); // Get most recent

    if (logFile) {
      const logPath = path.join(LOGS_DIR, logFile);
      const logData = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      console.log(`📁 Loaded cached Bedrock response: ${logFile}`);
      return logData.response;
    }

    return null;
  } catch (error) {
    console.warn(`⚠️ Failed to load cached Bedrock response:`, error);
    return null;
  }
}

function generateSessionId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2);
}

// Configurazione pipeline
const CONFIG = {
  // Limiti e pesi del sistema
  MAX_TOKEN_CONTESTO_RAG: 4000,
  PESO_FREQUENZA_RETRIEVAL: 0.7,
  PESO_SIMILARITA_RETRIEVAL: 0.3,

  // Limiti query database
  LIMITE_TOP_PASTI: 10,
  LIMITE_TOP_PASTI_RETRIEVAL: 8,

  // Parametri LLM
  MAX_TOKENS_OUTPUT: 80000,
  TEMPERATURE_LLM: 0.7,
  TOP_P_LLM: 0.9,

  // Parametri validazione
  GIORNI_PIANO_RICHIESTI: 7,
  PASTI_PER_GIORNO: 3,

  // Stima token (approssimativa: 1 token ≈ 4 caratteri)
  CARATTERI_PER_TOKEN: 4,
} as const;

// Configurazione client AWS Bedrock
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// FASE 2: Funzioni di Analisi Storica con Drizzle

// Funzione helper per ottenere gli ID dei piani più recenti
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
    .orderBy(desc(pianiAlimentari.dataCreazione));

  return result.map((row) => row.id);
}

// 1. Query piani recenti
async function getPianiRecenti(
  periodoIntervallo: number
): Promise<PianoAlimentare[]> {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - periodoIntervallo);

  const result = await db
    .select()
    .from(pianiAlimentari)
    .where(
      gte(pianiAlimentari.dataCreazione, dataLimite.toISOString().split("T")[0])
    )
    .orderBy(desc(pianiAlimentari.dataCreazione));

  return result.map((row) => ({
    id: row.id.toString(),
    data_creazione: row.dataCreazione || new Date().toISOString().split("T")[0],
    periodo_giorni: 7, // Valore di default
    utente_id: row.autore,
  }));
}

// 2. Calcola statistiche generali
async function getStatisticheGenerali(
  periodoIntervallo: number
): Promise<StatisticheGenerali> {
  // Prima ottieni gli ID dei piani più recenti
  const pianiRecentiIds = await getPianiRecentiIds(periodoIntervallo);

  if (pianiRecentiIds.length === 0) {
    return {
      totale_piani: 0,
      media_calorie_giornaliere: 0,
      distribuzione_macro: {
        proteine_avg: 0,
        carboidrati_avg: 0,
        grassi_avg: 0,
      },
      conteggio_pasti: {
        colazione: 0,
        pranzo: 0,
        cena: 0,
      },
    };
  }

  // Query media calorie e macro SOLO dai piani più recenti
  const nutrizionali = await db
    .select({
      mediaCalorie: avg(dettagliNutrizionaliGiornalieri.calorieTotaliKcal),
      mediaProteine: avg(dettagliNutrizionaliGiornalieri.proteineTotaliG),
      mediaCarboidrati: avg(dettagliNutrizionaliGiornalieri.carboidratiTotaliG),
      mediaGrassi: avg(dettagliNutrizionaliGiornalieri.grassiTotaliG),
    })
    .from(dettagliNutrizionaliGiornalieri)
    .where(inArray(dettagliNutrizionaliGiornalieri.pianoId, pianiRecentiIds));

  // Query conteggio pasti per tipo SOLO dai piani più recenti
  const conteggioResult = await db
    .select({
      tipoPasto: pasti.tipoPasto,
      conteggio: count(),
    })
    .from(pianiPasti)
    .innerJoin(pasti, eq(pianiPasti.pastoId, pasti.id))
    .where(inArray(pianiPasti.pianoId, pianiRecentiIds))
    .groupBy(pasti.tipoPasto);

  const conteggioPasti = {
    colazione: 0,
    pranzo: 0,
    cena: 0,
  };

  // Mappatura corretta basata sui valori reali del campo tipo_pasto
  conteggioResult.forEach((row) => {
    const tipo = row.tipoPasto.toLowerCase();
    if (tipo.includes("colazione") || tipo === "breakfast") {
      conteggioPasti.colazione += Number(row.conteggio);
    } else if (tipo.includes("pranzo") || tipo === "lunch") {
      conteggioPasti.pranzo += Number(row.conteggio);
    } else if (tipo.includes("cena") || tipo === "dinner") {
      conteggioPasti.cena += Number(row.conteggio);
    }
  });

  return {
    totale_piani: pianiRecentiIds.length,
    media_calorie_giornaliere: Math.round(
      Number(nutrizionali[0]?.mediaCalorie || 0)
    ),
    distribuzione_macro: {
      proteine_avg: Math.round(Number(nutrizionali[0]?.mediaProteine || 0)),
      carboidrati_avg: Math.round(
        Number(nutrizionali[0]?.mediaCarboidrati || 0)
      ),
      grassi_avg: Math.round(Number(nutrizionali[0]?.mediaGrassi || 0)),
    },
    conteggio_pasti: conteggioPasti,
  };
}

// 3. Query frequenza pasti (top 10)
async function getTopPasti(periodoIntervallo: number): Promise<TopPasto[]> {
  // Prima ottieni gli ID dei piani più recenti
  const pianiRecentiIds = await getPianiRecentiIds(periodoIntervallo);

  if (pianiRecentiIds.length === 0) {
    return [];
  }

  const result = await db
    .select({
      pastoId: pasti.id,
      nomePasto: pasti.descrizioneDettagliata,
      tipoPasto: pasti.tipoPasto,
      frequenza: count(),
    })
    .from(pianiPasti)
    .innerJoin(pasti, eq(pianiPasti.pastoId, pasti.id))
    .where(inArray(pianiPasti.pianoId, pianiRecentiIds))
    .groupBy(pasti.id, pasti.descrizioneDettagliata, pasti.tipoPasto)
    .orderBy(desc(count()))
    .limit(CONFIG.LIMITE_TOP_PASTI);

  return result.map((row) => ({
    pasto_id: row.pastoId.toString(),
    nome_pasto: row.nomePasto,
    frequenza: Number(row.frequenza),
    tipo_pasto: row.tipoPasto as "colazione" | "pranzo" | "cena",
  }));
}

// 4. Query pattern temporali per giorno settimana
async function getPatternTemporali(
  periodoIntervallo: number
): Promise<PatternTemporale[]> {
  // Prima ottieni gli ID dei piani più recenti
  const pianiRecentiIds = await getPianiRecentiIds(periodoIntervallo);

  if (pianiRecentiIds.length === 0) {
    return [];
  }

  const result = await db
    .select({
      giornoSettimana: dettagliNutrizionaliGiornalieri.giornoSettimana,
      mediaCalorie: avg(dettagliNutrizionaliGiornalieri.calorieTotaliKcal),
      mediaProteine: avg(dettagliNutrizionaliGiornalieri.proteineTotaliG),
    })
    .from(dettagliNutrizionaliGiornalieri)
    .where(inArray(dettagliNutrizionaliGiornalieri.pianoId, pianiRecentiIds))
    .groupBy(dettagliNutrizionaliGiornalieri.giornoSettimana)
    .orderBy(dettagliNutrizionaliGiornalieri.giornoSettimana);

  // Mappa dei giorni della settimana
  const mappaGiorni: { [key: string]: { numero: number; nome: string } } = {
    lunedì: { numero: 1, nome: "Lunedì" },
    martedì: { numero: 2, nome: "Martedì" },
    mercoledì: { numero: 3, nome: "Mercoledì" },
    giovedì: { numero: 4, nome: "Giovedì" },
    venerdì: { numero: 5, nome: "Venerdì" },
    sabato: { numero: 6, nome: "Sabato" },
    domenica: { numero: 0, nome: "Domenica" },
    // Compatibilità con versioni minuscole esistenti
    lunedi: { numero: 1, nome: "Lunedì" },
    martedi: { numero: 2, nome: "Martedì" },
    mercoledi: { numero: 3, nome: "Mercoledì" },
    giovedi: { numero: 4, nome: "Giovedì" },
    venerdi: { numero: 5, nome: "Venerdì" },
  };

  return result.map((row) => {
    const giornoKey = row.giornoSettimana.toLowerCase();
    const mappato = mappaGiorni[giornoKey] || {
      numero: 0,
      nome: row.giornoSettimana,
    };

    return {
      giorno_settimana: mappato.numero,
      nome_giorno: mappato.nome,
      media_calorie: Math.round(Number(row.mediaCalorie || 0)),
      media_proteine: Math.round(Number(row.mediaProteine || 0)),
    };
  });
}

// 5. Query preferenze rilevate da descrizioni
async function getPreferenzeRilevate(
  periodoIntervallo: number
): Promise<PreferenzaRilevata[]> {
  // Prima ottieni gli ID dei piani più recenti
  const pianiRecentiIds = await getPianiRecentiIds(periodoIntervallo);

  if (pianiRecentiIds.length === 0) {
    return [];
  }

  // Query più semplice per analizzare le descrizioni dei pasti SOLO dai piani più recenti
  const result = await db
    .select({
      descrizione: pasti.descrizioneDettagliata,
      frequenza: count(),
    })
    .from(pianiPasti)
    .innerJoin(pasti, eq(pianiPasti.pastoId, pasti.id))
    .where(inArray(pianiPasti.pianoId, pianiRecentiIds))
    .groupBy(pasti.descrizioneDettagliata)
    .orderBy(desc(count()))
    .limit(CONFIG.LIMITE_TOP_PASTI);

  // Categorizzazione semplificata client-side
  return result
    .map((row) => {
      let categoria = "altro";
      const desc = row.descrizione.toLowerCase();

      if (
        desc.includes("pesce") ||
        desc.includes("salmone") ||
        desc.includes("tonno")
      ) {
        categoria = "pesce";
      } else if (
        desc.includes("verdure") ||
        desc.includes("verdura") ||
        desc.includes("insalata")
      ) {
        categoria = "verdure";
      } else if (
        desc.includes("carne") ||
        desc.includes("pollo") ||
        desc.includes("manzo")
      ) {
        categoria = "carne";
      } else if (
        desc.includes("pasta") ||
        desc.includes("riso") ||
        desc.includes("cereali")
      ) {
        categoria = "carboidrati";
      } else if (
        desc.includes("formaggio") ||
        desc.includes("latte") ||
        desc.includes("yogurt")
      ) {
        categoria = "latticini";
      }

      return {
        categoria: "alimentare",
        ingrediente: categoria,
        frequenza: Number(row.frequenza),
        percentuale: 0, // Calcolato successivamente se necessario
      };
    })
    .filter((item) => item.ingrediente !== "altro");
}

// Funzione principale di analisi storica
async function eseguiAnalisiStorica(
  periodoIntervallo: number
): Promise<AnalisiStorica> {
  try {
    const [
      piani_recenti,
      statistiche_generali,
      top_pasti,
      pattern_temporali,
      preferenze_rilevate,
    ] = await Promise.all([
      getPianiRecenti(periodoIntervallo),
      getStatisticheGenerali(periodoIntervallo),
      getTopPasti(periodoIntervallo),
      getPatternTemporali(periodoIntervallo),
      getPreferenzeRilevate(periodoIntervallo),
    ]);

    return {
      piani_recenti,
      statistiche_generali,
      top_pasti,
      pattern_temporali,
      preferenze_rilevate,
    };
  } catch (error) {
    console.error("Errore nell'analisi storica:", error);
    throw error;
  }
}

// FASE 3: Retrieval Ibrido

// 1. Funzione per generare embedding della query
async function generaEmbeddingQuery(
  preferenze: string[],
  esclusioni: string[]
): Promise<number[]> {
  // Prompt base personalizzato
  let queryText = "Crea piano alimentare bilanciato basato sulle mie abitudini";

  if (preferenze.length > 0) {
    queryText += `. Preferenze: ${preferenze.join(", ")}`;
  }

  if (esclusioni.length > 0) {
    queryText += `. Escludere: ${esclusioni.join(", ")}`;
  }

  try {
    const command = new InvokeModelCommand({
      modelId: "amazon.titan-embed-text-v2:0",
      body: JSON.stringify({
        inputText: queryText,
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return responseBody.embedding;
  } catch (error) {
    console.error("Errore nella generazione embedding:", error);
    // Fallback: restituisce un array vuoto o di default
    return new Array(1024).fill(0);
  }
}

// 2. Retrieval per frequenza (Top 8 pasti storici)
async function getTopPastiFrequenza(periodoIntervallo: number): Promise<
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

  // Calcola score di frequenza normalizzato (0-1)
  const maxFreq = Math.max(...result.map((r) => Number(r.frequenza)));

  return result.map((row) => ({
    id: row.id,
    descrizione: row.descrizione,
    tipo_pasto: row.tipo_pasto,
    frequenza: Number(row.frequenza),
    score_frequenza: maxFreq > 0 ? Number(row.frequenza) / maxFreq : 0,
  }));
}

// 3. Retrieval vettoriale (Top 8 pasti simili)
async function getTopPastiSimilarita(embedding: number[]): Promise<
  Array<{
    id: number;
    descrizione: string;
    tipo_pasto: string;
    similarita: number;
    score_similarita: number;
  }>
> {
  try {
    // Query con operatore pgvector <=> per cosine distance
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

    // Calcola score di similarità normalizzato (0-1)
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

// 4. Combinazione risultati con score ibrido
async function getRetrievalIbrido(
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

  // Step 1: Genera embedding della query
  const embedding = await generaEmbeddingQuery(preferenze, esclusioni);

  // Step 2: Retrieval per frequenza
  const pastiFrequenza = await getTopPastiFrequenza(periodoIntervallo);

  // Step 3: Retrieval vettoriale
  const pastiSimilarita = await getTopPastiSimilarita(embedding);

  // Step 4: Combinazione con pesi (70% frequenza + 30% similarità)
  const PESO_FREQUENZA = CONFIG.PESO_FREQUENZA_RETRIEVAL;
  const PESO_SIMILARITA = CONFIG.PESO_SIMILARITA_RETRIEVAL;

  // Mappa per combinare i risultati
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

  // Aggiungi pasti da frequenza
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

  // Aggiungi/combina pasti da similarità
  pastiSimilarita.forEach((pasto) => {
    if (pastiCombinati.has(pasto.id)) {
      // Pasto presente in entrambi - aggiorna
      const esistente = pastiCombinati.get(pasto.id);
      if (esistente) {
        esistente.score_similarita = pasto.score_similarita;
        esistente.similarita = pasto.similarita;
        esistente.fonte = "entrambi";
      }
    } else {
      // Nuovo pasto solo da similarità
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

  // Calcola score finale e ordina
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

  // Ordina per score finale decrescente
  risultatiFinali.sort((a, b) => b.score_finale - a.score_finale);

  console.log(
    `Retrieval ibrido completato: ${risultatiFinali.length} pasti trovati`
  );

  return risultatiFinali;
}

// FASE 4: Costruzione Contesto RAG

// 1. Formattazione statistiche storiche in testo leggibile
function formattaStatisticheStoriche(statistiche: StatisticheGenerali): string {
  const {
    totale_piani,
    media_calorie_giornaliere,
    distribuzione_macro,
    conteggio_pasti,
  } = statistiche;

  if (totale_piani === 0) {
    return "Nessun dato storico disponibile per il periodo analizzato.";
  }

  // Calcola totale pasti per percentuali
  const totalePasti =
    conteggio_pasti.colazione + conteggio_pasti.pranzo + conteggio_pasti.cena;

  // Calcola totale macronutrienti per percentuali
  const totaleMacro =
    distribuzione_macro.proteine_avg +
    distribuzione_macro.carboidrati_avg +
    distribuzione_macro.grassi_avg;

  let testo = `Analisi storica basata su ${totale_piani} piani alimentari:\n\n`;

  // Statistiche caloriche
  testo += `PROFILO NUTRIZIONALE:\n`;
  testo += `• Media calorica giornaliera: ${media_calorie_giornaliere} kcal\n`;

  // Distribuzione macronutrienti con percentuali
  if (totaleMacro > 0) {
    const percProteine = Math.round(
      (distribuzione_macro.proteine_avg / totaleMacro) * 100
    );
    const percCarboidrati = Math.round(
      (distribuzione_macro.carboidrati_avg / totaleMacro) * 100
    );
    const percGrassi = Math.round(
      (distribuzione_macro.grassi_avg / totaleMacro) * 100
    );

    testo += `• Proteine: ${distribuzione_macro.proteine_avg}g (${percProteine}%)\n`;
    testo += `• Carboidrati: ${distribuzione_macro.carboidrati_avg}g (${percCarboidrati}%)\n`;
    testo += `• Grassi: ${distribuzione_macro.grassi_avg}g (${percGrassi}%)\n\n`;
  }

  // Distribuzione pasti con frequenze e percentuali
  testo += `DISTRIBUZIONE PASTI:\n`;
  if (totalePasti > 0) {
    const percColazione = Math.round(
      (conteggio_pasti.colazione / totalePasti) * 100
    );
    const percPranzo = Math.round((conteggio_pasti.pranzo / totalePasti) * 100);
    const percCena = Math.round((conteggio_pasti.cena / totalePasti) * 100);

    testo += `• Colazioni: ${conteggio_pasti.colazione} pasti (${percColazione}%)\n`;
    testo += `• Pranzi: ${conteggio_pasti.pranzo} pasti (${percPranzo}%)\n`;
    testo += `• Cene: ${conteggio_pasti.cena} pasti (${percCena}%)\n`;
  } else {
    testo += `• Nessun dato sui pasti disponibile\n`;
  }

  return testo;
}

// 2. Formattazione pattern temporali in stringhe descrittive
function formattaPatternTemporali(pattern: PatternTemporale[]): string {
  if (pattern.length === 0) {
    return "Nessun pattern temporale identificato.";
  }

  // Calcola medie generali per confronti
  const mediaGeneraleCalorie =
    pattern.reduce((sum, p) => sum + p.media_calorie, 0) / pattern.length;
  const mediaGeneraleProteine =
    pattern.reduce((sum, p) => sum + p.media_proteine, 0) / pattern.length;

  let testo = `PATTERN SETTIMANALI:\n`;

  pattern.forEach((p) => {
    // Calcola variazioni percentuali rispetto alla media
    const variazCalorie =
      mediaGeneraleCalorie > 0
        ? Math.round(
            ((p.media_calorie - mediaGeneraleCalorie) / mediaGeneraleCalorie) *
              100
          )
        : 0;
    const variazProteine =
      mediaGeneraleProteine > 0
        ? Math.round(
            ((p.media_proteine - mediaGeneraleProteine) /
              mediaGeneraleProteine) *
              100
          )
        : 0;

    testo += `• ${p.nome_giorno}: `;

    // Descrizioni delle variazioni
    if (Math.abs(variazCalorie) >= 5) {
      testo += `${variazCalorie > 0 ? "+" : ""}${variazCalorie}% calorie (${
        p.media_calorie
      } kcal)`;
    } else {
      testo += `${p.media_calorie} kcal standard`;
    }

    if (Math.abs(variazProteine) >= 10) {
      testo += `, ${
        variazProteine > 0 ? "+" : ""
      }${variazProteine}% proteine (${p.media_proteine}g)`;
    } else {
      testo += `, ${p.media_proteine}g proteine`;
    }

    testo += `\n`;
  });

  return testo;
}

// 3. Formattazione preferenze alimentari rilevate
function formattaPreferenzeRilevate(preferenze: PreferenzaRilevata[]): string {
  if (preferenze.length === 0) {
    return "Nessuna preferenza alimentare specifica rilevata.";
  }

  // Calcola il totale per le percentuali
  const totaleFrequenze = preferenze.reduce((sum, p) => sum + p.frequenza, 0);

  let testo = `PREFERENZE ALIMENTARI RILEVATE:\n`;

  preferenze.forEach((p) => {
    const percentuale =
      totaleFrequenze > 0
        ? Math.round((p.frequenza / totaleFrequenze) * 100)
        : 0;

    // Capitalizza il nome dell'ingrediente
    const ingredienteFormatted =
      p.ingrediente.charAt(0).toUpperCase() + p.ingrediente.slice(1);

    testo += `• ${ingredienteFormatted}: ${p.frequenza} occorrenze (${percentuale}%)\n`;
  });

  return testo;
}

// 4. Seleziona e formatta top 5 pasti per frequenza
function formattaTopPastiFrequenza(pasti: TopPasto[]): string {
  if (pasti.length === 0) {
    return "Nessun pasto frequente identificato.";
  }

  const top5 = pasti.slice(0, 5);
  let testo = `TOP 5 PASTI PIÙ FREQUENTI:\n`;

  top5.forEach((pasto, index) => {
    const tipoFormatted =
      pasto.tipo_pasto.charAt(0).toUpperCase() + pasto.tipo_pasto.slice(1);
    testo += `${index + 1}. [${tipoFormatted}] ${pasto.nome_pasto} (${
      pasto.frequenza
    } volte)\n`;
  });

  return testo;
}

// 5. Seleziona e formatta top 5 pasti semanticamente rilevanti
function formattaTopPastiSimilarita(
  pasti: Array<{
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
): string {
  if (pasti.length === 0) {
    return "Nessun pasto semanticamente rilevante trovato.";
  }

  // Filtra solo quelli con componente di similarità e prendi top 5
  const pastiConSimilarita = pasti
    .filter((p) => p.dettagli.score_similarita > 0)
    .slice(0, 5);

  if (pastiConSimilarita.length === 0) {
    return "Nessun pasto con similarità semantica disponibile.";
  }

  let testo = `TOP 5 PASTI SEMANTICAMENTE RILEVANTI:\n`;

  pastiConSimilarita.forEach((pasto, index) => {
    const tipoFormatted =
      pasto.tipo_pasto.charAt(0).toUpperCase() + pasto.tipo_pasto.slice(1);
    const scorePercent = Math.round(pasto.dettagli.score_similarita * 100);
    const scoreFinalePercent = Math.round(pasto.score_finale * 100);

    testo += `${index + 1}. [${tipoFormatted}] ${pasto.descrizione}\n`;
    testo += `   Similarità: ${scorePercent}%, Score totale: ${scoreFinalePercent}%`;

    if (pasto.dettagli.frequenza) {
      testo += `, Freq: ${pasto.dettagli.frequenza}`;
    }

    testo += `\n`;
  });

  return testo;
}

// 6. Funzione principale per assemblare il contesto RAG completo
function assemblaContestoRAG(
  analisiStorica: AnalisiStorica,
  pastiRaccomandati: Array<{
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
): string {
  let contesto = "=== CONTESTO PER GENERAZIONE PIANO ALIMENTARE ===\n\n";

  // 1. Statistiche storiche
  contesto += formattaStatisticheStoriche(analisiStorica.statistiche_generali);
  contesto += "\n";

  // 2. Pattern temporali
  contesto += formattaPatternTemporali(analisiStorica.pattern_temporali);
  contesto += "\n";

  // 3. Preferenze rilevate
  contesto += formattaPreferenzeRilevate(analisiStorica.preferenze_rilevate);
  contesto += "\n";

  // 4. Top pasti frequenti
  contesto += formattaTopPastiFrequenza(analisiStorica.top_pasti);
  contesto += "\n";

  // 5. Top pasti semanticamente rilevanti
  contesto += formattaTopPastiSimilarita(pastiRaccomandati);
  contesto += "\n";

  contesto += "=== FINE CONTESTO ===";

  // Controllo lunghezza approssimativa (4000 token ≈ 16000 caratteri)
  if (contesto.length > 16000) {
    console.warn(`Contesto RAG troppo lungo: ${contesto.length} caratteri`);
    // Eventuale troncamento se necessario
  }

  return contesto;
}

// FASE 5: Prima Chiamata Bedrock - Generazione Piano

// Configurazione modello da variabile d'ambiente
const getBedrockModel = (): string => {
  const modelFromEnv = process.env.AWS_BEDROCK_MODEL;
  if (!modelFromEnv) {
    throw new Error("Variabile d'ambiente AWS_BEDROCK_MODEL non configurata!");
  }

  console.log(`✅ Usando modello da ENV: ${modelFromEnv}`);
  return modelFromEnv;
};

// Costruzione prompt principale per generazione piano
function costruisciPromptPianoAlimentare(
  contestoRAG: string,
  preferenze: string[],
  esclusioni: string[]
): string {
  // Usa il nuovo sistema di prompt da file Markdown
  return buildPromptPianoAlimentare(contestoRAG, preferenze, esclusioni);
}

// Funzione per chiamare Bedrock e generare il piano
async function generaPianoConBedrock(
  contestoRAG: string,
  preferenze: string[],
  esclusioni: string[],
  sessionId: string
): Promise<{
  piano_generato: Record<string, unknown>;
  metadata_chiamata: {
    modello_utilizzato: string;
    modello_configurato: string;
    lunghezza_prompt: number;
    token_input_stimati: number;
    token_output_ricevuti: number;
    tempo_elaborazione_ms: number;
  };
}> {
  const startTime = Date.now();
  const modello = getBedrockModel();

  try {
    // Costruzione prompt
    const prompt = costruisciPromptPianoAlimentare(
      contestoRAG,
      preferenze,
      esclusioni
    );
    const tokenInputStimati = Math.ceil(prompt.length / 4);

    // 🔄 CACHING: Prova a caricare response cachata
    console.log(`💾 Checking cache for session ${sessionId}...`);
    const cachedResponse = loadBedrockResponse("piano", sessionId);

    let contenutoRisposta: string;
    let tokenOutput: number;

    if (cachedResponse) {
      console.log("✅ Using cached Bedrock response!");
      contenutoRisposta = cachedResponse;
      tokenOutput = Math.ceil(contenutoRisposta.length / 4);
    } else {
      console.log(`🤖 Chiamata Bedrock - Modello: ${modello}`);
      console.log(
        `📝 Prompt: ${prompt.length} caratteri (${tokenInputStimati} token stimati)`
      );

      // Configurazione chiamata Bedrock per Claude
      const modelIdToUse = modello;

      const command = new InvokeModelCommand({
        modelId: modelIdToUse,
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: CONFIG.MAX_TOKENS_OUTPUT,
          temperature: CONFIG.TEMPERATURE_LLM,
          top_p: CONFIG.TOP_P_LLM,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      // Esecuzione chiamata
      console.log("🚀 Invio richiesta a Bedrock...");
      const response = await bedrockClient.send(command);

      // Parsing risposta
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      contenutoRisposta = responseBody.content[0].text;
      tokenOutput =
        responseBody.usage?.output_tokens ||
        Math.ceil(contenutoRisposta.length / 4);

      // 💾 SALVA RESPONSE IN CACHE
      saveBedrockResponse("piano", sessionId, prompt, contenutoRisposta, {
        modello,
        tokenInputStimati,
        tokenOutput,
        preferenze,
        esclusioni,
      });
    }

    console.log(`✅ Risposta ricevuta: ${contenutoRisposta.length} caratteri`);
    console.log(
      `📊 Token utilizzati: ${tokenInputStimati} input + ${tokenOutput} output`
    );

    // Parsing e validazione JSON
    let pianoGenerato;
    try {
      // Rimuovi wrapper markdown che Anthropic aggiunge
      let jsonString = contenutoRisposta.trim();

      console.log(
        "🔍 Raw response primi 100 char:",
        jsonString.substring(0, 100)
      );
      console.log(
        "🔍 Raw response ultimi 100 char:",
        jsonString.substring(jsonString.length - 100)
      );

      // Rimuovi ```json\n all'inizio
      if (jsonString.startsWith("```json\n")) {
        jsonString = jsonString.substring(8); // rimuovi '```json\n'
      } else if (jsonString.startsWith("```json")) {
        jsonString = jsonString.substring(7); // rimuovi '```json'
      }

      // Rimuovi \n``` alla fine
      if (jsonString.endsWith("\n```")) {
        jsonString = jsonString.substring(0, jsonString.length - 4); // rimuovi '\n```'
      } else if (jsonString.endsWith("```")) {
        jsonString = jsonString.substring(0, jsonString.length - 3); // rimuovi '```'
      }

      jsonString = jsonString.trim();

      console.log(
        "🧹 JSON pulito primi 100 char:",
        jsonString.substring(0, 100)
      );
      console.log(
        "🧹 JSON pulito ultimi 100 char:",
        jsonString.substring(jsonString.length - 100)
      );

      pianoGenerato = JSON.parse(jsonString);

      // Validazione struttura base
      if (!pianoGenerato.piano_alimentare) {
        throw new Error("Struttura JSON non valida: manca 'piano_alimentare'");
      }

      if (
        !pianoGenerato.piano_alimentare.giorni ||
        !Array.isArray(pianoGenerato.piano_alimentare.giorni)
      ) {
        throw new Error("Struttura JSON non valida: manca 'giorni' array");
      }

      if (pianoGenerato.piano_alimentare.giorni.length !== 7) {
        throw new Error(
          `Piano deve avere 7 giorni, ricevuti: ${pianoGenerato.piano_alimentare.giorni.length}`
        );
      }

      console.log("✅ JSON validato con successo");
    } catch (parseError) {
      console.error("❌ Errore parsing JSON:", parseError);
      console.error(
        "🔍 Contenuto ricevuto:",
        contenutoRisposta.substring(0, 500) + "..."
      );
      throw new Error(
        `Errore parsing JSON dalla risposta LLM: ${
          parseError instanceof Error
            ? parseError.message
            : "Errore sconosciuto"
        }`
      );
    }

    const endTime = Date.now();

    return {
      piano_generato: pianoGenerato,
      metadata_chiamata: {
        modello_utilizzato: modello, // Usa il modello configurato
        modello_configurato: modello, // Modello originale dal .env
        lunghezza_prompt: prompt.length,
        token_input_stimati: tokenInputStimati,
        token_output_ricevuti: tokenOutput,
        tempo_elaborazione_ms: endTime - startTime,
      },
    };
  } catch (error) {
    console.error("❌ Errore nella chiamata Bedrock:", error);
    throw new Error(
      `Errore generazione piano con Bedrock: ${
        error instanceof Error ? error.message : "Errore sconosciuto"
      }`
    );
  }
}

// FASE 6: Calcolo Nutrizionale A Posteriori

// Funzione per costruire prompt batch per analisi nutrizionale multipli pasti
function costruisciPromptNutrizionaleBatch(
  pastiDaAnalizzare: Array<{
    descrizione: string;
    tipo: "colazione" | "pranzo" | "cena";
    giorno: number;
    data: string;
  }>
): string {
  return buildPromptAnalisiNutrizionaleBatch(pastiDaAnalizzare);
}

// Funzione per creare pasto fallback con valori stimati
function creaPastoFallback(
  descrizione: string,
  tipo: "colazione" | "pranzo" | "cena"
): ValoriNutrizionaliPasto {
  // Stime basate sul tipo di pasto
  const calorieMedie = {
    colazione: 350,
    pranzo: 600,
    cena: 550,
  };

  const calorie = calorieMedie[tipo];
  const proteine = Math.round((calorie * 0.2) / 4); // 20% proteine
  const carboidrati = Math.round((calorie * 0.5) / 4); // 50% carboidrati
  const grassi = Math.round((calorie * 0.3) / 9); // 30% grassi

  return {
    descrizione_pasto: descrizione,
    tipo_pasto: tipo,
    calorie_stimate: calorie,
    proteine_g: proteine,
    carboidrati_g: carboidrati,
    grassi_g: grassi,
    fonte_calcolo: "fallback" as const,
    stato_calcolo: "stimato" as const,
  };
}

// Funzione per chiamare Bedrock per analisi nutrizionale batch (multipli pasti)
async function calcolaValoriNutrizionaliBatch(
  pastiDaAnalizzare: Array<{
    descrizione: string;
    tipo: "colazione" | "pranzo" | "cena";
    giorno: number;
    data: string;
  }>,
  sessionId: string
): Promise<Map<string, ValoriNutrizionaliPasto>> {
  const modello = getBedrockModel();
  const risultati = new Map<string, ValoriNutrizionaliPasto>();

  try {
    // Costruisci prompt per batch di pasti
    const promptBatch = costruisciPromptNutrizionaleBatch(pastiDaAnalizzare);

    // 🔄 CACHING: Prova a caricare response cachata
    console.log(
      `💾 Checking cache for nutritional batch session ${sessionId}...`
    );
    const cachedResponse = loadBedrockResponse("nutrizionale_batch", sessionId);

    let contenutoRisposta: string;

    if (cachedResponse) {
      console.log("✅ Using cached nutritional batch response!");
      contenutoRisposta = cachedResponse;
    } else {
      console.log(
        `🧮 Calcolo nutrizionale BATCH per ${pastiDaAnalizzare.length} pasti...`
      );

      const command = new InvokeModelCommand({
        modelId: modello,
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 8000, // Aumentato per batch
          temperature: 0.3,
          top_p: 0.8,
          messages: [
            {
              role: "user",
              content: promptBatch,
            },
          ],
        }),
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      contenutoRisposta = responseBody.content[0].text;

      // 💾 SALVA RESPONSE IN CACHE
      saveBedrockResponse(
        "nutrizionale_batch",
        sessionId,
        promptBatch,
        contenutoRisposta,
        {
          modello,
          numPasti: pastiDaAnalizzare.length,
          tipiPasti: pastiDaAnalizzare.map((p) => p.tipo),
        }
      );
    }

    // Parsing JSON dalla risposta batch
    const jsonString = contenutoRisposta
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const risultatoBatch = JSON.parse(jsonString);

    if (
      !risultatoBatch.analisi_pasti ||
      !Array.isArray(risultatoBatch.analisi_pasti)
    ) {
      throw new Error("Risposta batch non valida");
    }

    // Definisco il tipo per il pasto analizzato
    interface PastoAnalizzato {
      valori_nutrizionali: {
        calorie_stimate: number;
        proteine_g: number;
        carboidrati_g: number;
        grassi_g: number;
      };
    }

    // Processa ogni pasto dal batch
    risultatoBatch.analisi_pasti.forEach(
      (pasto: PastoAnalizzato, index: number) => {
        const pastoOriginale = pastiDaAnalizzare[index];
        const chiave = `${pastoOriginale.giorno}-${pastoOriginale.tipo}`;

        try {
          const valori = pasto.valori_nutrizionali;
          const calorie_stimate = Math.round(
            Number(valori.calorie_stimate) || 0
          );
          const proteine_g = Math.round(Number(valori.proteine_g) || 0);
          const carboidrati_g = Math.round(Number(valori.carboidrati_g) || 0);
          const grassi_g = Math.round(Number(valori.grassi_g) || 0);

          // Validazione range
          if (calorie_stimate >= 50 && calorie_stimate <= 2000) {
            risultati.set(chiave, {
              descrizione_pasto: pastoOriginale.descrizione,
              tipo_pasto: pastoOriginale.tipo,
              calorie_stimate,
              proteine_g,
              carboidrati_g,
              grassi_g,
              fonte_calcolo: "bedrock_ai" as const,
              stato_calcolo: "calcolato" as const,
            });
          } else {
            // Fallback per valori non validi
            risultati.set(
              chiave,
              creaPastoFallback(pastoOriginale.descrizione, pastoOriginale.tipo)
            );
          }
        } catch (error) {
          console.warn(`⚠️ Errore parsing pasto ${index}:`, error);
          risultati.set(
            chiave,
            creaPastoFallback(pastoOriginale.descrizione, pastoOriginale.tipo)
          );
        }
      }
    );

    return risultati;
  } catch (error) {
    console.error("❌ Errore batch nutrizionale:", error);

    // Fallback: crea valori stimati per tutti i pasti
    pastiDaAnalizzare.forEach((pasto) => {
      const chiave = `${pasto.giorno}-${pasto.tipo}`;
      risultati.set(chiave, creaPastoFallback(pasto.descrizione, pasto.tipo));
    });

    return risultati;
  }
}

// Funzione per estrarre descrizioni pasti dal piano generato
function estraiDescrizioniPasti(pianoGenerato: Record<string, unknown>): Array<{
  giorno: number;
  data: string;
  pasti: {
    colazione?: string;
    pranzo?: string;
    cena?: string;
  };
}> {
  try {
    // Accedi alla struttura del piano
    const piano = pianoGenerato as Record<string, unknown>;
    const pianoAlimentare = piano.piano_alimentare as Record<string, unknown>;
    const giorni =
      (pianoAlimentare?.giorni as Array<Record<string, unknown>>) || [];

    return giorni.map((giorno: Record<string, unknown>, index: number) => {
      const pastiGiorno: {
        colazione?: string;
        pranzo?: string;
        cena?: string;
      } = {};

      // Estrai descrizioni per ogni tipo di pasto
      const pasti = giorno.pasti as Record<string, Record<string, unknown>>;
      if (pasti) {
        if (pasti.colazione) {
          const colazione = pasti.colazione as Record<string, unknown>;
          pastiGiorno.colazione =
            (colazione.descrizione_dettagliata as string) ||
            (colazione.descrizione as string) ||
            (colazione.nome as string) ||
            "Colazione non specificata";
        }
        if (pasti.pranzo) {
          const pranzo = pasti.pranzo as Record<string, unknown>;
          pastiGiorno.pranzo =
            (pranzo.descrizione_dettagliata as string) ||
            (pranzo.descrizione as string) ||
            (pranzo.nome as string) ||
            "Pranzo non specificato";
        }
        if (pasti.cena) {
          const cena = pasti.cena as Record<string, unknown>;
          pastiGiorno.cena =
            (cena.descrizione_dettagliata as string) ||
            (cena.descrizione as string) ||
            (cena.nome as string) ||
            "Cena non specificata";
        }
      }

      return {
        giorno: index + 1,
        data:
          (giorno.data as string) ||
          new Date(Date.now() + index * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        pasti: pastiGiorno,
      };
    });
  } catch (error) {
    console.error("❌ Errore estrazione descrizioni pasti:", error);
    // Fallback: 7 giorni con pasti generici
    return Array.from({ length: 7 }, (_, index) => ({
      giorno: index + 1,
      data: new Date(Date.now() + index * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      pasti: {
        colazione: "Colazione standard",
        pranzo: "Pranzo standard",
        cena: "Cena standard",
      },
    }));
  }
}

// Funzione principale FASE 6: Calcolo nutrizionale completo del piano
async function calcolaValoriNutrizionaliPiano(
  pianoGenerato: Record<string, unknown>,
  sessionId: string
): Promise<{
  valori_giornalieri: ValoriNutrizionaliGiorno[];
  riepilogo_settimanale: {
    calorie_totali_settimana: number;
    media_calorie_giorno: number;
    proteine_totali_g: number;
    carboidrati_totali_g: number;
    grassi_totali_g: number;
    distribuzione_macro_media: {
      proteine_perc: number;
      carboidrati_perc: number;
      grassi_perc: number;
    };
  };
  statistiche_calcolo: {
    pasti_totali: number;
    pasti_calcolati_ai: number;
    pasti_stimati_fallback: number;
    pasti_con_errore: number;
    tempo_elaborazione_ms: number;
  };
}> {
  const startTime = Date.now();
  console.log("🧮 Inizio FASE 6: Calcolo nutrizionale a posteriori...");

  // Estrai descrizioni pasti dal piano
  const descrizioniPasti = estraiDescrizioniPasti(pianoGenerato);

  // **NOVITÀ: Prepara tutti i pasti per batch processing**
  const tuttiIPasti: Array<{
    descrizione: string;
    tipo: "colazione" | "pranzo" | "cena";
    giorno: number;
    data: string;
  }> = [];

  // Raccogli tutti i pasti da tutti i giorni
  for (const giornoData of descrizioniPasti) {
    for (const [tipoPasto, descrizione] of Object.entries(giornoData.pasti)) {
      if (descrizione) {
        tuttiIPasti.push({
          descrizione,
          tipo: tipoPasto as "colazione" | "pranzo" | "cena",
          giorno: giornoData.giorno,
          data: giornoData.data,
        });
      }
    }
  }

  console.log(
    `🔥 BATCH PROCESSING: ${tuttiIPasti.length} pasti da calcolare in una volta`
  );

  // **NOVITÀ: Calcolo batch di tutti i pasti**
  const risultatiBatch = await calcolaValoriNutrizionaliBatch(
    tuttiIPasti,
    sessionId
  );

  const valoriGiornalieri: ValoriNutrizionaliGiorno[] = [];
  const pastiTotali = tuttiIPasti.length;
  let pastiCalcolatiAI = 0;
  let pastiStimati = 0;
  let pastiConErrore = 0;

  // Processa ogni giorno usando i risultati batch
  for (const giornoData of descrizioniPasti) {
    const valoriGiorno: ValoriNutrizionaliGiorno = {
      giorno_numero: giornoData.giorno,
      data_giorno: giornoData.data,
      giorno_settimana: new Date(giornoData.data).toLocaleDateString("it-IT", {
        weekday: "long",
      }),
      pasti: {},
      totali_giorno: {
        calorie_totali_kcal: 0,
        proteine_totali_g: 0,
        carboidrati_totali_g: 0,
        grassi_totali_g: 0,
        percentuali_macro: {
          proteine_perc: 0,
          carboidrati_perc: 0,
          grassi_perc: 0,
        },
      },
    };

    // **NOVITÀ: Usa i risultati batch invece di chiamate singole**
    for (const [tipoPasto, descrizione] of Object.entries(giornoData.pasti)) {
      if (descrizione) {
        const chiave = `${giornoData.giorno}-${tipoPasto}`;
        const valoriPasto = risultatiBatch.get(chiave);

        if (valoriPasto) {
          valoriGiorno.pasti[tipoPasto as keyof typeof valoriGiorno.pasti] =
            valoriPasto;

          // Aggiorna contatori
          if (valoriPasto.fonte_calcolo === "bedrock_ai") {
            pastiCalcolatiAI++;
          } else {
            pastiStimati++;
          }

          if (valoriPasto.stato_calcolo === "errore") {
            pastiConErrore++;
          }
        } else {
          // Fallback se non trovato nel batch
          const fallbackPasto = creaPastoFallback(
            descrizione,
            tipoPasto as "colazione" | "pranzo" | "cena"
          );
          valoriGiorno.pasti[tipoPasto as keyof typeof valoriGiorno.pasti] =
            fallbackPasto;
          pastiStimati++;
        }
      }
    }

    // Calcola totali giornalieri
    const colazione = valoriGiorno.pasti.colazione || {
      calorie_stimate: 0,
      proteine_g: 0,
      carboidrati_g: 0,
      grassi_g: 0,
    };
    const pranzo = valoriGiorno.pasti.pranzo || {
      calorie_stimate: 0,
      proteine_g: 0,
      carboidrati_g: 0,
      grassi_g: 0,
    };
    const cena = valoriGiorno.pasti.cena || {
      calorie_stimate: 0,
      proteine_g: 0,
      carboidrati_g: 0,
      grassi_g: 0,
    };

    const calorieTotali =
      colazione.calorie_stimate + pranzo.calorie_stimate + cena.calorie_stimate;
    const proteineTotali =
      colazione.proteine_g + pranzo.proteine_g + cena.proteine_g;
    const carboidratiTotali =
      colazione.carboidrati_g + pranzo.carboidrati_g + cena.carboidrati_g;
    const grassiTotali = colazione.grassi_g + pranzo.grassi_g + cena.grassi_g;

    // Calcola percentuali macronutrienti (calorie da macro)
    const calorieProteine = proteineTotali * 4;
    const calorieCarboidrati = carboidratiTotali * 4;
    const calorieGrassi = grassiTotali * 9;
    const calorieMacroTotali =
      calorieProteine + calorieCarboidrati + calorieGrassi;

    valoriGiorno.totali_giorno = {
      calorie_totali_kcal: calorieTotali,
      proteine_totali_g: proteineTotali,
      carboidrati_totali_g: carboidratiTotali,
      grassi_totali_g: grassiTotali,
      percentuali_macro: {
        proteine_perc:
          calorieMacroTotali > 0
            ? Math.round((calorieProteine / calorieMacroTotali) * 100)
            : 0,
        carboidrati_perc:
          calorieMacroTotali > 0
            ? Math.round((calorieCarboidrati / calorieMacroTotali) * 100)
            : 0,
        grassi_perc:
          calorieMacroTotali > 0
            ? Math.round((calorieGrassi / calorieMacroTotali) * 100)
            : 0,
      },
    };

    valoriGiornalieri.push(valoriGiorno);
  }

  // Calcola riepilogo settimanale
  const calorieTotaliSettimana = valoriGiornalieri.reduce(
    (sum, g) => sum + g.totali_giorno.calorie_totali_kcal,
    0
  );
  const proteineTotaliSettimana = valoriGiornalieri.reduce(
    (sum, g) => sum + g.totali_giorno.proteine_totali_g,
    0
  );
  const carboidratiTotaliSettimana = valoriGiornalieri.reduce(
    (sum, g) => sum + g.totali_giorno.carboidrati_totali_g,
    0
  );
  const grassiTotaliSettimana = valoriGiornalieri.reduce(
    (sum, g) => sum + g.totali_giorno.grassi_totali_g,
    0
  );

  const mediaCalorieGiorno = Math.round(calorieTotaliSettimana / 7);

  // Calcola distribuzione macro media settimanale
  const calorieProteineSettimana = proteineTotaliSettimana * 4;
  const calorieCarboidratiSettimana = carboidratiTotaliSettimana * 4;
  const calorieGrassiSettimana = grassiTotaliSettimana * 9;
  const calorieMacroTotaliSettimana =
    calorieProteineSettimana +
    calorieCarboidratiSettimana +
    calorieGrassiSettimana;

  const endTime = Date.now();

  console.log(`✅ FASE 6 completata in ${endTime - startTime}ms`);
  console.log(
    `📊 Elaborati ${pastiTotali} pasti: ${pastiCalcolatiAI} AI + ${pastiStimati} fallback`
  );

  return {
    valori_giornalieri: valoriGiornalieri,
    riepilogo_settimanale: {
      calorie_totali_settimana: calorieTotaliSettimana,
      media_calorie_giorno: mediaCalorieGiorno,
      proteine_totali_g: proteineTotaliSettimana,
      carboidrati_totali_g: carboidratiTotaliSettimana,
      grassi_totali_g: grassiTotaliSettimana,
      distribuzione_macro_media: {
        proteine_perc:
          calorieMacroTotaliSettimana > 0
            ? Math.round(
                (calorieProteineSettimana / calorieMacroTotaliSettimana) * 100
              )
            : 0,
        carboidrati_perc:
          calorieMacroTotaliSettimana > 0
            ? Math.round(
                (calorieCarboidratiSettimana / calorieMacroTotaliSettimana) *
                  100
              )
            : 0,
        grassi_perc:
          calorieMacroTotaliSettimana > 0
            ? Math.round(
                (calorieGrassiSettimana / calorieMacroTotaliSettimana) * 100
              )
            : 0,
      },
    },
    statistiche_calcolo: {
      pasti_totali: pastiTotali,
      pasti_calcolati_ai: pastiCalcolatiAI,
      pasti_stimati_fallback: pastiStimati,
      pasti_con_errore: pastiConErrore,
      tempo_elaborazione_ms: endTime - startTime,
    },
  };
}

export async function POST(request: NextRequest) {
  // Genera session ID per caching
  const sessionId = generateSessionId();
  console.log(`🆔 Session ID: ${sessionId}`);

  try {
    // Parsing del body della richiesta
    const body: GeneraPianoRequest = await request.json();

    // Validazione dell'input
    const validationError = validateInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Estrazione dei parametri validati
    const { periodo_giorni, preferenze = [], esclusioni = [] } = body;

    // Log per debugging
    console.log("Generazione piano per:", {
      sessionId,
      periodo_giorni,
      preferenze,
      esclusioni,
    });

    // FASE 2: Esecuzione analisi storica
    console.log("Inizio analisi storica...");
    const analisiStorica = await eseguiAnalisiStorica(periodo_giorni);
    console.log("Analisi storica completata");

    // FASE 3: Retrieval Ibrido
    console.log("Inizio retrieval ibrido...");
    const pastiRaccomandati = await getRetrievalIbrido(
      preferenze,
      esclusioni,
      periodo_giorni
    );
    console.log("Retrieval ibrido completato");

    // FASE 4: Costruzione Contesto RAG
    console.log("Costruzione contesto RAG...");
    const contestoRAG = assemblaContestoRAG(analisiStorica, pastiRaccomandati);
    console.log(`Contesto RAG generato: ${contestoRAG.length} caratteri`);

    // FASE 5: Prima Chiamata Bedrock - Generazione Piano
    console.log("🤖 Inizio FASE 5: Generazione piano con Bedrock...");
    const risultatoGenerazione = await generaPianoConBedrock(
      contestoRAG,
      preferenze,
      esclusioni,
      sessionId
    );
    console.log(
      `✅ Piano generato con successo in ${risultatoGenerazione.metadata_chiamata.tempo_elaborazione_ms}ms`
    );

    // FASE 6: Calcolo Nutrizionale A Posteriori
    console.log("🧮 Inizio FASE 6: Calcolo nutrizionale a posteriori...");
    const risultatoNutrizionale = await calcolaValoriNutrizionaliPiano(
      risultatoGenerazione.piano_generato,
      sessionId
    );
    console.log(
      `✅ Calcolo nutrizionale completato in ${risultatoNutrizionale.statistiche_calcolo.tempo_elaborazione_ms}ms`
    );

    // FASE 7: Aggregazione e Salvataggio
    console.log("💾 Inizio FASE 7: Aggregazione e salvataggio...");

    // Converto il risultato nutrizionale al formato corretto
    const risultatoNutrizionaleCompleto: RisultatoCalcoloNutrizionale = {
      valori_giornalieri: risultatoNutrizionale.valori_giornalieri,
      riepilogo_settimanale: {
        calorie_totali_settimana:
          risultatoNutrizionale.riepilogo_settimanale.calorie_totali_settimana,
        media_calorie_giorno:
          risultatoNutrizionale.riepilogo_settimanale.media_calorie_giorno,
        proteine_totali_settimana_g:
          risultatoNutrizionale.riepilogo_settimanale.proteine_totali_g,
        carboidrati_totali_settimana_g:
          risultatoNutrizionale.riepilogo_settimanale.carboidrati_totali_g,
        grassi_totali_settimana_g:
          risultatoNutrizionale.riepilogo_settimanale.grassi_totali_g,
        distribuzione_macro_media:
          risultatoNutrizionale.riepilogo_settimanale.distribuzione_macro_media,
        confronto_con_linee_guida: {
          calorie_range_consigliato: { min: 1800, max: 2500 },
          proteine_perc_consigliata: { min: 10, max: 35 },
          carboidrati_perc_consigliata: { min: 45, max: 65 },
          grassi_perc_consigliata: { min: 20, max: 35 },
          valutazione_bilanciamento: valutaBilanciamento(
            risultatoNutrizionale.riepilogo_settimanale.media_calorie_giorno,
            risultatoNutrizionale.riepilogo_settimanale
              .distribuzione_macro_media
          ),
        },
      },
      statistiche_calcolo: {
        pasti_totali_analizzati:
          risultatoNutrizionale.statistiche_calcolo.pasti_totali,
        pasti_calcolati_ai:
          risultatoNutrizionale.statistiche_calcolo.pasti_calcolati_ai,
        pasti_stimati_fallback:
          risultatoNutrizionale.statistiche_calcolo.pasti_stimati_fallback,
        pasti_con_errore:
          risultatoNutrizionale.statistiche_calcolo.pasti_con_errore,
        tempo_elaborazione_ms:
          risultatoNutrizionale.statistiche_calcolo.tempo_elaborazione_ms,
        modello_ai_utilizzato:
          risultatoGenerazione.metadata_chiamata.modello_utilizzato,
        chiamate_ai_totali:
          risultatoNutrizionale.statistiche_calcolo.pasti_calcolati_ai + 1, // +1 per la chiamata piano
      },
    };

    const risultatoFase7 = await eseguiFase7AggregazioneESalvataggio(
      risultatoGenerazione.piano_generato,
      risultatoNutrizionaleCompleto,
      analisiStorica,
      periodo_giorni
    );
    console.log(
      `✅ FASE 7 completata: Piano ID ${risultatoFase7.piano_id} salvato nel database`
    );

    // Preparazione dati per risposta strutturata
    const timestamp = new Date().toISOString();
    const pianoId = risultatoFase7.piano_id; // Usa l'ID reale dal database

    // Conteggi e statistiche per il summary
    const totalePastiRaccomandati = pastiRaccomandati.length;
    const pastiConSimilarita = pastiRaccomandati.filter(
      (p) => p.dettagli.score_similarita > 0
    ).length;
    const pastiConFrequenza = pastiRaccomandati.filter(
      (p) => p.dettagli.frequenza && p.dettagli.frequenza > 0
    ).length;

    // Risposta HTTP riformulata e strutturata
    return NextResponse.json({
      // === HEADER DELLA RISPOSTA ===
      success: true,
      timestamp,
      piano_id: pianoId,
      fase_completata: "FASE_7_AGGREGAZIONE_E_SALVATAGGIO_COMPLETATO",

      // === PARAMETRI RICHIESTA ===
      richiesta: {
        periodo_giorni,
        preferenze:
          preferenze.length > 0
            ? preferenze
            : ["Nessuna preferenza specificata"],
        esclusioni:
          esclusioni.length > 0
            ? esclusioni
            : ["Nessuna esclusione specificata"],
      },

      // === SUMMARY ESECUZIONE ===
      summary: {
        message:
          "✅ Pipeline completa: Piano alimentare generato, calcolato e salvato nel database!",
        fasi_completate: [
          "FASE_2: Analisi storica dei dati",
          "FASE_3: Retrieval ibrido (frequenza + similarità)",
          "FASE_4: Costruzione contesto RAG",
          "FASE_5: Generazione piano con Bedrock",
          "FASE_6: Calcolo nutrizionale a posteriori",
          "FASE_7: Aggregazione e salvataggio nel database",
        ],
        statistiche_elaborazione: {
          piani_storici_analizzati:
            analisiStorica.statistiche_generali.totale_piani,
          pattern_temporali_identificati:
            analisiStorica.pattern_temporali.length,
          preferenze_alimentari_rilevate:
            analisiStorica.preferenze_rilevate.length,
          top_pasti_frequenti: analisiStorica.top_pasti.length,
          pasti_raccomandati_totali: totalePastiRaccomandati,
          pasti_con_score_similarita: pastiConSimilarita,
          pasti_con_dati_frequenza: pastiConFrequenza,
          // Nuove statistiche FASE 7
          piano_id_database: risultatoFase7.piano_id,
          nuovi_pasti_creati: risultatoFase7.nuovi_pasti_creati,
          relazioni_piano_pasti_create: risultatoFase7.relazioni_create,
          embeddings_generati: risultatoFase7.embeddings_generati,
          // Nuove statistiche FASE 6
          pasti_analizzati_nutrizionalmente:
            risultatoNutrizionale.statistiche_calcolo.pasti_totali,
          pasti_calcolati_ai:
            risultatoNutrizionale.statistiche_calcolo.pasti_calcolati_ai,
          pasti_stimati_fallback:
            risultatoNutrizionale.statistiche_calcolo.pasti_stimati_fallback,
          media_calorie_giorno:
            risultatoNutrizionale.riepilogo_settimanale.media_calorie_giorno,
        },
      },

      // === RISULTATI ANALISI STORICA ===
      analisi_storica: {
        periodo_analizzato_giorni: periodo_giorni,
        piani_recenti: {
          count: analisiStorica.piani_recenti.length,
          data: analisiStorica.piani_recenti.slice(0, 3), // Mostra solo i primi 3 per brevità
        },
        profilo_nutrizionale: analisiStorica.statistiche_generali,
        pattern_settimanali: analisiStorica.pattern_temporali,
        top_pasti_storici: analisiStorica.top_pasti.slice(0, 5),
        preferenze_identificate: analisiStorica.preferenze_rilevate,
      },

      // === RISULTATI RETRIEVAL IBRIDO ===
      retrieval_ibrido: {
        metodologia:
          "Combinazione frequenza storica (70%) + similarità semantica (30%)",
        pasti_raccomandati: {
          totali: totalePastiRaccomandati,
          top_5_score_finale: pastiRaccomandati.slice(0, 5).map((p) => ({
            id: p.id,
            descrizione: p.descrizione,
            tipo: p.tipo_pasto,
            score_finale_percentuale: Math.round(p.score_finale * 100),
            dettagli: {
              fonte: p.dettagli.fonte,
              score_frequenza_perc: Math.round(
                p.dettagli.score_frequenza * 100
              ),
              score_similarita_perc: Math.round(
                p.dettagli.score_similarita * 100
              ),
              frequenza_storica: p.dettagli.frequenza || 0,
            },
          })),
        },
      },

      // === CONTESTO RAG GENERATO ===
      contesto_rag: {
        stato: "✅ Generato con successo",
        metriche: {
          lunghezza_caratteri: contestoRAG.length,
          token_stimati: Math.ceil(contestoRAG.length / 4),
          limite_token: 4000,
          utilizzo_percentuale: Math.round(
            (Math.ceil(contestoRAG.length / 4) / 4000) * 100
          ),
        },
        componenti_incluse: {
          "📊 Statistiche storiche": true,
          "📈 Pattern temporali": analisiStorica.pattern_temporali.length > 0,
          "🍽️ Preferenze rilevate":
            analisiStorica.preferenze_rilevate.length > 0,
          "⭐ Top pasti frequenti": analisiStorica.top_pasti.length > 0,
          "🎯 Pasti semanticamente rilevanti": pastiConSimilarita > 0,
        },
        testo_completo: contestoRAG,
      },

      // === PIANO ALIMENTARE GENERATO ===
      piano_alimentare: {
        id: pianoId,
        stato: "✅ Generato con successo",
        creato_il: timestamp,
        configurazione: {
          durata_giorni: 7,
          pasti_totali_pianificati: 21,
          pasti_per_giorno: ["Colazione", "Pranzo", "Cena"],
        },
        dettagli_generazione: {
          modello_utilizzato:
            risultatoGenerazione.metadata_chiamata.modello_utilizzato,
          tempo_elaborazione_ms:
            risultatoGenerazione.metadata_chiamata.tempo_elaborazione_ms,
          token_input:
            risultatoGenerazione.metadata_chiamata.token_input_stimati,
          token_output:
            risultatoGenerazione.metadata_chiamata.token_output_ricevuti,
          lunghezza_prompt:
            risultatoGenerazione.metadata_chiamata.lunghezza_prompt,
        },
        piano_completo: risultatoGenerazione.piano_generato,
        prossimi_passi: [
          "FASE_6: Validazione nutrizionale e bilanciamento",
          "FASE_7: Salvataggio piano nel database",
          "FASE_8: Finalizzazione e notifica utente",
        ],
      },

      // === METADATA TECNICI ===
      metadata: {
        versione_api: "1.0",
        ambiente: process.env.NODE_ENV || "development",
        processing_time_ms: Date.now() - new Date(timestamp).getTime(),
        retrieval_method: "hybrid_frequency_similarity",
        embedding_model: "amazon.titan-embed-text-v2:0",
      },
    });
  } catch (error) {
    console.error("Errore nella generazione del piano:", error);

    return NextResponse.json(
      {
        error: "Errore interno del server",
        details: error instanceof Error ? error.message : "Errore sconosciuto",
      },
      { status: 500 }
    );
  }
}

// Funzione di validazione dell'input
function validateInput(body: unknown): string | null {
  // Type guard per verificare che body sia un oggetto
  if (!body || typeof body !== "object") {
    return "Corpo della richiesta non valido";
  }

  const bodyObj = body as Record<string, unknown>;

  // Controllo presenza periodo_giorni
  if (!bodyObj.periodo_giorni) {
    return "Il parametro periodo_giorni è obbligatorio";
  }

  // Controllo che sia un numero
  if (!Number.isInteger(bodyObj.periodo_giorni)) {
    return "Il parametro periodo_giorni deve essere un numero intero";
  }

  // Controllo range valido (minimo 7 giorni, massimo 365)
  if ((bodyObj.periodo_giorni as number) < 7) {
    return "Il periodo minimo è di 7 giorni";
  }

  if ((bodyObj.periodo_giorni as number) > 365) {
    return "Il periodo massimo è di 365 giorni";
  }

  // Validazione preferenze (opzionale)
  if (bodyObj.preferenze && !Array.isArray(bodyObj.preferenze)) {
    return "Le preferenze devono essere un array di stringhe";
  }

  // Validazione esclusioni (opzionale)
  if (bodyObj.esclusioni && !Array.isArray(bodyObj.esclusioni)) {
    return "Le esclusioni devono essere un array di stringhe";
  }

  return null; // Input valido
}

// Gestione metodi non supportati
export async function GET() {
  return NextResponse.json(
    { error: "Metodo non supportato. Usa POST." },
    { status: 405 }
  );
}

// ==========================================
// 🔥 FASE 7: AGGREGAZIONE E SALVATAGGIO
// ==========================================

/**
 * Calcola i totali nutrizionali giornalieri sommando colazione, pranzo e cena
 */
function calcolaTotaliGiornalieri(
  risultatoNutrizionale: RisultatoCalcoloNutrizionale
): ValoriNutrizionaliGiorno[] {
  console.log("🧮 FASE 7.1: Calcolo totali giornalieri...");

  return risultatoNutrizionale.valori_giornalieri.map((giorno) => {
    const { colazione, pranzo, cena } = giorno.pasti;

    // Somma i valori nutrizionali dei 3 pasti
    const calorie_totali_kcal =
      (colazione?.calorie_stimate || 0) +
      (pranzo?.calorie_stimate || 0) +
      (cena?.calorie_stimate || 0);

    const proteine_totali_g =
      (colazione?.proteine_g || 0) +
      (pranzo?.proteine_g || 0) +
      (cena?.proteine_g || 0);

    const carboidrati_totali_g =
      (colazione?.carboidrati_g || 0) +
      (pranzo?.carboidrati_g || 0) +
      (cena?.carboidrati_g || 0);

    const grassi_totali_g =
      (colazione?.grassi_g || 0) +
      (pranzo?.grassi_g || 0) +
      (cena?.grassi_g || 0);

    // Calcola percentuali macro (evita divisione per zero)
    const calorie_da_macro =
      proteine_totali_g * 4 + carboidrati_totali_g * 4 + grassi_totali_g * 9;

    const percentuali_macro = {
      proteine_perc:
        calorie_da_macro > 0
          ? Math.round(((proteine_totali_g * 4) / calorie_da_macro) * 100)
          : 0,
      carboidrati_perc:
        calorie_da_macro > 0
          ? Math.round(((carboidrati_totali_g * 4) / calorie_da_macro) * 100)
          : 0,
      grassi_perc:
        calorie_da_macro > 0
          ? Math.round(((grassi_totali_g * 9) / calorie_da_macro) * 100)
          : 0,
    };

    console.log(
      `📊 ${giorno.giorno_settimana}: ${calorie_totali_kcal}kcal (P:${proteine_totali_g}g C:${carboidrati_totali_g}g G:${grassi_totali_g}g)`
    );

    return {
      ...giorno,
      totali_giorno: {
        calorie_totali_kcal,
        proteine_totali_g,
        carboidrati_totali_g,
        grassi_totali_g,
        percentuali_macro,
      },
    };
  });
}

/**
 * Calcola i totali settimanali aggregando tutti i 7 giorni
 */
function calcolaTotaliSettimanali(
  giorniConTotali: ValoriNutrizionaliGiorno[]
): RiepilogoNutrizionaleSettimanale {
  console.log("📊 FASE 7.2: Calcolo totali settimanali...");

  // Somma tutti i giorni della settimana
  const calorie_totali_settimana = giorniConTotali.reduce(
    (sum, giorno) => sum + giorno.totali_giorno.calorie_totali_kcal,
    0
  );

  const proteine_totali_settimana_g = giorniConTotali.reduce(
    (sum, giorno) => sum + giorno.totali_giorno.proteine_totali_g,
    0
  );

  const carboidrati_totali_settimana_g = giorniConTotali.reduce(
    (sum, giorno) => sum + giorno.totali_giorno.carboidrati_totali_g,
    0
  );

  const grassi_totali_settimana_g = giorniConTotali.reduce(
    (sum, giorno) => sum + giorno.totali_giorno.grassi_totali_g,
    0
  );

  // Medie giornaliere
  const media_calorie_giorno = Math.round(calorie_totali_settimana / 7);

  // Distribuzione macro media settimanale
  const calorie_totali_da_macro =
    proteine_totali_settimana_g * 4 +
    carboidrati_totali_settimana_g * 4 +
    grassi_totali_settimana_g * 9;

  const distribuzione_macro_media = {
    proteine_perc:
      calorie_totali_da_macro > 0
        ? Math.round(
            ((proteine_totali_settimana_g * 4) / calorie_totali_da_macro) * 100
          )
        : 0,
    carboidrati_perc:
      calorie_totali_da_macro > 0
        ? Math.round(
            ((carboidrati_totali_settimana_g * 4) / calorie_totali_da_macro) *
              100
          )
        : 0,
    grassi_perc:
      calorie_totali_da_macro > 0
        ? Math.round(
            ((grassi_totali_settimana_g * 9) / calorie_totali_da_macro) * 100
          )
        : 0,
  };

  // Linee guida nutrizionali standard (adulto medio)
  const confronto_con_linee_guida = {
    calorie_range_consigliato: { min: 1800, max: 2500 },
    proteine_perc_consigliata: { min: 10, max: 35 },
    carboidrati_perc_consigliata: { min: 45, max: 65 },
    grassi_perc_consigliata: { min: 20, max: 35 },
    valutazione_bilanciamento: valutaBilanciamento(
      media_calorie_giorno,
      distribuzione_macro_media
    ),
  };

  console.log(
    `📈 Totali settimanali: ${calorie_totali_settimana}kcal (media: ${media_calorie_giorno}/giorno)`
  );
  console.log(
    `🥗 Macro: P:${distribuzione_macro_media.proteine_perc}% C:${distribuzione_macro_media.carboidrati_perc}% G:${distribuzione_macro_media.grassi_perc}%`
  );

  return {
    calorie_totali_settimana,
    media_calorie_giorno,
    proteine_totali_settimana_g,
    carboidrati_totali_settimana_g,
    grassi_totali_settimana_g,
    distribuzione_macro_media,
    confronto_con_linee_guida,
  };
}

/**
 * Valuta il bilanciamento nutrizionale secondo le linee guida
 */
function valutaBilanciamento(
  calorieGiornaliere: number,
  macro: {
    proteine_perc: number;
    carboidrati_perc: number;
    grassi_perc: number;
  }
): "ottimale" | "accettabile" | "da_migliorare" {
  // Controlli per valutazione ottimale
  const calorieOk = calorieGiornaliere >= 1800 && calorieGiornaliere <= 2500;
  const proteineOk = macro.proteine_perc >= 15 && macro.proteine_perc <= 30;
  const carboidratiOk =
    macro.carboidrati_perc >= 45 && macro.carboidrati_perc <= 65;
  const grassiOk = macro.grassi_perc >= 20 && macro.grassi_perc <= 35;

  if (calorieOk && proteineOk && carboidratiOk && grassiOk) {
    return "ottimale";
  }

  // Controlli per valutazione accettabile (range più ampio)
  const calorieAccettabili =
    calorieGiornaliere >= 1600 && calorieGiornaliere <= 2800;
  const proteineAccettabili =
    macro.proteine_perc >= 10 && macro.proteine_perc <= 35;
  const carboidratiAccettabili =
    macro.carboidrati_perc >= 40 && macro.carboidrati_perc <= 70;
  const grassiAccettabili = macro.grassi_perc >= 15 && macro.grassi_perc <= 40;

  if (
    calorieAccettabili &&
    proteineAccettabili &&
    carboidratiAccettabili &&
    grassiAccettabili
  ) {
    return "accettabile";
  }

  return "da_migliorare";
}

/**
 * Salva il piano alimentare principale nel database
 */
async function salvaPianoPrincipale(
  periodoGiorni: number,
  analisiStorica: AnalisiStorica
): Promise<number> {
  console.log("💾 FASE 7.3: Salvataggio piano principale...");

  // Genera nome descrittivo basato sui dati storici
  const dataInizio =
    analisiStorica.piani_recenti.length > 0
      ? analisiStorica.piani_recenti[0].data_creazione
      : new Date().toISOString().split("T")[0];

  const nomePiano = `Piano Settimanale - Basato su Storico ${dataInizio}`;

  const descrizione = `Piano alimentare di ${periodoGiorni} giorni generato automaticamente dall'AI basandosi su ${
    analisiStorica.statistiche_generali.totale_piani
  } piani precedenti. Media calorica storica: ${Math.round(
    analisiStorica.statistiche_generali.media_calorie_giornaliere
  )}kcal/giorno.`;

  try {
    const [pianoCeato] = await db
      .insert(pianiAlimentari)
      .values({
        nome: nomePiano,
        descrizione: descrizione,
        autore: "Sistema AI",
      })
      .returning({ id: pianiAlimentari.id });

    console.log(`✅ Piano creato con ID: ${pianoCeato.id}`);
    return pianoCeato.id;
  } catch (error) {
    console.error("❌ Errore salvataggio piano:", error);
    throw new Error(`Errore nel salvataggio del piano: ${error}`);
  }
}

/**
 * Salva i dettagli nutrizionali giornalieri nel database
 */
async function salvaDettagliNutrizionaliGiornalieri(
  pianoId: number,
  giorniConTotali: ValoriNutrizionaliGiorno[]
): Promise<void> {
  console.log("📊 FASE 7.4: Salvataggio dettagli nutrizionali giornalieri...");

  const dettagliDaInserire = giorniConTotali.map((giorno) => ({
    pianoId,
    giornoSettimana: giorno.giorno_settimana,
    proteineTotaliG: giorno.totali_giorno.proteine_totali_g,
    carboidratiTotaliG: giorno.totali_giorno.carboidrati_totali_g,
    grassiTotaliG: giorno.totali_giorno.grassi_totali_g,
    calorieTotaliKcal: giorno.totali_giorno.calorie_totali_kcal,
  }));

  try {
    await db.insert(dettagliNutrizionaliGiornalieri).values(dettagliDaInserire);
    console.log(
      `✅ Salvati ${dettagliDaInserire.length} giorni di dettagli nutrizionali`
    );
  } catch (error) {
    console.error("❌ Errore salvataggio dettagli nutrizionali:", error);
    throw new Error(
      `Errore nel salvataggio dei dettagli nutrizionali: ${error}`
    );
  }
}

/**
 * Identifica e salva i nuovi pasti creati dall'AI
 */
async function salvaNuoviPastiGenerati(
  pianoGenerato: Record<string, unknown>,
  risultatoNutrizionale: RisultatoCalcoloNutrizionale
): Promise<{ nuoviPastiCreati: number; mappaIdPasti: Map<string, number> }> {
  console.log("🍽️ FASE 7.5: Identificazione e salvataggio nuovi pasti...");

  const mappaIdPasti = new Map<string, number>();
  let nuoviPastiCreati = 0;

  try {
    // Estrai tutte le descrizioni uniche dal piano
    const descrizioniPasti = estraiDescrizioniPasti(pianoGenerato);
    const descrizioniUniche = new Set<string>();

    // Raccogli tutte le descrizioni uniche
    descrizioniPasti.forEach((giorno) => {
      if (giorno.pasti.colazione) descrizioniUniche.add(giorno.pasti.colazione);
      if (giorno.pasti.pranzo) descrizioniUniche.add(giorno.pasti.pranzo);
      if (giorno.pasti.cena) descrizioniUniche.add(giorno.pasti.cena);
    });

    console.log(
      `🔍 Trovate ${descrizioniUniche.size} descrizioni uniche di pasti`
    );

    // Verifica esistenza nel database
    const descrizioniArray = Array.from(descrizioniUniche);
    const pastiEsistenti = await db
      .select({
        id: pasti.id,
        descrizione: pasti.descrizioneDettagliata,
      })
      .from(pasti)
      .where(inArray(pasti.descrizioneDettagliata, descrizioniArray));

    const mappaEsistenti = new Map(
      pastiEsistenti.map((p) => [p.descrizione, p.id])
    );

    console.log(`📊 ${pastiEsistenti.length} pasti già esistenti nel database`);

    // Trova nuovi pasti da creare
    const nuoveDescrizioni = descrizioniArray.filter(
      (desc) => !mappaEsistenti.has(desc)
    );

    console.log(`🆕 ${nuoveDescrizioni.length} nuovi pasti da creare`);

    // Crea i nuovi pasti con valori nutrizionali
    for (const descrizione of nuoveDescrizioni) {
      // Trova i valori nutrizionali dal risultato FASE 6
      const valoriNutrizionali = trovaNutrizionaliPerDescrizione(
        descrizione,
        risultatoNutrizionale
      );

      if (!valoriNutrizionali) {
        console.warn(`⚠️ Valori nutrizionali non trovati per: ${descrizione}`);
        continue;
      }

      // INSERT nuovo pasto
      const [pastoCreato] = await db
        .insert(pasti)
        .values({
          tipoPasto: valoriNutrizionali.tipo_pasto,
          descrizioneDettagliata: descrizione,
          noteAggiuntive: `Pasto generato automaticamente dall'AI in data ${
            new Date().toISOString().split("T")[0]
          }`,
          calorieStimate: valoriNutrizionali.calorie_stimate,
          proteineG: valoriNutrizionali.proteine_g,
          carboidratiG: valoriNutrizionali.carboidrati_g,
          grassiG: valoriNutrizionali.grassi_g,
          // embedding verrà aggiunto in seguito
        })
        .returning({ id: pasti.id });

      mappaIdPasti.set(descrizione, pastoCreato.id);
      nuoviPastiCreati++;

      console.log(
        `✅ Pasto creato ID ${pastoCreato.id}: ${descrizione.substring(
          0,
          60
        )}...`
      );
    }

    // Aggiungi anche i pasti esistenti alla mappa
    pastiEsistenti.forEach((pasto) => {
      mappaIdPasti.set(pasto.descrizione, pasto.id);
    });

    console.log(`🍽️ Totale pasti mappati: ${mappaIdPasti.size}`);

    return { nuoviPastiCreati, mappaIdPasti };
  } catch (error) {
    console.error("❌ Errore salvataggio nuovi pasti:", error);
    throw new Error(`Errore nel salvataggio dei nuovi pasti: ${error}`);
  }
}

/**
 * Trova i valori nutrizionali per una specifica descrizione di pasto
 */
function trovaNutrizionaliPerDescrizione(
  descrizione: string,
  risultatoNutrizionale: RisultatoCalcoloNutrizionale
): ValoriNutrizionaliPasto | null {
  for (const giorno of risultatoNutrizionale.valori_giornalieri) {
    for (const [, valori] of Object.entries(giorno.pasti)) {
      if (valori && valori.descrizione_pasto === descrizione) {
        return valori;
      }
    }
  }
  return null;
}

/**
 * Crea le relazioni tra piano e pasti nella tabella piani_pasti
 */
async function creaRelazioniPianoPasti(
  pianoId: number,
  pianoGenerato: Record<string, unknown>,
  mappaIdPasti: Map<string, number>
): Promise<number> {
  console.log("🔗 FASE 7.6: Creazione relazioni piano-pasti...");

  const relazioniDaInserire: Array<{
    pianoId: number;
    pastoId: number;
    giornoSettimana: string;
    ordineNelGiorno: number;
  }> = [];

  try {
    // Estrai descrizioni pasti dal piano
    const descrizioniPasti = estraiDescrizioniPasti(pianoGenerato);

    // Mappa tipi pasto all'ordine nel giorno
    const ordiniPasti = {
      colazione: 1,
      pranzo: 2,
      cena: 3,
    };

    // Mappa numeri giorni ai nomi
    const nomiGiorni = [
      "Lunedì",
      "Martedì",
      "Mercoledì",
      "Giovedì",
      "Venerdì",
      "Sabato",
      "Domenica",
    ];

    // Per ogni giorno del piano
    for (const giorno of descrizioniPasti) {
      const nomeGiorno = nomiGiorni[giorno.giorno - 1];

      // Per ogni tipo di pasto nel giorno
      for (const [tipoPasto, descrizione] of Object.entries(giorno.pasti)) {
        if (descrizione) {
          const pastoId = mappaIdPasti.get(descrizione);

          if (pastoId) {
            relazioniDaInserire.push({
              pianoId,
              pastoId,
              giornoSettimana: nomeGiorno,
              ordineNelGiorno:
                ordiniPasti[tipoPasto as keyof typeof ordiniPasti],
            });
          } else {
            console.warn(`⚠️ ID pasto non trovato per: ${descrizione}`);
          }
        }
      }
    }

    console.log(
      `🔗 Creando ${relazioniDaInserire.length} relazioni piano-pasti`
    );

    // INSERT delle relazioni
    if (relazioniDaInserire.length > 0) {
      await db.insert(pianiPasti).values(relazioniDaInserire);
      console.log(`✅ Relazioni piano-pasti create con successo`);
    }

    return relazioniDaInserire.length;
  } catch (error) {
    console.error("❌ Errore creazione relazioni piano-pasti:", error);
    throw new Error(
      `Errore nella creazione delle relazioni piano-pasti: ${error}`
    );
  }
}

/**
 * Genera embedding per un singolo pasto usando lo stesso modello esistente
 */
async function generaEmbeddingPasto(descrizione: string): Promise<number[]> {
  try {
    const bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
    });

    const body = JSON.stringify({
      inputText: descrizione,
      dimensions: 1024,
      normalize: true,
    });

    const command = new InvokeModelCommand({
      body,
      modelId: "amazon.titan-embed-text-v2:0",
      contentType: "application/json",
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return responseBody.embedding;
  } catch (error) {
    console.error("❌ Errore generazione embedding pasto:", error);
    throw new Error(`Errore nella generazione embedding: ${error}`);
  }
}

/**
 * Genera embeddings per tutti i nuovi pasti creati
 */
async function generaEmbeddingsNuoviPasti(
  mappaIdPasti: Map<string, number>,
  nuoviPastiCreati: number
): Promise<void> {
  console.log("🧠 FASE 7.7: Generazione embeddings per nuovi pasti...");

  if (nuoviPastiCreati === 0) {
    console.log("ℹ️ Nessun nuovo pasto da processare per embeddings");
    return;
  }

  try {
    let embeddingsGenerati = 0;

    // Ottieni tutti i pasti appena creati (senza embedding)
    const pastiSenzaEmbedding = await db
      .select({
        id: pasti.id,
        descrizione: pasti.descrizioneDettagliata,
      })
      .from(pasti)
      .where(sql`${pasti.embedding} IS NULL`)
      .limit(nuoviPastiCreati + 10); // Margine di sicurezza

    console.log(
      `🔍 Trovati ${pastiSenzaEmbedding.length} pasti senza embedding`
    );

    // Genera embedding per ogni pasto
    for (const pasto of pastiSenzaEmbedding) {
      // Verifica che sia uno dei pasti appena creati
      if (mappaIdPasti.has(pasto.descrizione)) {
        console.log(`🧠 Generando embedding per pasto ID ${pasto.id}...`);

        try {
          const embedding = await generaEmbeddingPasto(pasto.descrizione);

          // UPDATE del pasto con il nuovo embedding
          await db
            .update(pasti)
            .set({
              embedding: embedding,
            })
            .where(eq(pasti.id, pasto.id));

          embeddingsGenerati++;
          console.log(`✅ Embedding salvato per pasto ID ${pasto.id}`);

          // Delay per evitare rate limiting su Bedrock
          if (embeddingsGenerati < pastiSenzaEmbedding.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (embeddingError) {
          console.error(
            `❌ Errore embedding pasto ID ${pasto.id}:`,
            embeddingError
          );
          // Continua con il prossimo pasto anche in caso di errore
        }
      }
    }

    console.log(
      `🎯 Completato: ${embeddingsGenerati} embeddings generati e salvati`
    );
  } catch (error) {
    console.error("❌ Errore generale generazione embeddings:", error);
    throw new Error(`Errore nella generazione degli embeddings: ${error}`);
  }
}

/**
 * Funzione orchestratore principale della FASE 7: Aggregazione e Salvataggio
 */
async function eseguiFase7AggregazioneESalvataggio(
  pianoGenerato: Record<string, unknown>,
  risultatoNutrizionale: RisultatoCalcoloNutrizionale,
  analisiStorica: AnalisiStorica,
  periodoGiorni: number
): Promise<{
  piano_id: number;
  nuovi_pasti_creati: number;
  relazioni_create: number;
  embeddings_generati: number;
  riepilogo_settimanale: RiepilogoNutrizionaleSettimanale;
}> {
  console.log("🏁 INIZIO FASE 7: Aggregazione e Salvataggio...");
  const startTime = Date.now();

  try {
    // 7.1 & 7.2: Calcola totali giornalieri e settimanali
    const giorniConTotali = calcolaTotaliGiornalieri(risultatoNutrizionale);
    const riepilogoSettimanale = calcolaTotaliSettimanali(giorniConTotali);

    // 7.3: Salva piano principale
    console.log("🔄 Iniziando salvataggio piano principale...");
    const pianoId = await salvaPianoPrincipale(periodoGiorni, analisiStorica);
    console.log(`✅ Piano principale salvato con ID: ${pianoId}`);

    // 7.4: Salva dettagli nutrizionali giornalieri
    console.log("🔄 Iniziando salvataggio dettagli nutrizionali...");
    await salvaDettagliNutrizionaliGiornalieri(pianoId, giorniConTotali);
    console.log("✅ Dettagli nutrizionali salvati");

    // 7.5: Salva nuovi pasti generati dall'AI
    console.log("🔄 Iniziando salvataggio nuovi pasti...");
    const { nuoviPastiCreati, mappaIdPasti } = await salvaNuoviPastiGenerati(
      pianoGenerato,
      risultatoNutrizionale
    );
    console.log(`✅ Nuovi pasti salvati: ${nuoviPastiCreati}`);

    // 7.6: Crea relazioni piano-pasti
    console.log("🔄 Iniziando creazione relazioni piano-pasti...");
    await creaRelazioniPianoPasti(pianoId, pianoGenerato, mappaIdPasti);
    console.log("✅ Relazioni piano-pasti create");

    // 7.7 & 7.8: Genera embeddings per nuovi pasti
    console.log("🔄 Iniziando generazione embeddings...");
    await generaEmbeddingsNuoviPasti(mappaIdPasti, nuoviPastiCreati);
    console.log("✅ Embeddings generati");

    const endTime = Date.now();
    const relazioni_create = mappaIdPasti.size * 7; // Stima: ogni pasto x 7 giorni

    console.log(`🎉 FASE 7 COMPLETATA in ${endTime - startTime}ms`);
    console.log(`📋 Piano ID: ${pianoId}`);
    console.log(`🍽️ Nuovi pasti: ${nuoviPastiCreati}`);
    console.log(`🔗 Relazioni: ${relazioni_create}`);
    console.log(`🧠 Embeddings: ${nuoviPastiCreati}`);

    return {
      piano_id: pianoId,
      nuovi_pasti_creati: nuoviPastiCreati,
      relazioni_create,
      embeddings_generati: nuoviPastiCreati,
      riepilogo_settimanale: riepilogoSettimanale,
    };
  } catch (error) {
    console.error("❌ ERRORE FASE 7:", error);
    throw new Error(
      `Errore nella FASE 7 - Aggregazione e Salvataggio: ${error}`
    );
  }
}
