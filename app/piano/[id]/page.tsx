"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Utensils, AlertCircle } from "lucide-react";

// Interfacce per i tipi
interface Piano {
  id: number;
  nome: string;
  descrizione?: string;
  autore: string;
  dataCreazione: string;
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
              <div className="flex flex-col lg:flex-row items-center gap-4 text-sm text-base-content">
                <span className="badge badge-outline badge-primary gap-1">
                  <Utensils className="w-4 h-4 inline mr-1" />
                  {dettagliPiano.giorni?.length || 0} giorni
                </span>
                <span className="badge badge-outline badge-secondary gap-1">
                  👨‍🍳 {dettagliPiano.piano?.autore || "Sconosciuto"}
                </span>
                <span className="badge badge-outline badge-info gap-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {dettagliPiano.piano?.dataCreazione
                    ? new Date(
                        dettagliPiano.piano.dataCreazione
                      ).toLocaleDateString("it-IT")
                    : "N/A"}
                </span>
              </div>
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
