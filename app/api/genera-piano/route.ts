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
    console.log("Analisi storica completata:", analisiStorica);

    // Risposta con analisi storica inclusa
    return NextResponse.json({
      success: true,
      message: "Analisi storica completata con successo!",
      parametri: {
        periodo_giorni,
        preferenze,
        esclusioni,
      },
      analisi_storica: analisiStorica,
      piano: {
        id: Math.random().toString(36).substr(2, 9),
        creato_il: new Date().toISOString(),
        giorni_totali: periodo_giorni,
        pasti_pianificati: periodo_giorni * 3, // colazione, pranzo, cena
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
