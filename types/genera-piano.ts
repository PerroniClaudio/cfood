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
