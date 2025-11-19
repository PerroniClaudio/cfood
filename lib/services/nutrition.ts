import {
  ValoriNutrizionaliGiorno,
  RisultatoCalcoloNutrizionale,
} from "@/types/genera-piano";
import { analyzeNutritionBatch, creaPastoFallback } from "./bedrock";

export function estraiDescrizioniPasti(pianoGenerato: Record<string, unknown>): Array<{
  giorno: number;
  data: string;
  pasti: {
    colazione?: string;
    pranzo?: string;
    cena?: string;
  };
}> {
  try {
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

export async function calcolaValoriNutrizionaliPiano(
  pianoGenerato: Record<string, unknown>,
  sessionId: string
): Promise<RisultatoCalcoloNutrizionale> {
  const startTime = Date.now();
  console.log("🧮 Inizio FASE 6: Calcolo nutrizionale a posteriori...");

  const descrizioniPasti = estraiDescrizioniPasti(pianoGenerato);

  const tuttiIPasti: Array<{
    descrizione: string;
    tipo: "colazione" | "pranzo" | "cena";
    giorno: number;
    data: string;
  }> = [];

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

  const risultatiBatch = await analyzeNutritionBatch(tuttiIPasti, sessionId);

  const valoriGiornalieri: ValoriNutrizionaliGiorno[] = [];
  const pastiTotali = tuttiIPasti.length;
  let pastiCalcolatiAI = 0;
  let pastiStimati = 0;
  let pastiConErrore = 0;

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

    for (const [tipoPasto, descrizione] of Object.entries(giornoData.pasti)) {
      if (descrizione) {
        const chiave = `${giornoData.giorno}-${tipoPasto}`;
        const valoriPasto = risultatiBatch.get(chiave);

        if (valoriPasto) {
          valoriGiorno.pasti[tipoPasto as keyof typeof valoriGiorno.pasti] =
            valoriPasto;

          if (valoriPasto.fonte_calcolo === "bedrock_ai") {
            pastiCalcolatiAI++;
          } else {
            pastiStimati++;
          }

          if (valoriPasto.stato_calcolo === "errore") {
            pastiConErrore++;
          }
        } else {
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

    const calorieProteine = proteineTotali * 4;
    const calorieCarboidrati = carboidratiTotali * 4;
    const calorieGrassi = grassiTotali * 9;
    const calorieTotaliMacro =
      calorieProteine + calorieCarboidrati + calorieGrassi;

    valoriGiorno.totali_giorno = {
      calorie_totali_kcal: calorieTotali,
      proteine_totali_g: proteineTotali,
      carboidrati_totali_g: carboidratiTotali,
      grassi_totali_g: grassiTotali,
      percentuali_macro: {
        proteine_perc:
          calorieTotaliMacro > 0
            ? Math.round((calorieProteine / calorieTotaliMacro) * 100)
            : 0,
        carboidrati_perc:
          calorieTotaliMacro > 0
            ? Math.round((calorieCarboidrati / calorieTotaliMacro) * 100)
            : 0,
        grassi_perc:
          calorieTotaliMacro > 0
            ? Math.round((calorieGrassi / calorieTotaliMacro) * 100)
            : 0,
      },
    };

    valoriGiornalieri.push(valoriGiorno);
  }

  const calorieSettimana = valoriGiornalieri.reduce(
    (sum, g) => sum + g.totali_giorno.calorie_totali_kcal,
    0
  );
  const proteineSettimana = valoriGiornalieri.reduce(
    (sum, g) => sum + g.totali_giorno.proteine_totali_g,
    0
  );
  const carboidratiSettimana = valoriGiornalieri.reduce(
    (sum, g) => sum + g.totali_giorno.carboidrati_totali_g,
    0
  );
  const grassiSettimana = valoriGiornalieri.reduce(
    (sum, g) => sum + g.totali_giorno.grassi_totali_g,
    0
  );

  const calorieProteineSett = proteineSettimana * 4;
  const calorieCarboidratiSett = carboidratiSettimana * 4;
  const calorieGrassiSett = grassiSettimana * 9;
  const calorieTotaliMacroSett =
    calorieProteineSett + calorieCarboidratiSett + calorieGrassiSett;

  const endTime = Date.now();

  return {
    valori_giornalieri: valoriGiornalieri,
    riepilogo_settimanale: {
      calorie_totali_settimana: calorieSettimana,
      media_calorie_giorno: Math.round(calorieSettimana / 7),
      proteine_totali_settimana_g: proteineSettimana,
      carboidrati_totali_settimana_g: carboidratiSettimana,
      grassi_totali_settimana_g: grassiSettimana,
      distribuzione_macro_media: {
        proteine_perc:
          calorieTotaliMacroSett > 0
            ? Math.round((calorieProteineSett / calorieTotaliMacroSett) * 100)
            : 0,
        carboidrati_perc:
          calorieTotaliMacroSett > 0
            ? Math.round(
                (calorieCarboidratiSett / calorieTotaliMacroSett) * 100
              )
            : 0,
        grassi_perc:
          calorieTotaliMacroSett > 0
            ? Math.round((calorieGrassiSett / calorieTotaliMacroSett) * 100)
            : 0,
      },
      confronto_con_linee_guida: {
        calorie_range_consigliato: { min: 1800, max: 2400 },
        proteine_perc_consigliata: { min: 15, max: 25 },
        carboidrati_perc_consigliata: { min: 45, max: 60 },
        grassi_perc_consigliata: { min: 25, max: 35 },
        valutazione_bilanciamento: "ottimale",
      },
    },
    statistiche_calcolo: {
      pasti_totali_analizzati: pastiTotali,
      pasti_calcolati_ai: pastiCalcolatiAI,
      pasti_stimati_fallback: pastiStimati,
      pasti_con_errore: pastiConErrore,
      tempo_elaborazione_ms: endTime - startTime,
      modello_ai_utilizzato: "bedrock-claude-3-5-sonnet",
      chiamate_ai_totali: 1,
    },
  };
}
