import { db } from "@/db";
import {
  pianiAlimentari,
  pasti,
  pianiPasti,
  dettagliNutrizionaliGiornalieri,
} from "@/db/schema";
import { gte, desc, count, avg, eq, inArray } from "drizzle-orm";
import {
  AnalisiStorica,
  PianoAlimentare,
  StatisticheGenerali,
  TopPasto,
  PatternTemporale,
  PreferenzaRilevata,
} from "@/types/genera-piano";

const CONFIG = {
  LIMITE_TOP_PASTI: 10,
} as const;

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
    .orderBy(desc(pianiAlimentari.id));

  return result.map((row) => row.id);
}

export async function getPianiRecenti(
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
    .orderBy(desc(pianiAlimentari.id));

  return result.map((row) => ({
    id: row.id.toString(),
    data_creazione: row.dataCreazione || new Date().toISOString().split("T")[0],
    periodo_giorni: 7,
    utente_id: row.autore,
  }));
}

export async function getStatisticheGenerali(
  periodoIntervallo: number
): Promise<StatisticheGenerali> {
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

  const nutrizionali = await db
    .select({
      mediaCalorie: avg(dettagliNutrizionaliGiornalieri.calorieTotaliKcal),
      mediaProteine: avg(dettagliNutrizionaliGiornalieri.proteineTotaliG),
      mediaCarboidrati: avg(dettagliNutrizionaliGiornalieri.carboidratiTotaliG),
      mediaGrassi: avg(dettagliNutrizionaliGiornalieri.grassiTotaliG),
    })
    .from(dettagliNutrizionaliGiornalieri)
    .where(inArray(dettagliNutrizionaliGiornalieri.pianoId, pianiRecentiIds));

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

export async function getTopPasti(
  periodoIntervallo: number
): Promise<TopPasto[]> {
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

export async function getPatternTemporali(
  periodoIntervallo: number
): Promise<PatternTemporale[]> {
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

  const mappaGiorni: { [key: string]: { numero: number; nome: string } } = {
    lunedì: { numero: 1, nome: "Lunedì" },
    martedì: { numero: 2, nome: "Martedì" },
    mercoledì: { numero: 3, nome: "Mercoledì" },
    giovedì: { numero: 4, nome: "Giovedì" },
    venerdì: { numero: 5, nome: "Venerdì" },
    sabato: { numero: 6, nome: "Sabato" },
    domenica: { numero: 0, nome: "Domenica" },
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

export async function getPreferenzeRilevate(
  periodoIntervallo: number
): Promise<PreferenzaRilevata[]> {
  const pianiRecentiIds = await getPianiRecentiIds(periodoIntervallo);

  if (pianiRecentiIds.length === 0) {
    return [];
  }

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
        percentuale: 0,
      };
    })
    .filter((item) => item.ingrediente !== "altro");
}

export async function eseguiAnalisiStorica(
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
