import { NextRequest, NextResponse } from "next/server";
import {
  GeneraPianoRequest,
  AnalisiStorica,
  StatisticheGenerali,
  PatternTemporale,
  PreferenzaRilevata,
  TopPasto,
  PastoRetrieval,
} from "@/types/genera-piano";
import { eseguiAnalisiStorica } from "@/lib/services/historical-analysis";
import { getRetrievalIbrido } from "@/lib/services/retrieval";
import { generateSessionId, generatePlan } from "@/lib/services/bedrock";
import { calcolaValoriNutrizionaliPiano } from "@/lib/services/nutrition";
import { eseguiSalvataggioPiano } from "@/lib/services/plan-management";

// ================================
// HELPER FUNCTIONS
// ================================

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

  const totalePasti =
    conteggio_pasti.colazione + conteggio_pasti.pranzo + conteggio_pasti.cena;

  const totaleMacro =
    distribuzione_macro.proteine_avg +
    distribuzione_macro.carboidrati_avg +
    distribuzione_macro.grassi_avg;

  let testo = `Analisi storica basata su ${totale_piani} piani alimentari:\n\n`;

  testo += `PROFILO NUTRIZIONALE:\n`;
  testo += `• Media calorica giornaliera: ${media_calorie_giornaliere} kcal\n`;

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

function formattaPatternTemporali(pattern: PatternTemporale[]): string {
  if (pattern.length === 0) {
    return "Nessun pattern temporale identificato.";
  }

  const mediaGeneraleCalorie =
    pattern.reduce((sum, p) => sum + p.media_calorie, 0) / pattern.length;
  const mediaGeneraleProteine =
    pattern.reduce((sum, p) => sum + p.media_proteine, 0) / pattern.length;

  let testo = `PATTERN SETTIMANALI:\n`;

  pattern.forEach((p) => {
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

function formattaPreferenzeRilevate(preferenze: PreferenzaRilevata[]): string {
  if (preferenze.length === 0) {
    return "Nessuna preferenza alimentare specifica rilevata.";
  }

  const totaleFrequenze = preferenze.reduce((sum, p) => sum + p.frequenza, 0);

  let testo = `PREFERENZE ALIMENTARI RILEVATE:\n`;

  preferenze.forEach((p) => {
    const percentuale =
      totaleFrequenze > 0
        ? Math.round((p.frequenza / totaleFrequenze) * 100)
        : 0;

    const ingredienteFormatted =
      p.ingrediente.charAt(0).toUpperCase() + p.ingrediente.slice(1);

    testo += `• ${ingredienteFormatted}: ${p.frequenza} occorrenze (${percentuale}%)\n`;
  });

  return testo;
}

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

function formattaTopPastiSimilarita(pasti: PastoRetrieval[]): string {
  if (pasti.length === 0) {
    return "Nessun pasto semanticamente rilevante trovato.";
  }

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

function assemblaContestoRAG(
  analisiStorica: AnalisiStorica,
  pastiRaccomandati: PastoRetrieval[]
): string {
  let contesto = "=== CONTESTO PER GENERAZIONE PIANO ALIMENTARE ===\n\n";

  contesto += formattaStatisticheStoriche(analisiStorica.statistiche_generali);
  contesto += "\n";

  contesto += formattaPatternTemporali(analisiStorica.pattern_temporali);
  contesto += "\n";

  contesto += formattaPreferenzeRilevate(analisiStorica.preferenze_rilevate);
  contesto += "\n";

  contesto += formattaTopPastiFrequenza(analisiStorica.top_pasti);
  contesto += "\n";

  contesto += formattaTopPastiSimilarita(pastiRaccomandati);
  contesto += "\n";

  contesto += "=== FINE CONTESTO ===";

  if (contesto.length > 16000) {
    console.warn(`Contesto RAG troppo lungo: ${contesto.length} caratteri`);
  }

  return contesto;
}

function validateInput(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Corpo della richiesta non valido";
  }

  const bodyObj = body as Record<string, unknown>;

  if (!bodyObj.periodo_giorni) {
    return "Il parametro periodo_giorni è obbligatorio";
  }

  if (!Number.isInteger(bodyObj.periodo_giorni)) {
    return "Il parametro periodo_giorni deve essere un numero intero";
  }

  if ((bodyObj.periodo_giorni as number) < 7) {
    return "Il periodo minimo è di 7 giorni";
  }

  if ((bodyObj.periodo_giorni as number) > 365) {
    return "Il periodo massimo è di 365 giorni";
  }

  if (bodyObj.preferenze && !Array.isArray(bodyObj.preferenze)) {
    return "Le preferenze devono essere un array di stringhe";
  }

  if (bodyObj.esclusioni && !Array.isArray(bodyObj.esclusioni)) {
    return "Le esclusioni devono essere un array di stringhe";
  }

  return null;
}

// ================================
// API ROUTE HANDLER
// ================================

export async function POST(req: NextRequest) {
  const sessionId = generateSessionId();
  console.log(`🚀 Nuova richiesta generazione piano - SessionID: ${sessionId}`);

  try {
    const body = await req.json();

    const validationError = validateInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const requestData: GeneraPianoRequest = body;
    const { periodo_giorni, preferenze = [], esclusioni = [] } = requestData;

    // FASE 2: Analisi Storica
    console.log("📊 FASE 2: Analisi Storica...");
    const analisiStorica = await eseguiAnalisiStorica(periodo_giorni);

    // FASE 3: Retrieval Ibrido
    console.log("🔍 FASE 3: Retrieval Ibrido...");
    const pastiRaccomandati = await getRetrievalIbrido(
      preferenze,
      esclusioni,
      periodo_giorni
    );

    // FASE 4: Costruzione Contesto RAG
    console.log("📝 FASE 4: Costruzione Contesto RAG...");
    const contestoRAG = assemblaContestoRAG(analisiStorica, pastiRaccomandati);

    // FASE 5: Generazione Piano con Bedrock
    console.log("🤖 FASE 5: Generazione Piano con Bedrock...");
    const { piano_generato, metadata_chiamata } = await generatePlan(
      contestoRAG,
      preferenze,
      esclusioni,
      sessionId
    );

    // FASE 6: Calcolo Nutrizionale
    console.log("🧮 FASE 6: Calcolo Nutrizionale...");
    const risultatoNutrizionale = await calcolaValoriNutrizionaliPiano(
      piano_generato,
      sessionId
    );

    // FASE 7: Aggregazione e Salvataggio
    console.log("💾 FASE 7: Aggregazione e Salvataggio...");
    const risultatoSalvataggio = await eseguiSalvataggioPiano(
      piano_generato,
      risultatoNutrizionale,
      analisiStorica,
      periodo_giorni
    );

    return NextResponse.json({
      success: true,
      message: "Piano alimentare generato con successo",
      piano_id: risultatoSalvataggio.piano_id,
      dati_generati: {
        piano: piano_generato,
        nutrizionali: risultatoNutrizionale,
        riepilogo: risultatoSalvataggio.riepilogo_settimanale,
      },
      metadata: {
        session_id: sessionId,
        tempo_totale_ms: 0, // TODO: Calcolare tempo totale
        fasi_completate: [
          "analisi_storica",
          "retrieval_ibrido",
          "generazione_ai",
          "calcolo_nutrizionale",
          "salvataggio_db",
        ],
        bedrock_usage: metadata_chiamata,
        stats_salvataggio: {
          nuovi_pasti: risultatoSalvataggio.nuovi_pasti_creati,
          relazioni: risultatoSalvataggio.relazioni_create,
          embeddings: risultatoSalvataggio.embeddings_generati,
        },
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

export async function GET() {
  return NextResponse.json(
    { error: "Metodo non supportato. Usa POST." },
    { status: 405 }
  );
}
