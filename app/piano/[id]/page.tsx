"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Utensils,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";

// Interfacce per i tipi
interface Piano {
  id: number;
  nome: string;
  descrizione?: string;
  autore: string;
  dataCreazione: string;
  dataUltimaModifica?: string | null;
}

interface Pasto {
  id: number;
  tipoPasto: "colazione" | "pranzo" | "cena";
  descrizioneDettagliata: string;
  calorieStimate: number;
  proteineG: number;
  carboidratiG: number;
  grassiG: number;
  noteAggiuntive?: string;
}

// ...existing code...
interface Giorno {
  giorno: string;
  calorie: number;
  proteine: number;
  carboidrati: number;
  grassi: number;
}

interface Relazione {
  giornoSettimana: string;
  pastoId: number;
  ordineNelGiorno: number;
}

interface DettagliPiano {
  piano: Piano;
  giorni: Giorno[];
  pasti: Pasto[];
  relazioni: Relazione[];
}

export default function PianoPage() {
  const params = useParams();
  const router = useRouter();
  const pianoId = params.id as string;

  const [dettagliPiano, setDettagliPiano] = useState<DettagliPiano | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");
  const [rerollingPastoId, setRerollingPastoId] = useState<number | null>(null);
  const [rerollFeedback, setRerollFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const caricaDettagliPiano = useCallback(async () => {
    setLoading(true);
    setErrore("");
    try {
      const response = await fetch(`/api/piani/${pianoId}`);
      if (response.ok) {
        const data = await response.json();
        setDettagliPiano(data);
      } else {
        setErrore("Piano non trovato");
      }
    } catch (error) {
      setErrore("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }, [pianoId]);

  useEffect(() => {
    if (pianoId) {
      caricaDettagliPiano();
    }
  }, [pianoId, caricaDettagliPiano]);

  // Funzione per ordinare i giorni da Lunedì a Domenica
  const ordinaGiorni = (giorni: Giorno[]) => {
    const ordineGiorni = [
      "lunedì",
      "martedì",
      "mercoledì",
      "giovedì",
      "venerdì",
      "sabato",
      "domenica",
    ];
    return giorni.sort((a, b) => {
      const indiceA = ordineGiorni.indexOf(a.giorno?.toLowerCase());
      const indiceB = ordineGiorni.indexOf(b.giorno?.toLowerCase());
      if (indiceA === -1) return 1;
      if (indiceB === -1) return -1;
      return indiceA - indiceB;
    });
  };

  const handleRerollPasto = async (pastoId: number) => {
    setRerollFeedback(null);
    setRerollingPastoId(pastoId);
    try {
      const response = await fetch(`/api/piani/${pianoId}/reroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pastoId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Errore nella rigenerazione del pasto");
      }

      setDettagliPiano((prev) => {
        if (!prev) return prev;

        const pastoAggiornato = data.pasto;
        const pastoOriginaleId = data.pastoOriginaleId;
        const giornoAggiornato = data.giorno;
        const relazioneAggiornata = data.relazioneAggiornata;

        const nuoviPasti = prev.pasti.some((pasto) => pasto.id === pastoOriginaleId)
          ? prev.pasti.map((pasto) =>
              pasto.id === pastoOriginaleId
                ? {
                    ...pasto,
                    ...pastoAggiornato,
                    noteAggiuntive: pastoAggiornato.noteAggiuntive || undefined,
                  }
                : pasto
            )
          : [
              ...prev.pasti,
              {
                ...pastoAggiornato,
                noteAggiuntive: pastoAggiornato.noteAggiuntive || undefined,
              },
            ];

        const nuoveRelazioni =
          relazioneAggiornata && prev.relazioni
            ? prev.relazioni.map((relazione) =>
                relazione.pastoId === pastoOriginaleId
                  ? {
                      ...relazione,
                      pastoId: relazioneAggiornata.pastoId,
                      ordineNelGiorno: relazioneAggiornata.ordineNelGiorno,
                    }
                  : relazione
              )
            : prev.relazioni;

        return {
          ...prev,
          pasti: nuoviPasti,
          relazioni: nuoveRelazioni,
          giorni:
            giornoAggiornato && prev.giorni
              ? prev.giorni.map((giorno) =>
                  giorno.giorno === giornoAggiornato.giorno
                    ? {
                        ...giorno,
                        calorie: giornoAggiornato.calorie,
                        proteine: giornoAggiornato.proteine,
                        carboidrati: giornoAggiornato.carboidrati,
                        grassi: giornoAggiornato.grassi,
                      }
                    : giorno
                )
              : prev.giorni,
          piano: prev.piano
            ? {
                ...prev.piano,
                dataUltimaModifica: new Date().toISOString().split("T")[0],
              }
            : prev.piano,
        };
      });

      setRerollFeedback({
        type: "success",
        message: "Pasto rigenerato con successo 🎉",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore nella rigenerazione del pasto";
      setRerollFeedback({
        type: "error",
        message,
      });
    } finally {
      setRerollingPastoId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="card bg-base-100 shadow-lg p-8">
          <div className="flex flex-col items-center gap-4">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <h3 className="text-lg font-semibold text-primary">
              Caricamento dettagli piano...
            </h3>
          </div>
        </div>
      </div>
    );
  }

  if (errore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="card bg-error text-error-content shadow-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.push("/")}
              className="btn btn-neutral btn-sm">
              <ArrowLeft className="w-4 h-4" />
              <span>Torna alla Homepage</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-error-content rounded-full">
              <AlertCircle className="w-6 h-6 text-error" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2">Errore nel caricamento</h3>
              <p>{errore}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!dettagliPiano) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header con navigazione */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/")}
            className="btn btn-neutral btn-sm flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Torna alla Homepage</span>
          </button>
        </div>

        {/* Header del Piano */}
        <div className="card bg-base-100 shadow border border-base-300">
          <div className="card-body flex flex-row items-start justify-between">
            <div>
              <h1 className="card-title text-3xl font-bold text-primary mb-2">
                {dettagliPiano.piano?.nome || `Piano #${pianoId}`}
              </h1>
              {dettagliPiano.piano?.descrizione && (
                <p className="text-base-content mb-4">
                  {dettagliPiano.piano.descrizione}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="badge badge-lg badge-accent text-lg font-bold">
                #{dettagliPiano.piano?.id}
              </div>
              <div className="text-sm text-base-content">Piano ID</div>
            </div>
          </div>

          {/* Statistiche rapide */}
          {dettagliPiano.giorni && dettagliPiano.giorni.length > 0 && (
            <div className="card-actions p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 w-full">
                <div className="card bg-primary text-primary-content">
                  <div className="card-body items-center">
                    <div className="text-2xl font-bold">
                      {Math.round(
                        dettagliPiano.giorni.reduce(
                          (acc: number, g: Giorno) => acc + (g.calorie || 0),
                          0
                        ) / dettagliPiano.giorni.length
                      )}
                    </div>
                    <div className="text-sm font-medium">kcal/giorno</div>
                  </div>
                </div>
                <div className="card bg-secondary text-secondary-content">
                  <div className="card-body items-center">
                    <div className="text-2xl font-bold">
                      {Math.round(
                        dettagliPiano.giorni.reduce(
                          (acc: number, g: Giorno) => acc + (g.proteine || 0),
                          0
                        ) / dettagliPiano.giorni.length
                      )}
                    </div>
                    <div className="text-sm font-medium">g proteine/giorno</div>
                  </div>
                </div>
                <div className="card bg-primary text-primary-content">
                  <div className="card-body items-center">
                    <div className="text-2xl font-bold">
                      {Math.round(
                        dettagliPiano.giorni.reduce(
                          (acc: number, g: Giorno) =>
                            acc + (g.carboidrati || 0),
                          0
                        ) / dettagliPiano.giorni.length
                      )}
                    </div>
                    <div className="text-sm font-medium">
                      g carboidrati/giorno
                    </div>
                  </div>
                </div>
                <div className="card bg-secondary text-secondary-content">
                  <div className="card-body items-center">
                    <div className="text-2xl font-bold">
                      {Math.round(
                        dettagliPiano.giorni.reduce(
                          (acc: number, g: Giorno) => acc + (g.grassi || 0),
                          0
                        ) / dettagliPiano.giorni.length
                      )}
                    </div>
                    <div className="text-sm font-medium">g grassi/giorno</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dettagli per ogni giorno */}
        {rerollFeedback && (
          <div
            className={`alert ${
              rerollFeedback.type === "success"
                ? "alert-success"
                : "alert-error"
            }`}>
            <span>{rerollFeedback.message}</span>
            <div>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setRerollFeedback(null)}>
                Chiudi
              </button>
            </div>
          </div>
        )}

        {dettagliPiano.giorni &&
          ordinaGiorni([...dettagliPiano.giorni]).map(
            (giorno: Giorno, index: number) => {
              // Trova i pasti per questo giorno
              const pastiGiorno =
                dettagliPiano.relazioni
                  ?.filter(
                    (r: Relazione) => r.giornoSettimana === giorno.giorno
                  )
                  ?.sort(
                    (a: Relazione, b: Relazione) =>
                      (a.ordineNelGiorno || 0) - (b.ordineNelGiorno || 0)
                  )
                  ?.map((r: Relazione) =>
                    dettagliPiano.pasti?.find((p: Pasto) => p.id === r.pastoId)
                  )
                  ?.filter(Boolean) || [];

              return (
                <div
                  key={index}
                  className="card bg-base-100 shadow border border-base-300 overflow-hidden">
                  {/* Header del giorno */}
                  <div className="card-title px-8 py-6 border-b border-base-300 flex items-center justify-between bg-base-300">
                    <h3 className="text-2xl font-bold text-primary capitalize">
                      {giorno.giorno}
                    </h3>
                    <div className="text-right">
                      <div className="badge badge-lg badge-primary text-xl font-bold">
                        {giorno.calorie || 0} kcal
                      </div>
                      <div className="text-sm text-base-content">
                        P: {giorno.proteine || 0}g • C:{" "}
                        {giorno.carboidrati || 0}g • G: {giorno.grassi || 0}g
                      </div>
                    </div>
                  </div>

                  {/* Pasti del giorno */}
                  <div className="card-body">
                    {pastiGiorno.length === 0 ? (
                      <div className="text-center py-8 text-base-content">
                        <Utensils className="w-12 h-12 mx-auto mb-4 text-base-300" />
                        <p>Nessun pasto configurato per questo giorno</p>
                      </div>
                    ) : (
                      <div className="grid gap-6 lg:grid-cols-3">
                        {pastiGiorno.map(
                          (pasto: Pasto | undefined, pastoIndex: number) => {
                            if (!pasto) return null;

                            // DaisyUI colori badge/card
                            const badgeColor =
                              pasto.tipoPasto === "colazione"
                                ? "badge-warning"
                                : pasto.tipoPasto === "pranzo"
                                ? "badge-info"
                                : "badge-secondary";

                            return (
                              <div
                                key={pastoIndex}
                                className="card bg-base-200 border border-base-300 rounded-xl">
                                <div className="card-body">
                                  <div className="flex items-center gap-2 mb-4">
                                    <span
                                      className={`badge ${badgeColor} badge-sm capitalize font-bold`}>
                                      {pasto.tipoPasto}
                                    </span>
                                    <div className="ml-auto text-sm font-semibold text-primary">
                                      {pasto.calorieStimate || 0} kcal
                                    </div>
                                  </div>

                                  <div className="text-sm text-base-content mb-4 leading-relaxed">
                                    {pasto.descrizioneDettagliata ||
                                      "Descrizione non disponibile"}
                                  </div>

                                  <div className="flex gap-3 text-xs text-base-content pt-3 border-t border-base-300">
                                    <span>P: {pasto.proteineG || 0}g</span>
                                    <span>C: {pasto.carboidratiG || 0}g</span>
                                    <span>G: {pasto.grassiG || 0}g</span>
                                  </div>

                                  {pasto.noteAggiuntive && (
                                    <div className="mt-3 text-xs text-info italic">
                                      💡 {pasto.noteAggiuntive}
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleRerollPasto(pasto.id);
                                    }}
                                    disabled={rerollingPastoId === pasto.id}
                                    className="btn btn-outline btn-xs w-full mt-4">
                                    {rerollingPastoId === pasto.id ? (
                                      <span className="loading loading-spinner loading-xs"></span>
                                    ) : (
                                      <span className="flex items-center justify-center gap-2">
                                        <RefreshCcw className="w-3 h-3" />
                                        Rigenera con AI
                                      </span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          )}
      </div>
    </div>
  );
}
// ...nessun codice valido qui: rimozione blocco duplicato e istruzioni non valide...
