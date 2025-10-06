// Interfaccia per l'input della richiesta
export interface GeneraPianoRequest {
  periodo_giorni: number;
  preferenze?: string[];
  esclusioni?: string[];
}

// Interfacce per l'analisi storica
export interface AnalisiStorica {
  piani_recenti: PianoAlimentare[];
  statistiche_generali: StatisticheGenerali;
  top_pasti: TopPasto[];
  pattern_temporali: PatternTemporale[];
  preferenze_rilevate: PreferenzaRilevata[];
}

export interface PianoAlimentare {
  id: string;
  data_creazione: string;
  periodo_giorni: number;
  utente_id?: string;
}

export interface StatisticheGenerali {
  totale_piani: number;
  media_calorie_giornaliere: number;
  distribuzione_macro: {
    proteine_avg: number;
    carboidrati_avg: number;
    grassi_avg: number;
  };
  conteggio_pasti: {
    colazione: number;
    pranzo: number;
    cena: number;
  };
}

export interface TopPasto {
  pasto_id: string;
  nome_pasto: string;
  frequenza: number;
  tipo_pasto: "colazione" | "pranzo" | "cena";
}

export interface PatternTemporale {
  giorno_settimana: number;
  nome_giorno: string;
  media_calorie: number;
  media_proteine: number;
}

export interface PreferenzaRilevata {
  categoria: string;
  ingrediente: string;
  frequenza: number;
  percentuale: number;
}

// === INTERFACCE FASE 6: Calcolo Nutrizionale ===

// Valori nutrizionali calcolati per un singolo pasto
export interface ValoriNutrizionaliPasto {
  calorie_stimate: number;
  proteine_g: number;
  carboidrati_g: number;
  grassi_g: number;
  stato_calcolo: "calcolato" | "stimato" | "errore";
  fonte_calcolo: "bedrock_ai" | "fallback" | "database_esistente";
  descrizione_pasto: string;
  tipo_pasto: "colazione" | "pranzo" | "cena";
}

// Riepilogo nutrizionale per un giorno specifico
export interface ValoriNutrizionaliGiorno {
  giorno_numero: number;
  data_giorno: string;
  giorno_settimana: string;
  pasti: {
    colazione?: ValoriNutrizionaliPasto;
    pranzo?: ValoriNutrizionaliPasto;
    cena?: ValoriNutrizionaliPasto;
  };
  totali_giorno: {
    calorie_totali_kcal: number;
    proteine_totali_g: number;
    carboidrati_totali_g: number;
    grassi_totali_g: number;
    percentuali_macro: {
      proteine_perc: number;
      carboidrati_perc: number;
      grassi_perc: number;
    };
  };
}

// Riepilogo nutrizionale settimanale del piano
export interface RiepilogoNutrizionaleSettimanale {
  calorie_totali_settimana: number;
  media_calorie_giorno: number;
  proteine_totali_settimana_g: number;
  carboidrati_totali_settimana_g: number;
  grassi_totali_settimana_g: number;
  distribuzione_macro_media: {
    proteine_perc: number;
    carboidrati_perc: number;
    grassi_perc: number;
  };
  confronto_con_linee_guida: {
    calorie_range_consigliato: { min: number; max: number };
    proteine_perc_consigliata: { min: number; max: number };
    carboidrati_perc_consigliata: { min: number; max: number };
    grassi_perc_consigliata: { min: number; max: number };
    valutazione_bilanciamento: "ottimale" | "accettabile" | "da_migliorare";
  };
}

// Statistiche del processo di calcolo nutrizionale
export interface StatisticheCalcoloNutrizionale {
  pasti_totali_analizzati: number;
  pasti_calcolati_ai: number;
  pasti_stimati_fallback: number;
  pasti_con_errore: number;
  tempo_elaborazione_ms: number;
  modello_ai_utilizzato: string;
  chiamate_ai_totali: number;
  token_utilizzati_totali?: number;
}

// Risultato completo FASE 6
export interface RisultatoCalcoloNutrizionale {
  valori_giornalieri: ValoriNutrizionaliGiorno[];
  riepilogo_settimanale: RiepilogoNutrizionaleSettimanale;
  statistiche_calcolo: StatisticheCalcoloNutrizionale;
}
