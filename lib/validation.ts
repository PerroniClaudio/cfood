export function validateGeneraPianoRequest(body: unknown): string | null {
  // Type guard per verificare che body sia un oggetto
  if (!body || typeof body !== "object") {
    return "Corpo della richiesta non valido";
  }

  const bodyObj = body as Record<string, unknown>;

  // Controllo presenza periodo_giorni
  if (!bodyObj.periodo_giorni) {
    return "Il parametro periodo_giorni è obbligatorio";
  }

  // Controllo che sia un numero
  if (!Number.isInteger(bodyObj.periodo_giorni)) {
    return "Il parametro periodo_giorni deve essere un numero intero";
  }

  // Controllo range valido (minimo 7 giorni, massimo 365)
  if ((bodyObj.periodo_giorni as number) < 7) {
    return "Il periodo minimo è di 7 giorni";
  }

  if ((bodyObj.periodo_giorni as number) > 365) {
    return "Il periodo massimo è di 365 giorni";
  }

  // Validazione preferenze (opzionale)
  if (bodyObj.preferenze && !Array.isArray(bodyObj.preferenze)) {
    return "Le preferenze devono essere un array di stringhe";
  }

  // Validazione esclusioni (opzionale)
  if (bodyObj.esclusioni && !Array.isArray(bodyObj.esclusioni)) {
    return "Le esclusioni devono essere un array di stringhe";
  }

  return null; // Input valido
}
