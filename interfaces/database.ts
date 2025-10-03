// Interfacce per le tabelle del database

export interface PianiAlimentari {
  id: string;
  data_creazione: Date;
  periodo_giorni: number;
  utente_id?: string;
  stato: "attivo" | "completato" | "sospeso";
}

export interface Pasti {
  id: string;
  nome: string;
  descrizione?: string;
  tipo_pasto: "colazione" | "pranzo" | "cena";
  calorie: number;
  proteine: number;
  carboidrati: number;
  grassi: number;
}

export interface PianiPasti {
  id: string;
  piano_id: string;
  pasto_id: string;
  giorno_numero: number;
  tipo_pasto: "colazione" | "pranzo" | "cena";
}

export interface DettagliNutrizionaliGiornalieri {
  id: string;
  piano_id: string;
  giorno_numero: number;
  giorno_settimana: number;
  calorie_totali: number;
  proteine_totali: number;
  carboidrati_totali: number;
  grassi_totali: number;
  data_riferimento: Date;
}
