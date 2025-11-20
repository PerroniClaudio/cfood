"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Utensils,
  Sparkles,
  Info,
  Calendar,
  TrendingUp,
  Clock,
  Plus,
  RefreshCcw,
} from "lucide-react";
import Modal from "../components/Modal";
import GeneraPianoForm from "../components/GeneraPianoForm";

interface PianoRecente {
  id: number;
  nome: string;
  descrizione?: string | null;
  dataCreazione: string | null;
  dataUltimaModifica: string | null;
  autore: string;
}

interface RisultatoAPI {
  [key: string]: unknown;
}

export default function Home() {
  const router = useRouter();

  const [isGeneraModalOpen, setIsGeneraModalOpen] = useState(false);
  const [risultato, setRisultato] = useState<RisultatoAPI | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [pianiRecenti, setPianiRecenti] = useState<PianoRecente[]>([]);
  const [loadingPiani, setLoadingPiani] = useState(false);

  useEffect(() => {
    caricaPianiRecenti();
  }, []);

  const caricaPianiRecenti = async () => {
    setLoadingPiani(true);
    try {
      const response = await fetch("/api/piani");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.lista) {
          const listaOrdinata = [...data.lista].sort(
            (a: { id: number | string }, b: { id: number | string }) =>
              Number(b.id) - Number(a.id)
          );
          setPianiRecenti(listaOrdinata);
        } else {
          setPianiRecenti([]);
        }
      } else {
        setPianiRecenti([]);
      }
    } catch (error) {
      console.error("Errore nel caricamento dei piani:", error);
      setPianiRecenti([]);
    } finally {
      setLoadingPiani(false);
    }
  };

  const navigaToPiano = (pianoId: number) => {
    router.push(`/piano/${pianoId}`);
  };

  const handlePianoGenerato = (piano: RisultatoAPI) => {
    setRisultato(piano);
    caricaPianiRecenti();
  };

  return (
    <div className="min-h-screen bg-background p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-center mb-12">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="p-4 bg-primary border-2 border-border shadow-neo rounded-none rotate-3 hover:rotate-6 transition-transform">
                <Utensils className="w-10 h-10 text-primary-foreground" />
              </div>
              <h1 className="text-6xl font-black tracking-tighter uppercase">
                CFood
              </h1>
            </div>
            <p className="text-xl font-bold max-w-2xl mx-auto border-2 border-border p-4 bg-white dark:bg-zinc-900 shadow-neo-sm rotate-1">
              Generatore di piani alimentari intelligente basato su AI e
              analisi storica
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              <Sparkles className="w-4 h-4" />
              <span>Powered by AWS Bedrock</span>
            </div>
          </div>
        </div>

        {/* Header con bottone per generare nuovo piano */}
        <div className="bg-card border-2 border-border shadow-neo p-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h2 className="text-3xl font-black text-foreground mb-2 uppercase">
                I tuoi piani alimentari
              </h2>
              <p className="text-lg font-medium text-muted-foreground">
                Visualizza e gestisci i tuoi piani alimentari generati
                dall&apos;AI
              </p>
            </div>
            <button
              onClick={() => setIsGeneraModalOpen(true)}
              className="bg-primary text-primary-foreground px-6 py-3 font-black uppercase tracking-wider border-2 border-border shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center gap-2"
            >
              <Plus className="w-6 h-6" />
              <span>Genera Nuovo Piano</span>
            </button>
          </div>
        </div>

        {/* Risultato piano appena generato */}
        {risultato && (
          <div className="bg-primary text-primary-foreground border-2 border-border shadow-neo p-6 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white border-2 border-black rounded-none shadow-neo-sm">
                <Sparkles className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-2xl font-black uppercase">
                Piano generato con successo!
              </h3>
            </div>
            <p className="font-bold text-lg mb-4">
              Il tuo piano alimentare personalizzato è pronto. È stato
              aggiunto alla lista dei piani disponibili.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="bg-white text-black px-4 py-2 font-bold border-2 border-black shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
              >
                {showRawData ? "Nascondi" : "Mostra"} dati tecnici
              </button>
            </div>
            {showRawData && (
              <div className="mt-4 bg-black text-white border-2 border-white p-4 overflow-hidden">
                <pre className="text-xs overflow-auto max-h-96 font-mono">
                  <code>{JSON.stringify(risultato, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="bg-secondary text-secondary-foreground border-2 border-border shadow-neo p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white border-2 border-border shadow-neo-sm shrink-0">
              <Info className="w-8 h-8 text-foreground" />
            </div>
            <div>
              <h2 className="text-2xl font-black mb-4 uppercase">
                Come funziona CFood
              </h2>

              <div className="space-y-3 text-base font-medium">
                <p>
                  <span className="font-black bg-white px-1 border-2 border-black mr-2">1. Analisi Storica:</span> Il
                  sistema analizza i piani alimentari precedenti per comprendere
                  pattern e preferenze
                </p>
                <p>
                  <span className="font-black bg-white px-1 border-2 border-black mr-2">2. Retrieval Ibrido:</span>{" "}
                  Combina frequenza storica (70%) e similarità semantica (30%)
                  per selezionare i migliori pasti
                </p>
                <p>
                  <span className="font-black bg-white px-1 border-2 border-black mr-2">3. Generazione AI:</span>{" "}
                  Utilizza AWS Bedrock per creare un piano personalizzato basato
                  sui dati raccolti
                </p>
                <p>
                  <span className="font-black bg-white px-1 border-2 border-black mr-2">4. Calcolo Nutrizionale:</span>{" "}
                  Analizza automaticamente i valori nutrizionali di ogni pasto
                  del piano
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Visualizzatore Piani Recenti */}
        <div className="bg-card border-2 border-border shadow-neo p-8">
          <div className="flex items-center justify-between mb-8 border-b-2 border-border pb-4">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6" />
              <h3 className="text-2xl font-black uppercase">Piani Recenti</h3>
            </div>
            <button
              onClick={caricaPianiRecenti}
              disabled={loadingPiani}
              className="bg-white text-foreground px-4 py-2 font-bold border-2 border-border shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loadingPiani ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">CARICAMENTO...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4" />
                  <span className="text-sm uppercase">Aggiorna</span>
                </div>
              )}
            </button>
          </div>

          {loadingPiani ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-xl font-bold uppercase">Caricamento piani recenti...</p>
            </div>
          ) : pianiRecenti.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border bg-muted/20">
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-xl font-black uppercase mb-2">
                Nessun piano trovato
              </h4>
              <p className="text-muted-foreground font-medium">
                Genera il tuo primo piano alimentare utilizzando il bottone
                sopra.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pianiRecenti.map((piano) => (
                <div
                  key={piano.id}
                  className="bg-white dark:bg-zinc-900 border-2 border-border p-6 hover:shadow-neo hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
                  onClick={() => navigaToPiano(piano.id)}
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="text-xl font-black uppercase group-hover:text-primary transition-colors">{piano.nome}</h4>
                        <div className="bg-accent text-accent-foreground px-2 py-0.5 text-xs font-bold border-2 border-border shadow-neo-sm">#{piano.id}</div>
                      </div>
                      {piano.descrizione && (
                        <p className="font-medium text-muted-foreground">{piano.descrizione}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-muted-foreground pt-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            CREATO:{" "}
                            {piano.dataCreazione
                              ? new Date(piano.dataCreazione).toLocaleDateString(
                                  "it-IT"
                                )
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            MODIFICATO:{" "}
                            {piano.dataUltimaModifica
                              ? new Date(
                                  piano.dataUltimaModifica
                                ).toLocaleDateString("it-IT")
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-muted px-2 py-0.5 border-2 border-border">
                          <span>👨‍🍳 {piano.autore}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigaToPiano(piano.id);
                        }}
                        className="w-full md:w-auto bg-background text-foreground px-4 py-2 font-bold border-2 border-border shadow-neo-sm group-hover:shadow-neo group-hover:-translate-y-0.5 transition-all uppercase"
                      >
                        Visualizza Piano
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal per generazione piano */}
      <Modal
        isOpen={isGeneraModalOpen}
        onCloseAction={() => setIsGeneraModalOpen(false)}
        title="Genera Nuovo Piano Alimentare"
        size="lg">
        <GeneraPianoForm
          onPianoGenerato={handlePianoGenerato}
          onCloseAction={() => setIsGeneraModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
