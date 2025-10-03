import fs from "fs";
import path from "path";

/**
 * Legge un file di prompt Markdown e sostituisce le variabili template
 */
export function loadPromptTemplate(
  promptFileName: string,
  variables: Record<string, string>
): string {
  try {
    // Leggi il file prompt dalla cartella prompts
    const promptPath = path.join(process.cwd(), "prompts", promptFileName);
    let promptContent = fs.readFileSync(promptPath, "utf-8");

    // Sostituisci tutte le variabili nel formato {{variabile}}
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      promptContent = promptContent.replaceAll(placeholder, value);
    });

    return promptContent;
  } catch (error) {
    console.error(
      `Errore nel caricamento del prompt ${promptFileName}:`,
      error
    );
    throw new Error(
      `Impossibile caricare il prompt template: ${promptFileName}`
    );
  }
}

/**
 * Costruisce il prompt per la generazione del piano alimentare
 */
export function buildPromptPianoAlimentare(
  contestoRAG: string,
  preferenze: string[],
  esclusioni: string[]
): string {
  const dataInizio = new Date();
  const dataInizioFormatted = dataInizio.toISOString().split("T")[0];

  const variables = {
    dataInizio: dataInizioFormatted,
    preferenze:
      preferenze.length > 0
        ? preferenze.join(", ")
        : "Nessuna preferenza specificata",
    esclusioni:
      esclusioni.length > 0 ? esclusioni.join(", ") : "Nessuna esclusione",
    contestoRAG: contestoRAG,
  };

  return loadPromptTemplate("piano-alimentare.md", variables);
}

/**
 * Lista tutti i prompt disponibili nella cartella prompts
 */
export function getAvailablePrompts(): string[] {
  try {
    const promptsDir = path.join(process.cwd(), "prompts");
    return fs
      .readdirSync(promptsDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.replace(".md", ""));
  } catch (error) {
    console.error("Errore nel listare i prompt disponibili:", error);
    return [];
  }
}

/**
 * Valida che un prompt contenga tutte le variabili richieste
 */
export function validatePromptTemplate(
  promptFileName: string,
  requiredVariables: string[]
): boolean {
  try {
    const promptPath = path.join(process.cwd(), "prompts", promptFileName);
    const promptContent = fs.readFileSync(promptPath, "utf-8");

    // Controlla che tutte le variabili richieste siano presenti
    return requiredVariables.every((variable) =>
      promptContent.includes(`{{${variable}}}`)
    );
  } catch (error) {
    console.error(
      `Errore nella validazione del prompt ${promptFileName}:`,
      error
    );
    return false;
  }
}
