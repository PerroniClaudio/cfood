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

  // Calcolo medie nutrizionali
  const avgKcal = Math.round(
    (dettagliPiano.giorni?.reduce((acc, g) => acc + (g.calorie || 0), 0) || 0) /
      (dettagliPiano.giorni?.length || 1)
  );
  const avgPro = Math.round(
    (dettagliPiano.giorni?.reduce((acc, g) => acc + (g.proteine || 0), 0) || 0) /
      (dettagliPiano.giorni?.length || 1)
  );
  const avgCar = Math.round(
    (dettagliPiano.giorni?.reduce((acc, g) => acc + (g.carboidrati || 0), 0) || 0) /
      (dettagliPiano.giorni?.length || 1)
  );
  const avgFat = Math.round(
    (dettagliPiano.giorni?.reduce((acc, g) => acc + (g.grassi || 0), 0) || 0) /
      (dettagliPiano.giorni?.length || 1)
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        {/* Header con navigazione */}
        <div className="mb-12 flex justify-between items-center">
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="bg-card text-foreground border-2 border-border shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all font-bold uppercase"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna alla Homepage
          </Button>
          <ThemeToggle />
        </div>

        {/* Feedback Reroll */}
        {rerollFeedback && (
          <div
            className={`fixed bottom-8 right-8 z-50 p-4 border-2 border-black shadow-neo-lg font-bold flex items-center gap-4 animate-in slide-in-from-bottom-4 ${
              rerollFeedback.type === "success"
                ? "bg-green-400 text-black"
                : "bg-red-500 text-white"
            }`}
          >
            <span className="uppercase tracking-wide flex items-center gap-2">
              {rerollFeedback.type === "success" ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              {rerollFeedback.message}
            </span>
            <button
              type="button"
              className="hover:bg-black/10 p-1 rounded-sm transition-colors"
              onClick={() => setRerollFeedback(null)}
            >
              <span className="sr-only">Chiudi</span>✕
            </button>
          </div>
        )}

        {/* THE MENU CARD */}
        <div className="bg-card text-card-foreground border-4 border-border shadow-neo-xl p-4 md:p-16 relative lg:rotate-1 transition-transform hover:rotate-0 duration-500 mb-20">
          {/* Decorative Elements */}
          <div className="absolute top-[-12px] left-1/2 -translate-x-1/2 w-6 h-6 bg-foreground rounded-full shadow-sm z-20 border-2 border-background"></div>

          {/* Menu Header */}
          <div className="text-center mb-12 md:mb-16 border-b-4 border-double border-border pb-8">
            <h1 className="text-3xl md:text-7xl font-black uppercase tracking-tighter mb-4 leading-none">
              Menu Settimanale
            </h1>
            <div className="flex flex-col items-center gap-2">
              <p className="font-mono text-lg md:text-xl uppercase tracking-widest text-muted-foreground">
                {dettagliPiano.piano?.nome || "Cucina AI"}
              </p>
              <p className="text-sm font-bold bg-primary text-primary-foreground px-3 py-1 rotate-2 shadow-neo-sm">
                EST. {new Date().getFullYear()}
              </p>
            </div>

            {/* Nutritional Stats Row */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-8 mt-8 font-mono text-sm md:text-base font-bold border-t-2 border-dotted border-border/50 pt-6">
              <span className="flex items-center gap-2">
                <Flame className="w-4 h-4" /> {avgKcal} KCAL
              </span>
              <span>•</span>
              <span>{avgPro}G PRO</span>
              <span>•</span>
              <span>{avgCar}G CARB</span>
              <span>•</span>
              <span>{avgFat}G FAT</span>
            </div>
          </div>

          {/* Days Loop */}
          <div className="space-y-20">
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
                        dettagliPiano.pasti?.find(
                          (p: Pasto) => p.id === r.pastoId
                        )
                      )
                      ?.filter(Boolean) || [];

                  return (
                    <div key={index} className="relative">
                      {/* Day Header */}
                      <div className="flex justify-center mb-6 md:mb-10">
                        <h2 className="text-2xl md:text-4xl font-black uppercase text-center relative inline-block">
                          <span className="bg-foreground text-background px-6 md:px-8 py-2 transform -rotate-2 inline-block shadow-neo border-2 border-transparent">
                            {giorno.giorno}
                          </span>
                        </h2>
                      </div>

                      {/* Meals List */}
                      <div className="space-y-10 px-2 md:px-8">
                        {pastiGiorno.length === 0 ? (
                          <div className="text-center py-8 font-mono text-muted-foreground italic">
                            Chiuso per riposo settimanale
                          </div>
                        ) : (
                          pastiGiorno.map(
                            (pasto: Pasto | undefined, pastoIndex: number) => {
                              if (!pasto) return null;

                              return (
                                <div key={pastoIndex} className="group relative">
                                  {/* Meal Header Line */}
                                  <div className="flex items-baseline justify-between gap-2 md:gap-4 mb-2">
                                    <h3 className="font-black text-lg md:text-2xl uppercase shrink-0 group-hover:text-primary transition-colors">
                                      {pasto.tipoPasto}
                                    </h3>
                                    <div className="flex-grow border-b-4 border-dotted border-border/30 relative -top-1 md:-top-2"></div>
                                    <span className="font-mono font-bold text-base md:text-xl shrink-0">
                                      {pasto.calorieStimate} kcal
                                    </span>
                                  </div>

                                  {/* Meal Description */}
                                  <div className="pl-0 md:pl-4 pr-12">
                                    <p className="font-medium text-lg leading-snug mb-2">
                                      {pasto.descrizioneDettagliata}
                                    </p>
                                    
                                    {/* Macros & Notes */}
                                    <div className="flex flex-wrap items-center gap-x-3 md:gap-x-4 gap-y-2 text-[10px] md:text-xs font-mono text-muted-foreground uppercase tracking-wider">
                                      <span>P: {pasto.proteineG}g</span>
                                      <span className="text-border">•</span>
                                      <span>C: {pasto.carboidratiG}g</span>
                                      <span className="text-border">•</span>
                                      <span>F: {pasto.grassiG}g</span>
                                      
                                      {pasto.noteAggiuntive && (
                                        <span className="bg-muted text-black px-2 py-0.5 font-bold ml-0 md:ml-2 border border-black/10 block w-full md:w-auto md:inline mt-1 md:mt-0">
                                          {pasto.noteAggiuntive}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Reroll Action */}
                                  <div className="absolute right-0 top-0 md:top-8 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 md:translate-x-4 md:group-hover:translate-x-0">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleRerollPasto(pasto.id);
                                      }}
                                      disabled={rerollingPastoId === pasto.id}
                                      className="h-8 w-8 rounded-full border-2 border-border bg-background hover:bg-foreground hover:text-background shadow-neo-sm"
                                      title="Cambia piatto"
                                    >
                                      {rerollingPastoId === pasto.id ? (
                                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                      ) : (
                                        <RefreshCcw className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              );
                            }
                          )
                        )}
                      </div>
                    </div>
                  );
                }
              )}
          </div>

          {/* Footer */}
          <div className="mt-20 pt-8 border-t-4 border-double border-border text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Generato con amore da CFood AI
            </p>
            <div className="flex justify-center gap-2">
               <div className="w-2 h-2 bg-foreground rounded-full"></div>
               <div className="w-2 h-2 bg-foreground rounded-full"></div>
               <div className="w-2 h-2 bg-foreground rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ...nessun codice valido qui: rimozione blocco duplicato e istruzioni non valide...
