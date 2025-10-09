"use client";

import { useState, useEffect } from "react";
import { Eye, Calendar, TrendingUp } from "lucide-react";
import PianoAlimentareView from "./PianoAlimentareView";

interface Piano {
  id: number;
  nome: string;
  descrizione: string;
  dataCreazione: string;
  autore: string;
}

interface PianoDettagliato {
  piano_id: number;
  piano_alimentare: unknown;
  [key: string]: unknown;
}

export default function LastPianoViewer() {
  const [pianiRecenti, setPianiRecenti] = useState<Piano[]>([]);
  const [pianoSelezionato, setPianoSelezionato] =
    useState<PianoDettagliato | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDettaglio, setLoadingDettaglio] = useState(false);

  // Carica la lista dei piani recenti all'avvio
  useEffect(() => {
    caricaPianiRecenti();
  }, []);

  const caricaPianiRecenti = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/piani");
      if (response.ok) {
        const data = await response.json();
        setPianiRecenti(data.piani || []);
      }
    } catch (error) {
      console.error("Errore nel caricamento dei piani:", error);
    } finally {
      setLoading(false);
    }
  };

  const visualizzaPiano = async (pianoId: number) => {
    setLoadingDettaglio(true);
    try {
      const response = await fetch(`/api/piani/${pianoId}`);
      if (response.ok) {
        const data = await response.json();
        setPianoSelezionato(data);
      }
    } catch (error) {
      console.error("Errore nel caricamento del piano:", error);
    } finally {
      setLoadingDettaglio(false);
    }
  };

  if (pianoSelezionato) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPianoSelezionato(null)}
            className="btn btn-outline btn-sm">
            ← Torna ai piani
          </button>
          <div className="text-sm text-gray-500">
            Piano ID: {pianoSelezionato.piano_id}
          </div>
        </div>
        <PianoAlimentareView
          pianoData={
            pianoSelezionato as Parameters<
              typeof PianoAlimentareView
            >[0]["pianoData"]
          }
        />
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-xl mt-6">
      <div className="card-body">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-6 h-6 text-primary" />
          <h3 className="card-title text-xl">Piani Alimentari Recenti</h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        ) : pianiRecenti.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Nessun piano alimentare trovato</p>
            <p className="text-sm mt-2">
              Genera il primo piano usando il form sopra
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pianiRecenti.slice(0, 5).map((piano) => (
              <div
                key={piano.id}
                className="border border-base-300 rounded-lg p-4 hover:bg-base-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg mb-1">{piano.nome}</h4>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {piano.descrizione}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {new Date(piano.dataCreazione).toLocaleDateString(
                          "it-IT"
                        )}
                      </span>
                      <span>Autore: {piano.autore}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => visualizzaPiano(piano.id)}
                    disabled={loadingDettaglio}
                    className="btn btn-primary btn-sm ml-4">
                    {loadingDettaglio ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-1" />
                        Visualizza
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}

            {pianiRecenti.length > 5 && (
              <div className="text-center pt-4">
                <button
                  onClick={caricaPianiRecenti}
                  className="btn btn-outline btn-sm">
                  Carica altri piani ({pianiRecenti.length - 5} rimanenti)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
