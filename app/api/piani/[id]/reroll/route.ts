import { NextRequest, NextResponse } from "next/server";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { db } from "@/db";
import {
  pianiAlimentari,
  pianiPasti,
  dettagliNutrizionaliGiornalieri,
  pasti,
} from "@/db/schema";
import { and, desc, eq, count } from "drizzle-orm";
import {
  buildPromptAnalisiNutrizionale,
  buildPromptRerollPasto,
} from "@/prompts";

interface RerollRequestBody {
  pastoId: number;
  preferenze?: string[];
  esclusioni?: string[];
}

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const getBedrockModelId = () => {
  const modelId = process.env.AWS_BEDROCK_MODEL;
  if (!modelId) {
    throw new Error("Variabile d'ambiente AWS_BEDROCK_MODEL non configurata");
  }
  return modelId;
};

function normalizeDayLabel(label: string) {
  if (!label) return "";
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

async function generaNuovoPastoConAI(params: {
  giornoLabel: string;
  tipoPasto: string;
  descrizioneAttuale: string;
  targets: { calorie: number; proteine: number; carboidrati: number; grassi: number };
  preferenze: string[];
  esclusioni: string[];
  storicoPasti: string;
}) {
  const prompt = buildPromptRerollPasto({
    giornoLabel: params.giornoLabel,
    tipoPasto: params.tipoPasto,
    descrizioneAttuale: params.descrizioneAttuale,
    calorieTarget: params.targets.calorie,
    proteineTarget: params.targets.proteine,
    carboidratiTarget: params.targets.carboidrati,
    grassiTarget: params.targets.grassi,
    preferenze: params.preferenze,
    esclusioni: params.esclusioni,
    storicoPasti: params.storicoPasti,
  });

  const command = new InvokeModelCommand({
    modelId: getBedrockModelId(),
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2000,
      temperature: 0.6,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  let text = responseBody.content?.[0]?.text ?? "";

  text = text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  }
  if (text.endsWith("```")) {
    text = text.replace(/```$/i, "").trim();
  }

  const parsed = JSON.parse(text);
  if (parsed.errore) {
    throw new Error(String(parsed.errore));
  }

  if (!parsed.descrizione_dettagliata || typeof parsed.descrizione_dettagliata !== "string") {
    throw new Error("Risposta AI non valida: descrizione mancante");
  }

  return {
    descrizioneDettagliata: parsed.descrizione_dettagliata.trim(),
    noteAggiuntive:
      typeof parsed.note_aggiuntive === "string"
        ? parsed.note_aggiuntive.trim()
        : null,
  };
}

async function calcolaMacroPerDescrizione(descrizione: string) {
  const prompt = buildPromptAnalisiNutrizionale(descrizione);

  const command = new InvokeModelCommand({
    modelId: getBedrockModelId(),
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  let text = responseBody.content?.[0]?.text ?? "";

  text = text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  }
  if (text.endsWith("```")) {
    text = text.replace(/```$/i, "").trim();
  }

  const parsed = JSON.parse(text);
  const valori = parsed.valori_nutrizionali;

  if (
    !valori ||
    typeof valori.calorie_stimate !== "number" ||
    typeof valori.proteine_g !== "number" ||
    typeof valori.carboidrati_g !== "number" ||
    typeof valori.grassi_g !== "number"
  ) {
    throw new Error("Valori nutrizionali non validi");
  }

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(Math.round(value), min), max);

  return {
    calorie: clamp(valori.calorie_stimate, 50, 2000),
    proteine: clamp(valori.proteine_g, 0, 200),
    carboidrati: clamp(valori.carboidrati_g, 0, 250),
    grassi: clamp(valori.grassi_g, 0, 150),
  };
}

function formatStoricoPasti(
  lista: Array<{
    id: number;
    descrizioneDettagliata: string;
    calorieStimate: number | null;
  }>
) {
  if (!lista.length) return "";

  return lista
    .map((pasto, index) => {
      const calorie = typeof pasto.calorieStimate === "number" && pasto.calorieStimate > 0
        ? `${pasto.calorieStimate} kcal`
        : "calorie n/d";
      return `${index + 1}. ${pasto.descrizioneDettagliata} (${calorie})`;
    })
    .join("\n");
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await (context.params as { id: string } | Promise<{ id: string }>);
    const pianoId = Number(resolvedParams.id);
    if (Number.isNaN(pianoId)) {
      return NextResponse.json(
        { success: false, error: "Parametro id non valido" },
        { status: 400 }
      );
    }

    const body: RerollRequestBody = await request.json();
    if (!body || typeof body.pastoId !== "number") {
      return NextResponse.json(
        { success: false, error: "pastoId obbligatorio" },
        { status: 400 }
      );
    }

    const preferenze = Array.isArray(body.preferenze) ? body.preferenze : [];
    const esclusioni = Array.isArray(body.esclusioni) ? body.esclusioni : [];

    const [piano] = await db
      .select({
        id: pianiAlimentari.id,
      })
      .from(pianiAlimentari)
      .where(eq(pianiAlimentari.id, pianoId))
      .limit(1);

    if (!piano) {
      return NextResponse.json(
        { success: false, error: "Piano non trovato" },
        { status: 404 }
      );
    }

    const [relazione] = await db
      .select()
      .from(pianiPasti)
      .where(and(eq(pianiPasti.pianoId, pianoId), eq(pianiPasti.pastoId, body.pastoId)))
      .limit(1);

    if (!relazione) {
      return NextResponse.json(
        {
          success: false,
          error: "Il pasto indicato non appartiene al piano specificato",
        },
        { status: 404 }
      );
    }

    const [pastoAttuale] = await db
      .select()
      .from(pasti)
      .where(eq(pasti.id, body.pastoId))
      .limit(1);

    if (!pastoAttuale) {
      return NextResponse.json(
        { success: false, error: "Pasto non trovato" },
        { status: 404 }
      );
    }

    const storicoPasti = await db
      .select({
        id: pasti.id,
        descrizioneDettagliata: pasti.descrizioneDettagliata,
        calorieStimate: pasti.calorieStimate,
      })
      .from(pasti)
      .where(eq(pasti.tipoPasto, pastoAttuale.tipoPasto))
      .orderBy(desc(pasti.id))
      .limit(5);

    const targets = {
      calorie: pastoAttuale.calorieStimate ?? 500,
      proteine: pastoAttuale.proteineG ?? 25,
      carboidrati: pastoAttuale.carboidratiG ?? 50,
      grassi: pastoAttuale.grassiG ?? 20,
    };

    const giornoLabel = normalizeDayLabel(relazione.giornoSettimana);

    const nuovoPasto = await generaNuovoPastoConAI({
      giornoLabel,
      tipoPasto: pastoAttuale.tipoPasto,
      descrizioneAttuale: pastoAttuale.descrizioneDettagliata,
      targets,
      preferenze,
      esclusioni,
      storicoPasti: formatStoricoPasti(
        storicoPasti
          .filter((p) => p.id !== pastoAttuale.id)
          .slice(0, 4)
      ),
    });

    const macro = await calcolaMacroPerDescrizione(nuovoPasto.descrizioneDettagliata);

    const differenze = {
      calorie: macro.calorie - (pastoAttuale.calorieStimate ?? 0),
      proteine: macro.proteine - (pastoAttuale.proteineG ?? 0),
      carboidrati: macro.carboidrati - (pastoAttuale.carboidratiG ?? 0),
      grassi: macro.grassi - (pastoAttuale.grassiG ?? 0),
    };

    let giornoAggiornato: {
      giorno: string;
      calorie: number;
      proteine: number;
      carboidrati: number;
      grassi: number;
    } | null = null;

    const result = await db.transaction(async (tx) => {
      const [nuovoPastoRecord] = await tx
        .insert(pasti)
        .values({
          tipoPasto: pastoAttuale.tipoPasto,
          descrizioneDettagliata: nuovoPasto.descrizioneDettagliata,
          noteAggiuntive: nuovoPasto.noteAggiuntive,
          calorieStimate: macro.calorie,
          proteineG: macro.proteine,
          carboidratiG: macro.carboidrati,
          grassiG: macro.grassi,
        })
        .returning();

      if (!nuovoPastoRecord) {
        throw new Error("Impossibile creare il nuovo pasto");
      }

      await tx
        .update(pianiPasti)
        .set({ pastoId: nuovoPastoRecord.id })
        .where(
          and(
            eq(pianiPasti.pianoId, pianoId),
            eq(pianiPasti.pastoId, body.pastoId),
            eq(pianiPasti.giornoSettimana, relazione.giornoSettimana)
          )
        );

      const [utilizziRimanenti] = await tx
        .select({ totale: count() })
        .from(pianiPasti)
        .where(eq(pianiPasti.pastoId, body.pastoId));

      const utilizziResidui = Number(utilizziRimanenti?.totale ?? 0);

      if (utilizziResidui === 0) {
        await tx.delete(pasti).where(eq(pasti.id, body.pastoId));
      }

      const [giornoRecord] = await tx
        .select()
        .from(dettagliNutrizionaliGiornalieri)
        .where(
          and(
            eq(dettagliNutrizionaliGiornalieri.pianoId, pianoId),
            eq(dettagliNutrizionaliGiornalieri.giornoSettimana, relazione.giornoSettimana)
          )
        )
        .limit(1);

      if (giornoRecord) {
        const nuoveCalorie = (giornoRecord.calorieTotaliKcal ?? 0) + differenze.calorie;
        const nuoveProteine = (giornoRecord.proteineTotaliG ?? 0) + differenze.proteine;
        const nuoviCarboidrati = (giornoRecord.carboidratiTotaliG ?? 0) + differenze.carboidrati;
        const nuoviGrassi = (giornoRecord.grassiTotaliG ?? 0) + differenze.grassi;

        await tx
          .update(dettagliNutrizionaliGiornalieri)
          .set({
            calorieTotaliKcal: Math.max(Math.round(nuoveCalorie), 0),
            proteineTotaliG: Math.max(Math.round(nuoveProteine), 0),
            carboidratiTotaliG: Math.max(Math.round(nuoviCarboidrati), 0),
            grassiTotaliG: Math.max(Math.round(nuoviGrassi), 0),
          })
          .where(eq(dettagliNutrizionaliGiornalieri.id, giornoRecord.id));

        giornoAggiornato = {
          giorno: normalizeDayLabel(giornoRecord.giornoSettimana),
          calorie: Math.max(Math.round(nuoveCalorie), 0),
          proteine: Math.max(Math.round(nuoveProteine), 0),
          carboidrati: Math.max(Math.round(nuoviCarboidrati), 0),
          grassi: Math.max(Math.round(nuoviGrassi), 0),
        };
      }

      await tx
        .update(pianiAlimentari)
        .set({ dataUltimaModifica: new Date().toISOString().split("T")[0] })
        .where(eq(pianiAlimentari.id, pianoId));

      return { nuovoPastoRecord };
    });

    if (!result?.nuovoPastoRecord) {
      throw new Error("Errore nella creazione del nuovo pasto");
    }

    return NextResponse.json({
      success: true,
      pasto: {
        id: result.nuovoPastoRecord.id,
        tipoPasto: result.nuovoPastoRecord.tipoPasto,
        descrizioneDettagliata: result.nuovoPastoRecord.descrizioneDettagliata,
        calorieStimate: result.nuovoPastoRecord.calorieStimate,
        proteineG: result.nuovoPastoRecord.proteineG,
        carboidratiG: result.nuovoPastoRecord.carboidratiG,
        grassiG: result.nuovoPastoRecord.grassiG,
        noteAggiuntive: result.nuovoPastoRecord.noteAggiuntive,
      },
      pastoOriginaleId: pastoAttuale.id,
      relazioneAggiornata: {
        pianoId,
        pastoId: result.nuovoPastoRecord.id,
        giornoSettimana: relazione.giornoSettimana,
        ordineNelGiorno: relazione.ordineNelGiorno,
      },
      giorno: giornoAggiornato,
    });
  } catch (error) {
    console.error("Errore POST /api/piani/[id]/reroll", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Errore interno" },
      { status: 500 }
    );
  }
}
