"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Utensils,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

export default function PianoPage() {
  const params = useParams();
  const router = useRouter();
  const pianoId = params.id as string;

  const [dettagliPiano, setDettagliPiano] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    if (pianoId) {
      caricaDettagliPiano();
    }
  }, [pianoId]);

  const caricaDettagliPiano = async () => {
    setLoading(true);
    setErrore("");

    try {
      const response = await fetch(`/api/piani/${pianoId}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Dettagli piano ricevuti:", data);
        setDettagliPiano(data);
      } else {
        console.error(
          "Errore nel caricamento dettagli piano:",
          response.status
        );
        setErrore("Piano non trovato");
      }
    } catch (error) {
      console.error("Errore nel fetch dettagli piano:", error);
      setErrore("Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  // Funzione per ordinare i giorni da Lunedì a Domenica
  const ordinaGiorni = (giorni: any[]) => {
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-700">
              Caricamento dettagli piano...
            </h3>
          </div>
        </div>
      </div>
    );
  }

  if (errore) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Torna alla Homepage</span>
            </button>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Errore nel caricamento
                </h3>
                <p className="text-red-700">{errore}</p>
              </div>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header con navigazione */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Torna alla Homepage</span>
          </button>
        </div>

        {/* Header del Piano */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {dettagliPiano.piano?.nome || `Piano #${pianoId}`}
              </h1>
              {dettagliPiano.piano?.descrizione && (
                <p className="text-gray-600 mb-4">
                  {dettagliPiano.piano.descrizione}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                  <Utensils className="w-4 h-4 inline mr-1" />
                  {dettagliPiano.giorni?.length || 0} giorni
                </span>
                <span>👨‍🍳 {dettagliPiano.piano?.autore || "Sconosciuto"}</span>
                <span>
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
              <div className="text-2xl font-bold text-blue-600">
                #{dettagliPiano.piano?.id}
              </div>
              <div className="text-sm text-gray-500">Piano ID</div>
            </div>
          </div>

          {/* Statistiche rapide */}
          {dettagliPiano.giorni && dettagliPiano.giorni.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {Math.round(
                    dettagliPiano.giorni.reduce(
                      (acc: number, g: any) => acc + (g.calorie || 0),
                      0
                    ) / dettagliPiano.giorni.length
                  )}
                </div>
                <div className="text-sm text-blue-600 font-medium">
                  kcal/giorno
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-700">
                  {Math.round(
                    dettagliPiano.giorni.reduce(
                      (acc: number, g: any) => acc + (g.proteine || 0),
                      0
                    ) / dettagliPiano.giorni.length
                  )}
                </div>
                <div className="text-sm text-green-600 font-medium">
                  g proteine/giorno
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-700">
                  {Math.round(
                    dettagliPiano.giorni.reduce(
                      (acc: number, g: any) => acc + (g.carboidrati || 0),
                      0
                    ) / dettagliPiano.giorni.length
                  )}
                </div>
                <div className="text-sm text-orange-600 font-medium">
                  g carboidrati/giorno
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-700">
                  {Math.round(
                    dettagliPiano.giorni.reduce(
                      (acc: number, g: any) => acc + (g.grassi || 0),
                      0
                    ) / dettagliPiano.giorni.length
                  )}
                </div>
                <div className="text-sm text-purple-600 font-medium">
                  g grassi/giorno
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dettagli per ogni giorno */}
        {dettagliPiano.giorni &&
          ordinaGiorni([...dettagliPiano.giorni]).map(
            (giorno: any, index: number) => {
              // Trova i pasti per questo giorno
              const pastiGiorno =
                dettagliPiano.relazioni
                  ?.filter((r: any) => r.giornoSettimana === giorno.giorno)
                  ?.sort(
                    (a: any, b: any) =>
                      (a.ordineNelGiorno || 0) - (b.ordineNelGiorno || 0)
                  )
                  ?.map((r: any) =>
                    dettagliPiano.pasti?.find((p: any) => p.id === r.pastoId)
                  )
                  ?.filter(Boolean) || [];

              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                  {/* Header del giorno */}
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-8 py-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {giorno.giorno}
                      </h3>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">
                          {giorno.calorie || 0} kcal
                        </div>
                        <div className="text-sm text-gray-500">
                          P: {giorno.proteine || 0}g • C:{" "}
                          {giorno.carboidrati || 0}g • G: {giorno.grassi || 0}g
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pasti del giorno */}
                  <div className="p-8">
                    {pastiGiorno.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Utensils className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>Nessun pasto configurato per questo giorno</p>
                      </div>
                    ) : (
                      <div className="grid gap-6 lg:grid-cols-3">
                        {pastiGiorno.map((pasto: any, pastoIndex: number) => {
                          const coloreCard =
                            pasto.tipoPasto === "colazione"
                              ? "from-amber-50 to-orange-50 border-amber-200"
                              : pasto.tipoPasto === "pranzo"
                              ? "from-blue-50 to-indigo-50 border-blue-200"
                              : "from-purple-50 to-pink-50 border-purple-200";

                          const coloreTestata =
                            pasto.tipoPasto === "colazione"
                              ? "text-amber-800"
                              : pasto.tipoPasto === "pranzo"
                              ? "text-blue-800"
                              : "text-purple-800";

                          const coloreValori =
                            pasto.tipoPasto === "colazione"
                              ? "text-amber-700"
                              : pasto.tipoPasto === "pranzo"
                              ? "text-blue-700"
                              : "text-purple-700";

                          return (
                            <div
                              key={pastoIndex}
                              className={`bg-gradient-to-br ${coloreCard} rounded-xl p-6 border`}>
                              <div className="flex items-center gap-2 mb-4">
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    pasto.tipoPasto === "colazione"
                                      ? "bg-amber-400"
                                      : pasto.tipoPasto === "pranzo"
                                      ? "bg-blue-400"
                                      : "bg-purple-400"
                                  }`}></div>
                                <h4
                                  className={`text-lg font-bold ${coloreTestata} capitalize`}>
                                  {pasto.tipoPasto}
                                </h4>
                                <div
                                  className={`ml-auto text-sm font-semibold ${coloreValori}`}>
                                  {pasto.calorieStimate || 0} kcal
                                </div>
                              </div>

                              <div
                                className={`text-sm ${coloreValori} mb-4 leading-relaxed`}>
                                {pasto.descrizioneDettagliata ||
                                  "Descrizione non disponibile"}
                              </div>

                              <div
                                className={`flex gap-3 text-xs ${coloreValori} pt-3 border-t border-gray-200`}>
                                <span>P: {pasto.proteineG || 0}g</span>
                                <span>C: {pasto.carboidratiG || 0}g</span>
                                <span>G: {pasto.grassiG || 0}g</span>
                              </div>

                              {pasto.noteAggiuntive && (
                                <div
                                  className={`mt-3 text-xs ${coloreValori} italic`}>
                                  💡 {pasto.noteAggiuntive}
                                </div>
                              )}
                            </div>
                          );
                        })}
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
