import { GeneraPianoRequest } from "@/types/genera-piano";

export function validateGeneraPianoRequest(body: any): string | null {
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
