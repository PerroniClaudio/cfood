import { db } from "@/db";
import {
  pianiAlimentari,
  dettagliNutrizionaliGiornalieri,
  pasti,
  pianiPasti,
} from "@/db/schema";
import {
  AnalisiStorica,
  RisultatoCalcoloNutrizionale,
  ValoriNutrizionaliGiorno,
  RiepilogoNutrizionaleSettimanale,
  ValoriNutrizionaliPasto,
} from "@/types/genera-piano";
import { inArray, eq, sql } from "drizzle-orm";
import { generateEmbeddingForText } from "./bedrock";
import { estraiDescrizioniPasti } from "./nutrition";

// ==========================================
// FASE 7: AGGREGAZIONE E SALVATAGGIO
// ==========================================

function calcolaTotaliGiornalieri(
  risultatoNutrizionale: RisultatoCalcoloNutrizionale
): ValoriNutrizionaliGiorno[] {
  return risultatoNutrizionale.valori_giornalieri.map((giorno) => {
    const { colazione, pranzo, cena } = giorno.pasti;

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

function valutaBilanciamento(
  calorieGiornaliere: number,
  macro: {
    proteine_perc: number;
    carboidrati_perc: number;
    grassi_perc: number;
  }
): "ottimale" | "accettabile" | "da_migliorare" {
  const calorieOk = calorieGiornaliere >= 1800 && calorieGiornaliere <= 2500;
  const proteineOk = macro.proteine_perc >= 15 && macro.proteine_perc <= 30;
  const carboidratiOk =
    macro.carboidrati_perc >= 45 && macro.carboidrati_perc <= 65;
  const grassiOk = macro.grassi_perc >= 20 && macro.grassi_perc <= 35;

  if (calorieOk && proteineOk && carboidratiOk && grassiOk) {
    return "ottimale";
  }

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

function calcolaTotaliSettimanali(
  giorniConTotali: ValoriNutrizionaliGiorno[]
): RiepilogoNutrizionaleSettimanale {
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

  const media_calorie_giorno = Math.round(calorie_totali_settimana / 7);

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

async function salvaPianoPrincipale(
  periodoGiorni: number,
  analisiStorica: AnalisiStorica
): Promise<number> {
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

  const [pianoCeato] = await db
    .insert(pianiAlimentari)
    .values({
      nome: nomePiano,
      descrizione: descrizione,
      autore: "Sistema AI",
    })
    .returning({ id: pianiAlimentari.id });

  return pianoCeato.id;
}

async function salvaDettagliNutrizionaliGiornalieri(
  pianoId: number,
  giorniConTotali: ValoriNutrizionaliGiorno[]
): Promise<void> {
  const dettagliDaInserire = giorniConTotali.map((giorno) => ({
    pianoId,
    giornoSettimana: giorno.giorno_settimana,
    proteineTotaliG: giorno.totali_giorno.proteine_totali_g,
    carboidratiTotaliG: giorno.totali_giorno.carboidrati_totali_g,
    grassiTotaliG: giorno.totali_giorno.grassi_totali_g,
    calorieTotaliKcal: giorno.totali_giorno.calorie_totali_kcal,
  }));

  await db.insert(dettagliNutrizionaliGiornalieri).values(dettagliDaInserire);
}

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

async function salvaNuoviPastiGenerati(
  pianoGenerato: Record<string, unknown>,
  risultatoNutrizionale: RisultatoCalcoloNutrizionale
): Promise<{ nuoviPastiCreati: number; mappaIdPasti: Map<string, number> }> {
  const mappaIdPasti = new Map<string, number>();
  let nuoviPastiCreati = 0;

  const descrizioniPasti = estraiDescrizioniPasti(pianoGenerato);
  const descrizioniUniche = new Set<string>();

  descrizioniPasti.forEach((giorno) => {
    if (giorno.pasti.colazione) descrizioniUniche.add(giorno.pasti.colazione);
    if (giorno.pasti.pranzo) descrizioniUniche.add(giorno.pasti.pranzo);
    if (giorno.pasti.cena) descrizioniUniche.add(giorno.pasti.cena);
  });

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

  const nuoveDescrizioni = descrizioniArray.filter(
    (desc) => !mappaEsistenti.has(desc)
  );

  for (const descrizione of nuoveDescrizioni) {
    const valoriNutrizionali = trovaNutrizionaliPerDescrizione(
      descrizione,
      risultatoNutrizionale
    );

    if (!valoriNutrizionali) {
      console.warn(`⚠️ Valori nutrizionali non trovati per: ${descrizione}`);
      continue;
    }

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
      })
      .returning({ id: pasti.id });

    mappaIdPasti.set(descrizione, pastoCreato.id);
    nuoviPastiCreati++;
  }

  pastiEsistenti.forEach((pasto) => {
    mappaIdPasti.set(pasto.descrizione, pasto.id);
  });

  return { nuoviPastiCreati, mappaIdPasti };
}

async function creaRelazioniPianoPasti(
  pianoId: number,
  pianoGenerato: Record<string, unknown>,
  mappaIdPasti: Map<string, number>
): Promise<number> {
  const relazioniDaInserire: Array<{
    pianoId: number;
    pastoId: number;
    giornoSettimana: string;
    ordineNelGiorno: number;
  }> = [];

  const descrizioniPasti = estraiDescrizioniPasti(pianoGenerato);

  const ordiniPasti = {
    colazione: 1,
    pranzo: 2,
    cena: 3,
  };

  const nomiGiorni = [
    "Lunedì",
    "Martedì",
    "Mercoledì",
    "Giovedì",
    "Venerdì",
    "Sabato",
    "Domenica",
  ];

  for (const giorno of descrizioniPasti) {
    const nomeGiorno = nomiGiorni[giorno.giorno - 1];

    for (const [tipoPasto, descrizione] of Object.entries(giorno.pasti)) {
      if (descrizione) {
        const pastoId = mappaIdPasti.get(descrizione);

        if (pastoId) {
          relazioniDaInserire.push({
            pianoId,
            pastoId,
            giornoSettimana: nomeGiorno,
            ordineNelGiorno: ordiniPasti[tipoPasto as keyof typeof ordiniPasti],
          });
        }
      }
    }
  }

  if (relazioniDaInserire.length > 0) {
    await db.insert(pianiPasti).values(relazioniDaInserire);
  }

  return relazioniDaInserire.length;
}

async function generaEmbeddingsNuoviPasti(
  mappaIdPasti: Map<string, number>,
  nuoviPastiCreati: number
): Promise<number> {
  if (nuoviPastiCreati === 0) {
    return 0;
  }

  let embeddingsGenerati = 0;

  const pastiSenzaEmbedding = await db
    .select({
      id: pasti.id,
      descrizione: pasti.descrizioneDettagliata,
    })
    .from(pasti)
    .where(sql`${pasti.embedding} IS NULL`)
    .limit(nuoviPastiCreati + 10);

  for (const pasto of pastiSenzaEmbedding) {
    if (mappaIdPasti.has(pasto.descrizione)) {
      try {
        const embedding = await generateEmbeddingForText(pasto.descrizione);

        await db
          .update(pasti)
          .set({
            embedding: embedding,
          })
          .where(eq(pasti.id, pasto.id));

        embeddingsGenerati++;

        if (embeddingsGenerati < pastiSenzaEmbedding.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (embeddingError) {
        console.error(
          `❌ Errore embedding pasto ID ${pasto.id}:`,
          embeddingError
        );
      }
    }
  }

  return embeddingsGenerati;
}

export async function eseguiSalvataggioPiano(
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
    const giorniConTotali = calcolaTotaliGiornalieri(risultatoNutrizionale);
    const riepilogoSettimanale = calcolaTotaliSettimanali(giorniConTotali);

    console.log("🔄 Iniziando salvataggio piano principale...");
    const pianoId = await salvaPianoPrincipale(periodoGiorni, analisiStorica);
    console.log(`✅ Piano principale salvato con ID: ${pianoId}`);

    console.log("🔄 Iniziando salvataggio dettagli nutrizionali...");
    await salvaDettagliNutrizionaliGiornalieri(pianoId, giorniConTotali);

    console.log("🔄 Iniziando salvataggio nuovi pasti...");
    const { nuoviPastiCreati, mappaIdPasti } = await salvaNuoviPastiGenerati(
      pianoGenerato,
      risultatoNutrizionale
    );

    console.log("🔄 Iniziando creazione relazioni piano-pasti...");
    const relazioni_create = await creaRelazioniPianoPasti(
      pianoId,
      pianoGenerato,
      mappaIdPasti
    );

    console.log("🔄 Iniziando generazione embeddings...");
    const embeddings_generati = await generaEmbeddingsNuoviPasti(
      mappaIdPasti,
      nuoviPastiCreati
    );

    const endTime = Date.now();

    console.log(`🎉 FASE 7 COMPLETATA in ${endTime - startTime}ms`);

    return {
      piano_id: pianoId,
      nuovi_pasti_creati: nuoviPastiCreati,
      relazioni_create,
      embeddings_generati,
      riepilogo_settimanale: riepilogoSettimanale,
    };
  } catch (error) {
    console.error("❌ ERRORE FASE 7:", error);
    throw new Error(
      `Errore nella FASE 7 - Aggregazione e Salvataggio: ${error}`
    );
  }
}
