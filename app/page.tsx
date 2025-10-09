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
          setPianiRecenti(data.lista);
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
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="mb-8 flex justify-center">
          <div className="card w-full bg-base-300 shadow">
            <div className="card-body items-center text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-2xl">
                  <Utensils className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  CFood
                </h1>
              </div>
              <p className="text-lg max-w-2xl mx-auto">
                Generatore di piani alimentari intelligente basato su AI e
                analisi storica
              </p>
              <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500">
                <Sparkles className="w-4 h-4" />
                <span>Powered by AWS Bedrock</span>
              </div>
            </div>
          </div>
        </div>

        {/* Header con bottone per generare nuovo piano */}
        <div className="card bg-base-300 shadow overflow-hidden">
          <div className="card-body px-8 py-6">
            <h2 className="card-title text-2xl font-bold text-primary mb-2">
              I tuoi piani alimentari
            </h2>
            <p className="">
              Visualizza e gestisci i tuoi piani alimentari generati
              dall&apos;AI
            </p>
            <div className="card-actions justify-end">
              <button
                onClick={() => setIsGeneraModalOpen(true)}
                className="btn btn-primary flex items-center gap-2 font-semibold">
                <Plus className="w-5 h-5" />
                <span>Genera Nuovo Piano</span>
              </button>
            </div>
          </div>
        </div>

        {/* Risultato piano appena generato */}
        {risultato && (
          <div className="card bg-primary text-primary-content shadow-lg rounded-2xl p-6">
            <div className="card-body">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary-content rounded-full">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">
                  Piano generato con successo!
                </h3>
              </div>
              <p>
                Il tuo piano alimentare personalizzato è pronto. È stato
                aggiunto alla lista dei piani disponibili.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => setShowRawData(!showRawData)}
                  className="btn btn-secondary">
                  {showRawData ? "Nascondi" : "Mostra"} dati tecnici
                </button>
              </div>
              {showRawData && (
                <div className="mt-4 bg-base-100 border border-primary-content rounded-lg p-4">
                  <pre className="text-xs text-primary-content overflow-auto max-h-96">
                    <code>{JSON.stringify(risultato, null, 2)}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="card bg-info shadow-lg rounded-2xl p-6">
          <div className="card-body flex items-start gap-3">
            <div className="flex-1">
              <div className="mb-4 flex items-center gap-3">
                <div className="p-3 bg-base-300 rounded-2xl">
                  <Info className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-info-content">
                  Come funziona CFood
                </h2>
              </div>

              <div className="space-y-2 text-sm text-secondary-content">
                <p>
                  <span className="font-medium">1. Analisi Storica:</span> Il
                  sistema analizza i piani alimentari precedenti per comprendere
                  pattern e preferenze
                </p>
                <p>
                  <span className="font-medium">2. Retrieval Ibrido:</span>{" "}
                  Combina frequenza storica (70%) e similarità semantica (30%)
                  per selezionare i migliori pasti
                </p>
                <p>
                  <span className="font-medium">3. Generazione AI:</span>{" "}
                  Utilizza AWS Bedrock per creare un piano personalizzato basato
                  sui dati raccolti
                </p>
                <p>
                  <span className="font-medium">4. Calcolo Nutrizionale:</span>{" "}
                  Analizza automaticamente i valori nutrizionali di ogni pasto
                  del piano
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Visualizzatore Piani Recenti */}
        <div className="card bg-base-300 rounded-2xl shadow p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 inline-block mr-2" />
              <h3 className="text-xl font-bold ">Piani Recenti</h3>
            </div>
            <button
              onClick={caricaPianiRecenti}
              disabled={loadingPiani}
              className="btn btn-primary">
              {loadingPiani ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Caricamento...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4" />
                  <span className="text-sm">Aggiorna</span>
                </div>
              )}
            </button>
          </div>

          {loadingPiani ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Caricamento piani recenti...</p>
            </div>
          ) : pianiRecenti.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-600 mb-2">
                Nessun piano trovato
              </h4>
              <p className="text-gray-500">
                Genera il tuo primo piano alimentare utilizzando il bottone
                sopra.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pianiRecenti.map((piano) => (
                <div
                  key={piano.id}
                  className="card bg-base-100 rounded-xl hover:shadow-lg transition-all duration-200 cursor-pointer"
                  onClick={() => navigaToPiano(piano.id)}>
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold ">{piano.nome}</h4>
                      <div className="badge badge-success">#{piano.id}</div>
                    </div>
                    {piano.descrizione && (
                      <p className="leading-relaxed">{piano.descrizione}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Creato:{" "}
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
                          Modificato:{" "}
                          {piano.dataUltimaModifica
                            ? new Date(
                                piano.dataUltimaModifica
                              ).toLocaleDateString("it-IT")
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>👨‍🍳 {piano.autore}</span>
                      </div>
                    </div>

                    <div className="card-actions justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigaToPiano(piano.id);
                        }}
                        className="btn btn-primary text-sm font-medium">
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
