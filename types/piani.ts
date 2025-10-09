// Tipi condivisi per le API / UI relative ai piani

export type PianoRow = {
  id: number;
  nome: string;
  descrizione?: string | null;
  dataCreazione?: string | null;
};

export type GiornoView = {
  giorno?: string;
  data?: string;
  calorie?: number;
  proteine?: number;
  carboidrati?: number;
  grassi?: number;
};

export type ApiGiorno = {
  giornoSettimana?: string;
  calorieTotaliKcal?: number;
  proteineTotaliG?: number;
  carboidratiTotaliG?: number;
  grassiTotaliG?: number;
};

export type PastoSanitized = {
  id: number;
  tipoPasto: string;
  descrizioneDettagliata: string;
  noteAggiuntive?: string | null;
  calorieStimate?: number | null;
  proteineG?: number | null;
  carboidratiG?: number | null;
  grassiG?: number | null;
};

export type DettagliResponse = {
  piano: PianoRow | Record<string, unknown>;
  giornali: Array<Record<string, unknown>>;
  relazioni: Array<Record<string, unknown>>;
  pasti: PastoSanitized[];
  giorni: GiornoView[];
} | null;

export type ApiListaResponse = {
  success: boolean;
  lista: PianoRow[];
  ultimo: DettagliResponse;
};
