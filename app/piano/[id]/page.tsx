"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Utensils,
  AlertCircle,
  RefreshCcw,
  Flame,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <h3 className="text-xl font-black uppercase tracking-wider">
            Caricamento dettagli piano...
          </h3>
        </div>
      </div>
    );
  }

  if (errore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-destructive text-destructive-foreground border-2 border-border shadow-neo p-8 max-w-md w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-card border-2 border-border rounded-none shadow-neo-sm">
              <AlertCircle className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="text-2xl font-black uppercase">Errore</h3>
          </div>
          <p className="font-bold mb-6 text-lg">{errore}</p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="w-full bg-card text-foreground border-2 border-border hover:bg-accent font-black uppercase"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna alla Homepage
          </Button>
        </div>
      </div>
    );
  }

  if (!dettagliPiano) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header con navigazione */}
        <div className="mb-6 flex justify-between items-center">
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="bg-white text-foreground border-2 border-border shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all font-bold uppercase"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna alla Homepage
          </Button>
          <ThemeToggle />
        </div>

        {/* Header del Piano */}
        <div className="bg-card border-2 border-border shadow-neo-lg p-8 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl md:text-5xl font-black text-foreground uppercase tracking-tighter">
                  {dettagliPiano.piano?.nome || `Piano #${pianoId}`}
                </h1>
              </div>
              {dettagliPiano.piano?.descrizione && (
                <p className="text-lg font-medium text-muted-foreground max-w-2xl border-l-4 border-primary pl-4 py-1">
                  {dettagliPiano.piano.descrizione}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end">
              <div className="bg-accent text-accent-foreground px-4 py-2 text-xl font-black border-2 border-border shadow-neo-sm rotate-2">
                #{dettagliPiano.piano?.id}
              </div>
              <div className="text-xs font-bold uppercase tracking-widest mt-2 text-muted-foreground">Piano ID</div>
            </div>
          </div>

          {/* Statistiche rapide */}
          {dettagliPiano.giorni && dettagliPiano.giorni.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t-2 border-border">
              <div className="bg-primary text-primary-foreground p-4 border-2 border-border shadow-neo-sm hover:-translate-y-1 transition-transform">
                <div className="text-3xl font-black">
                  {Math.round(
                    dettagliPiano.giorni.reduce(
                      (acc: number, g: Giorno) => acc + (g.calorie || 0),
                      0
                    ) / dettagliPiano.giorni.length
                  )}
                </div>
                <div className="text-xs font-bold uppercase tracking-widest opacity-80">kcal/giorno</div>
              </div>
              <div className="bg-secondary text-secondary-foreground p-4 border-2 border-border shadow-neo-sm hover:-translate-y-1 transition-transform">
                <div className="text-3xl font-black">
                  {Math.round(
                    dettagliPiano.giorni.reduce(
                      (acc: number, g: Giorno) => acc + (g.proteine || 0),
                      0
                    ) / dettagliPiano.giorni.length
                  )}
                </div>
                <div className="text-xs font-bold uppercase tracking-widest opacity-80">g proteine</div>
              </div>
              <div className="bg-muted text-muted-foreground p-4 border-2 border-border shadow-neo-sm hover:-translate-y-1 transition-transform">
                <div className="text-3xl font-black">
                  {Math.round(
                    dettagliPiano.giorni.reduce(
                      (acc: number, g: Giorno) =>
                        acc + (g.carboidrati || 0),
                      0
                    ) / dettagliPiano.giorni.length
                  )}
                </div>
                <div className="text-xs font-bold uppercase tracking-widest opacity-80">
                  g carboidrati
                </div>
              </div>
              <div className="bg-card text-foreground p-4 border-2 border-border shadow-neo-sm hover:-translate-y-1 transition-transform">
                <div className="text-3xl font-black">
                  {Math.round(
                    dettagliPiano.giorni.reduce(
                      (acc: number, g: Giorno) => acc + (g.grassi || 0),
                      0
                    ) / dettagliPiano.giorni.length
                  )}
                </div>
                <div className="text-xs font-bold uppercase tracking-widest opacity-80">g grassi</div>
              </div>
            </div>
          )}
        </div>

        {/* Feedback Reroll */}
        {rerollFeedback && (
          <div
            className={`p-4 border-2 border-border shadow-neo font-bold flex justify-between items-center animate-in slide-in-from-top-2 ${
              rerollFeedback.type === "success"
                ? "bg-green-400 text-black"
                : "bg-red-500 text-white"
            }`}>
            <span className="uppercase tracking-wide flex items-center gap-2">
              {rerollFeedback.type === "success" ? <Sparkles className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {rerollFeedback.message}
            </span>
            <button
              type="button"
              className="hover:bg-black/10 p-1 rounded-sm transition-colors"
              onClick={() => setRerollFeedback(null)}>
              <span className="sr-only">Chiudi</span>
              ✕
            </button>
          </div>
        )}

        {/* Dettagli per ogni giorno */}
        <div className="space-y-12">
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
                    className="bg-card border-2 border-border shadow-neo-lg overflow-hidden group">
                    {/* Header del giorno */}
                    <div className="bg-foreground text-background p-6 border-b-2 border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <h3 className="text-3xl font-black uppercase tracking-tighter">
                        {giorno.giorno}
                      </h3>
                      <div className="flex items-center gap-4">
                        <div className="bg-background text-foreground px-3 py-1 font-black border-2 border-border shadow-neo-sm text-lg">
                          {giorno.calorie || 0} <span className="text-xs font-bold uppercase text-muted-foreground">kcal</span>
                        </div>
                        <div className="text-xs font-bold uppercase text-background/80 hidden md:block">
                          P: {giorno.proteine || 0}g • C:{" "}
                          {giorno.carboidrati || 0}g • G: {giorno.grassi || 0}g
                        </div>
                      </div>
                    </div>

                    {/* Pasti del giorno */}
                    <div className="p-6 bg-background">
                      {pastiGiorno.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-border bg-muted/20">
                          <Utensils className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="font-bold text-muted-foreground uppercase">Nessun pasto configurato</p>
                        </div>
                      ) : (
                        <div className="grid gap-6 lg:grid-cols-3">
                          {pastiGiorno.map(
                            (pasto: Pasto | undefined, pastoIndex: number) => {
                              if (!pasto) return null;

                              // Colori badge basati sul tipo pasto
                              const badgeClass =
                                pasto.tipoPasto === "colazione"
                                  ? "bg-muted text-black border-border"
                                  : pasto.tipoPasto === "pranzo"
                                  ? "bg-primary text-primary-foreground border-border"
                                  : "bg-secondary text-secondary-foreground border-border";

                              return (
                                <div
                                  key={pastoIndex}
                                  className="bg-card border-2 border-border p-5 flex flex-col h-full hover:shadow-neo hover:-translate-y-1 transition-all duration-200">
                                  
                                  <div className="flex items-center justify-between mb-4">
                                    <span
                                      className={`px-2 py-0.5 text-xs font-black uppercase border-2 ${badgeClass} shadow-sm`}>
                                      {pasto.tipoPasto}
                                    </span>
                                    <div className="text-sm font-black text-foreground flex items-center gap-1">
                                      <Flame className="w-3 h-3" />
                                      {pasto.calorieStimate || 0}
                                    </div>
                                  </div>

                                  <div className="text-sm font-medium text-foreground mb-4 leading-relaxed flex-grow">
                                    {pasto.descrizioneDettagliata ||
                                      "Descrizione non disponibile"}
                                  </div>

                                  <div className="flex justify-between text-xs font-bold text-muted-foreground py-3 border-t-2 border-border/10 mt-auto">
                                    <span>P: {pasto.proteineG || 0}g</span>
                                    <span>C: {pasto.carboidratiG || 0}g</span>
                                    <span>G: {pasto.grassiG || 0}g</span>
                                  </div>

                                  {pasto.noteAggiuntive && (
                                    <div className="mt-3 text-xs font-medium bg-muted text-black p-2 border-2 border-border flex gap-2">
                                      <span className="text-lg">💡</span>
                                      <span>{pasto.noteAggiuntive}</span>
                                    </div>
                                  )}

                                  <Button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleRerollPasto(pasto.id);
                                    }}
                                    disabled={rerollingPastoId === pasto.id}
                                    variant="outline"
                                    className="w-full mt-4 border-2 border-border hover:bg-primary hover:text-primary-foreground hover:border-primary font-bold uppercase tracking-wide transition-all"
                                  >
                                    {rerollingPastoId === pasto.id ? (
                                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    ) : (
                                      <span className="flex items-center justify-center gap-2">
                                        <RefreshCcw className="w-3 h-3" />
                                        Rigenera
                                      </span>
                                    )}
                                  </Button>
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
    </div>
  );
}
// ...nessun codice valido qui: rimozione blocco duplicato e istruzioni non valide...
