import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  buildPromptPianoAlimentare,
  buildPromptAnalisiNutrizionaleBatch,
} from "@/prompts";
import { ValoriNutrizionaliPasto } from "@/types/genera-piano";
import fs from "fs";
import path from "path";

// ================================
// CONFIGURAZIONE E COSTANTI
// ================================

const LOGS_DIR = path.join(process.cwd(), "logs");

// Parametri LLM
const CONFIG = {
  MAX_TOKENS_OUTPUT: 80000,
  TEMPERATURE_LLM: 0.7,
} as const;

// Configurazione client AWS Bedrock
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ================================
// HELPER FUNCTIONS
// ================================

function ensureLogsDirectory() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function saveBedrockResponse(
  type: "piano" | "nutrizionale_batch" | "nutrizionale_single" | "embedding",
  sessionId: string,
  prompt: string,
  response: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    ensureLogsDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${timestamp}_${type}_${sessionId.substring(0, 8)}.json`;
    const logPath = path.join(LOGS_DIR, filename);

    const logData = {
      timestamp: new Date().toISOString(),
      type,
      sessionId,
      metadata,
      prompt: prompt.substring(0, 1000) + (prompt.length > 1000 ? "..." : ""), // Truncate for space
      response,
    };

    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
    console.log(`💾 Bedrock response saved: ${filename}`);
  } catch (error) {
    console.warn(`⚠️ Failed to save Bedrock response:`, error);
  }
}

function loadBedrockResponse(
  type: "piano" | "nutrizionale_batch" | "nutrizionale_single" | "embedding",
  sessionId: string
): string | null {
  try {
    ensureLogsDirectory();

    const files = fs.readdirSync(LOGS_DIR);
    const logFile = files
      .filter((f) => f.includes(`_${type}_${sessionId.substring(0, 8)}`))
      .sort()
      .pop(); // Get most recent

    if (logFile) {
      const logPath = path.join(LOGS_DIR, logFile);
      const logData = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      console.log(`📁 Loaded cached Bedrock response: ${logFile}`);
      return logData.response;
    }

    return null;
  } catch (error) {
    console.warn(`⚠️ Failed to load cached Bedrock response:`, error);
    return null;
  }
}

export function generateSessionId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2);
}

const getBedrockModel = (): string => {
  const modelFromEnv = process.env.AWS_BEDROCK_MODEL;
  if (!modelFromEnv) {
    throw new Error("Variabile d'ambiente AWS_BEDROCK_MODEL non configurata!");
  }
  return modelFromEnv;
};

// ================================
// EXPORTED SERVICES
// ================================

export async function generateEmbedding(
  preferenze: string[],
  esclusioni: string[]
): Promise<number[]> {
  let queryText = "Crea piano alimentare bilanciato basato sulle mie abitudini";

  if (preferenze.length > 0) {
    queryText += `. Preferenze: ${preferenze.join(", ")}`;
  }

  if (esclusioni.length > 0) {
    queryText += `. Escludere: ${esclusioni.join(", ")}`;
  }

  try {
    const command = new InvokeModelCommand({
      modelId: "amazon.titan-embed-text-v2:0",
      body: JSON.stringify({
        inputText: queryText,
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return responseBody.embedding;
  } catch (error) {
    console.error("Errore nella generazione embedding:", error);
    return new Array(1024).fill(0);
  }
}

export async function generateEmbeddingForText(text: string): Promise<number[]> {
  try {
    const command = new InvokeModelCommand({
      modelId: "amazon.titan-embed-text-v2:0",
      body: JSON.stringify({
        inputText: text,
        dimensions: 1024,
        normalize: true,
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return responseBody.embedding;
  } catch (error) {
    console.error("Errore nella generazione embedding testo:", error);
    throw error;
  }
}

export async function generatePlan(
  contestoRAG: string,
  preferenze: string[],
  esclusioni: string[],
  sessionId: string
): Promise<{
  piano_generato: Record<string, unknown>;
  metadata_chiamata: {
    modello_utilizzato: string;
    modello_configurato: string;
    lunghezza_prompt: number;
    token_input_stimati: number;
    token_output_ricevuti: number;
    tempo_elaborazione_ms: number;
  };
}> {
  const startTime = Date.now();
  const modello = getBedrockModel();

  try {
    const prompt = buildPromptPianoAlimentare(
      contestoRAG,
      preferenze,
      esclusioni
    );
    const tokenInputStimati = Math.ceil(prompt.length / 4);

    console.log(`💾 Checking cache for session ${sessionId}...`);
    const cachedResponse = loadBedrockResponse("piano", sessionId);

    let contenutoRisposta: string;
    let tokenOutput: number;

    if (cachedResponse) {
      console.log("✅ Using cached Bedrock response!");
      contenutoRisposta = cachedResponse;
      tokenOutput = Math.ceil(contenutoRisposta.length / 4);
    } else {
      console.log(`🤖 Chiamata Bedrock - Modello: ${modello}`);
      console.log(
        `📝 Prompt: ${prompt.length} caratteri (${tokenInputStimati} token stimati)`
      );

      const command = new InvokeModelCommand({
        modelId: modello,
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: CONFIG.MAX_TOKENS_OUTPUT,
          temperature: CONFIG.TEMPERATURE_LLM,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      console.log("🚀 Invio richiesta a Bedrock...");
      const response = await bedrockClient.send(command);

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      contenutoRisposta = responseBody.content[0].text;
      tokenOutput =
        responseBody.usage?.output_tokens ||
        Math.ceil(contenutoRisposta.length / 4);

      saveBedrockResponse("piano", sessionId, prompt, contenutoRisposta, {
        modello,
        tokenInputStimati,
        tokenOutput,
        preferenze,
        esclusioni,
      });
    }

    console.log(`✅ Risposta ricevuta: ${contenutoRisposta.length} caratteri`);

    let pianoGenerato;
    try {
      let jsonString = contenutoRisposta.trim();
      if (jsonString.startsWith("```json\n")) {
        jsonString = jsonString.substring(8);
      } else if (jsonString.startsWith("```json")) {
        jsonString = jsonString.substring(7);
      }
      if (jsonString.endsWith("\n```")) {
        jsonString = jsonString.substring(0, jsonString.length - 4);
      } else if (jsonString.endsWith("```")) {
        jsonString = jsonString.substring(0, jsonString.length - 3);
      }
      jsonString = jsonString.trim();

      pianoGenerato = JSON.parse(jsonString);

      if (!pianoGenerato.piano_alimentare) {
        throw new Error("Struttura JSON non valida: manca 'piano_alimentare'");
      }
      if (
        !pianoGenerato.piano_alimentare.giorni ||
        !Array.isArray(pianoGenerato.piano_alimentare.giorni)
      ) {
        throw new Error("Struttura JSON non valida: manca 'giorni' array");
      }
      if (pianoGenerato.piano_alimentare.giorni.length !== 7) {
        throw new Error(
          `Piano deve avere 7 giorni, ricevuti: ${pianoGenerato.piano_alimentare.giorni.length}`
        );
      }
    } catch (parseError) {
      console.error("❌ Errore parsing JSON:", parseError);
      throw new Error(
        `Errore parsing JSON dalla risposta LLM: ${
          parseError instanceof Error
            ? parseError.message
            : "Errore sconosciuto"
        }`
      );
    }

    const endTime = Date.now();

    return {
      piano_generato: pianoGenerato,
      metadata_chiamata: {
        modello_utilizzato: modello,
        modello_configurato: modello,
        lunghezza_prompt: prompt.length,
        token_input_stimati: tokenInputStimati,
        token_output_ricevuti: tokenOutput,
        tempo_elaborazione_ms: endTime - startTime,
      },
    };
  } catch (error) {
    console.error("❌ Errore nella chiamata Bedrock:", error);
    throw new Error(
      `Errore generazione piano con Bedrock: ${
        error instanceof Error ? error.message : "Errore sconosciuto"
      }`
    );
  }
}

export function creaPastoFallback(
  descrizione: string,
  tipo: "colazione" | "pranzo" | "cena"
): ValoriNutrizionaliPasto {
  const calorieMedie = {
    colazione: 350,
    pranzo: 600,
    cena: 550,
  };

  const calorie = calorieMedie[tipo];
  const proteine = Math.round((calorie * 0.2) / 4);
  const carboidrati = Math.round((calorie * 0.5) / 4);
  const grassi = Math.round((calorie * 0.3) / 9);

  return {
    descrizione_pasto: descrizione,
    tipo_pasto: tipo,
    calorie_stimate: calorie,
    proteine_g: proteine,
    carboidrati_g: carboidrati,
    grassi_g: grassi,
    fonte_calcolo: "fallback",
    stato_calcolo: "stimato",
  };
}

export async function analyzeNutritionBatch(
  pastiDaAnalizzare: Array<{
    descrizione: string;
    tipo: "colazione" | "pranzo" | "cena";
    giorno: number;
    data: string;
  }>,
  sessionId: string
): Promise<Map<string, ValoriNutrizionaliPasto>> {
  const modello = getBedrockModel();
  const risultati = new Map<string, ValoriNutrizionaliPasto>();

  try {
    const promptBatch = buildPromptAnalisiNutrizionaleBatch(pastiDaAnalizzare);

    console.log(
      `💾 Checking cache for nutritional batch session ${sessionId}...`
    );
    const cachedResponse = loadBedrockResponse("nutrizionale_batch", sessionId);

    let contenutoRisposta: string;

    if (cachedResponse) {
      console.log("✅ Using cached nutritional batch response!");
      contenutoRisposta = cachedResponse;
    } else {
      console.log(
        `🧮 Calcolo nutrizionale BATCH per ${pastiDaAnalizzare.length} pasti...`
      );

      const command = new InvokeModelCommand({
        modelId: modello,
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 8000,
          temperature: 0.3,
          messages: [
            {
              role: "user",
              content: promptBatch,
            },
          ],
        }),
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      contenutoRisposta = responseBody.content[0].text;

      saveBedrockResponse(
        "nutrizionale_batch",
        sessionId,
        promptBatch,
        contenutoRisposta,
        {
          modello,
          numPasti: pastiDaAnalizzare.length,
          tipiPasti: pastiDaAnalizzare.map((p) => p.tipo),
        }
      );
    }

    const jsonString = contenutoRisposta
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const risultatoBatch = JSON.parse(jsonString);

    if (
      !risultatoBatch.analisi_pasti ||
      !Array.isArray(risultatoBatch.analisi_pasti)
    ) {
      throw new Error("Risposta batch non valida");
    }

    interface PastoAnalizzato {
      valori_nutrizionali: {
        calorie_stimate: number;
        proteine_g: number;
        carboidrati_g: number;
        grassi_g: number;
      };
    }

    risultatoBatch.analisi_pasti.forEach(
      (pasto: PastoAnalizzato, index: number) => {
        const pastoOriginale = pastiDaAnalizzare[index];
        const chiave = `${pastoOriginale.giorno}-${pastoOriginale.tipo}`;

        try {
          const valori = pasto.valori_nutrizionali;
          const calorie_stimate = Math.round(
            Number(valori.calorie_stimate) || 0
          );
          const proteine_g = Math.round(Number(valori.proteine_g) || 0);
          const carboidrati_g = Math.round(Number(valori.carboidrati_g) || 0);
          const grassi_g = Math.round(Number(valori.grassi_g) || 0);

          if (calorie_stimate >= 50 && calorie_stimate <= 2000) {
            risultati.set(chiave, {
              descrizione_pasto: pastoOriginale.descrizione,
              tipo_pasto: pastoOriginale.tipo,
              calorie_stimate,
              proteine_g,
              carboidrati_g,
              grassi_g,
              fonte_calcolo: "bedrock_ai",
              stato_calcolo: "calcolato",
            });
          } else {
            risultati.set(
              chiave,
              creaPastoFallback(pastoOriginale.descrizione, pastoOriginale.tipo)
            );
          }
        } catch (error) {
          console.warn(`⚠️ Errore parsing pasto ${index}:`, error);
          risultati.set(
            chiave,
            creaPastoFallback(pastoOriginale.descrizione, pastoOriginale.tipo)
          );
        }
      }
    );

    return risultati;
  } catch (error) {
    console.error("❌ Errore batch nutrizionale:", error);

    pastiDaAnalizzare.forEach((pasto) => {
      const chiave = `${pasto.giorno}-${pasto.tipo}`;
      risultati.set(chiave, creaPastoFallback(pasto.descrizione, pasto.tipo));
    });

    return risultati;
  }
}
