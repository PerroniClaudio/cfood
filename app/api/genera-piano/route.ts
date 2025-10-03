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
} from "@/types/genera-piano";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { buildPromptPianoAlimentare } from "@/prompts";

// ================================
// CONFIGURAZIONE E COSTANTI
// ================================

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
  MAX_TOKENS_OUTPUT: 8000,
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
    lunedi: { numero: 1, nome: "Lunedì" },
    martedi: { numero: 2, nome: "Martedì" },
    mercoledi: { numero: 3, nome: "Mercoledì" },
    giovedi: { numero: 4, nome: "Giovedì" },
    venerdi: { numero: 5, nome: "Venerdì" },
    sabato: { numero: 6, nome: "Sabato" },
    domenica: { numero: 0, nome: "Domenica" },
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
  esclusioni: string[]
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

    console.log(`🤖 Chiamata Bedrock - Modello: ${modello}`);
    console.log(
      `📝 Prompt: ${prompt.length} caratteri (${tokenInputStimati} token stimati)`
    );

    // Configurazione chiamata Bedrock per Claude
    // Per Claude 3.7 Sonnet potrebbe essere necessario un inference profile
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
    const contenutoRisposta = responseBody.content[0].text;
    const tokenOutput =
      responseBody.usage?.output_tokens ||
      Math.ceil(contenutoRisposta.length / 4);

    console.log(`✅ Risposta ricevuta: ${contenutoRisposta.length} caratteri`);
    console.log(
      `📊 Token utilizzati: ${tokenInputStimati} input + ${tokenOutput} output`
    );

    // Parsing e validazione JSON
    let pianoGenerato;
    try {
      // Rimuovi eventuali markdown wrapper
      const jsonString = contenutoRisposta
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
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
        modello_utilizzato: modelIdToUse, // Usa il modello effettivamente chiamato
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

export async function POST(request: NextRequest) {
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
      esclusioni
    );
    console.log(
      `✅ Piano generato con successo in ${risultatoGenerazione.metadata_chiamata.tempo_elaborazione_ms}ms`
    );

    // Preparazione dati per risposta strutturata
    const timestamp = new Date().toISOString();
    const pianoId = Math.random().toString(36).substr(2, 9);

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
      fase_completata: "FASE_5_PIANO_GENERATO",

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
          "✅ Pipeline completa: Piano alimentare generato con successo!",
        fasi_completate: [
          "FASE_2: Analisi storica dei dati",
          "FASE_3: Retrieval ibrido (frequenza + similarità)",
          "FASE_4: Costruzione contesto RAG",
          "FASE_5: Generazione piano con Bedrock",
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
