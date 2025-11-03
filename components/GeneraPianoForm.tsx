"use client";

import { useState } from "react";
import { Sparkles, AlertCircle } from "lucide-react";

// Tipi per il piano alimentare (allineati al nuovo formato)
interface PastoInfo {
  tipo_pasto: "colazione" | "pranzo" | "cena";
  descrizione_dettagliata: string;
  calorie_stimate: number;
  proteine_g: number;
  carboidrati_g: number;
  grassi_g: number;
}

interface GiornoInfo {
  giorno: number;
  nome_giorno: string;
  pasti: {
    colazione: PastoInfo;
    pranzo: PastoInfo;
    cena: PastoInfo;
  };
}

interface PianoAlimentareData {
  durata_giorni: number;
  giorni: GiornoInfo[];
}

interface RisultatoAPI {
  piano_alimentare?: PianoAlimentareData;
  [key: string]: unknown;
}

interface GeneraPianoFormProps {
  onPianoGenerato?: (piano: RisultatoAPI) => void;
  onCloseAction?: () => void;
}

export default function GeneraPianoForm({
  onPianoGenerato,
  onCloseAction,
}: GeneraPianoFormProps) {
  const [periodoGiorni, setPeriodoGiorni] = useState(14);
  const [preferenze, setPreferenze] = useState("");
  const [esclusioni, setEsclusioni] = useState("");
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrore("");

    try {
      const response = await fetch("/api/genera-piano", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodo_giorni: periodoGiorni,
          preferenze: preferenze
            ? preferenze.split(",").map((p) => p.trim())
            : [],
          esclusioni: esclusioni
            ? esclusioni.split(",").map((e) => e.trim())
            : [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrore(data.error || "Errore nella richiesta");
      } else {
        // Notifica il piano generato al componente parent
        if (onPianoGenerato) {
          onPianoGenerato(data);
        }

        // Chiudi il modal dopo la generazione
        if (onCloseAction) {
          onCloseAction();
        }

        // Reset del form
        setPeriodoGiorni(14);
        setPreferenze("");
        setEsclusioni("");
      }
    } catch {
      setErrore("Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 text-gray-900">
      <div className="mb-6">
        <p className="text-gray-600">
          Crea un piano settimanale personalizzato basato su dati storici e
          preferenze
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Periodo Giorni */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-900">
            Periodo di analisi storica
          </label>
          <input
            type="number"
            min="7"
            max="365"
            value={periodoGiorni}
            onChange={(e) => setPeriodoGiorni(Number(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Inserisci il numero di giorni (7-365)"
          />
          <p className="text-sm text-gray-500">
            Il sistema analizzerà i piani creati negli ultimi {periodoGiorni}{" "}
            giorni per personalizzare le raccomandazioni
          </p>
        </div>

        {/* Preferenze */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-900">
            Preferenze alimentari
            <span className="text-gray-500 font-normal ml-1">(opzionale)</span>
          </label>
          <input
            type="text"
            value={preferenze}
            onChange={(e) => setPreferenze(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="es: vegetariano, mediterraneo, biologico, senza glutine"
          />
          <p className="text-sm text-gray-500">
            Separa le preferenze con virgole. L&apos;AI le utilizzerà per
            personalizzare i suggerimenti
          </p>
        </div>

        {/* Esclusioni */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-900">
            Esclusioni alimentari
            <span className="text-gray-500 font-normal ml-1">(opzionale)</span>
          </label>
          <input
            type="text"
            value={esclusioni}
            onChange={(e) => setEsclusioni(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="es: glutine, lattosio, uova, crostacei, frutta secca"
          />
          <p className="text-sm text-gray-500">
            Indica allergie, intolleranze o alimenti da evitare. Saranno
            completamente esclusi dal piano
          </p>
        </div>

        {/* Errore */}
        {errore && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-1 bg-red-100 rounded-full">
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-red-900 text-sm">
                  Errore nella generazione
                </h4>
                <p className="text-red-700 text-sm mt-1">{errore}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onCloseAction}
            className="flex-1 py-3 px-6 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
            Annulla
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
            }`}>
            {loading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generazione in corso...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span>Genera Piano Alimentare AI</span>
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
