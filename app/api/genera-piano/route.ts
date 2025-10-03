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

// Configurazione client AWS Bedrock
const bedrockClient = new BedrockRuntimeClient({
  region: "eu-central-1",
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
    .limit(10);

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
    .limit(10);

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

  // Step 4: Combinazione con pesi (0.7 frequenza + 0.3 similarità)
  const PESO_FREQUENZA = 0.7;
  const PESO_SIMILARITA = 0.3;

  // Mappa per combinare i risultati
  const pastiCombinati = new Map<number, any>();

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
      esistente.score_similarita = pasto.score_similarita;
      esistente.similarita = pasto.similarita;
      esistente.fonte = "entrambi";
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

    // Risposta con analisi storica e pasti raccomandati inclusi
    // Risposta con analisi storica e pasti raccomandati inclusi
    return NextResponse.json({
      success: true,
      message: "Analisi storica e retrieval ibrido completati con successo!",
      parametri: { periodo_giorni, preferenze, esclusioni },
      analisi_storica: analisiStorica,
      pasti_raccomandati: pastiRaccomandati,
      piano: {
        id: Math.random().toString(36).substr(2, 9),
        creato_il: new Date().toISOString(),
        giorni_totali: periodo_giorni,
        pasti_pianificati: periodo_giorni * 3, // colazione, pranzo, cena
        metodo_retrieval: "ibrido_frequenza_similarita",
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
function validateInput(body: any): string | null {
  // Controllo presenza periodo_giorni
  if (!body.periodo_giorni) {
    return "Il parametro periodo_giorni è obbligatorio";
  }

  // Controllo che sia un numero
  if (!Number.isInteger(body.periodo_giorni)) {
    return "Il parametro periodo_giorni deve essere un numero intero";
  }

  // Controllo range valido (minimo 7 giorni, massimo 365)
  if (body.periodo_giorni < 7) {
    return "Il periodo minimo è di 7 giorni";
  }

  if (body.periodo_giorni > 365) {
    return "Il periodo massimo è di 365 giorni";
  }

  // Validazione preferenze (opzionale)
  if (body.preferenze && !Array.isArray(body.preferenze)) {
    return "Le preferenze devono essere un array di stringhe";
  }

  // Validazione esclusioni (opzionale)
  if (body.esclusioni && !Array.isArray(body.esclusioni)) {
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
