"use client";

import { useState, useEffect } from "react";
import {
  Utensils,
  Sparkles,
  AlertCircle,
  Info,
  Calendar,
  TrendingUp,
  Clock,
} from "lucide-react";

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

// Tipi per l'elenco dei piani recenti
interface PianoRecente {
  id: number;
  nome: string;
  descrizione?: string | null;
  dataCreazione: string | null;
  dataUltimaModifica: string | null;
  autore: string;
}

export default function Home() {
  const [periodoGiorni, setPeriodoGiorni] = useState(14);
  const [preferenze, setPreferenze] = useState("");
  const [esclusioni, setEsclusioni] = useState("");
  const [loading, setLoading] = useState(false);
  const [risultato, setRisultato] = useState<RisultatoAPI | null>(null);
  const [errore, setErrore] = useState("");
  const [showRawData, setShowRawData] = useState(false);

  // Stato per i piani recenti
  const [pianiRecenti, setPianiRecenti] = useState<PianoRecente[]>([]);
  const [loadingPiani, setLoadingPiani] = useState(false);
  const [pianoSelezionato, setPianoSelezionato] = useState<number | null>(null);

  // Stato per visualizzazione dettagli piano
  const [dettagliPiano, setDettagliPiano] = useState<any>(null);
  const [loadingDettagli, setLoadingDettagli] = useState(false);
  const [modalitaVisualizzazione, setModalitaVisualizzazione] = useState<
    "lista" | "dettagli"
  >("lista");

  // Carica i piani recenti al mount del componente
  useEffect(() => {
    caricaPianiRecenti();
  }, []);

  const caricaPianiRecenti = async () => {
    setLoadingPiani(true);
    try {
      const response = await fetch("/api/piani");
      if (response.ok) {
        const data = await response.json();
        console.log("Dati ricevuti dall'API:", data); // Debug
        if (data.success && data.lista) {
          setPianiRecenti(data.lista);
        } else {
          console.error("Formato dati inaspettato:", data);
          setPianiRecenti([]);
        }
      } else {
        console.error("Errore HTTP:", response.status);
        setPianiRecenti([]);
      }
    } catch (error) {
      console.error("Errore nel caricamento dei piani:", error);
      setPianiRecenti([]);
    } finally {
      setLoadingPiani(false);
    }
  };

  const visualizzaPiano = async (pianoId: number) => {
    setPianoSelezionato(pianoId);
    setLoadingDettagli(true);
    setModalitaVisualizzazione("dettagli");

    try {
      const response = await fetch(`/api/piani/${pianoId}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Dettagli piano ricevuti:", data);
        console.log("Primo pasto di esempio:", data.pasti?.[0]); // Debug specifico
        setDettagliPiano(data);
      } else {
        console.error(
          "Errore nel caricamento dettagli piano:",
          response.status
        );
        setDettagliPiano(null);
      }
    } catch (error) {
      console.error("Errore nel fetch dettagli piano:", error);
      setDettagliPiano(null);
    } finally {
      setLoadingDettagli(false);
    }
  };

  const tornaAllaLista = () => {
    setModalitaVisualizzazione("lista");
    setPianoSelezionato(null);
    setDettagliPiano(null);
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

      // Se non trova il giorno, mettilo alla fine
      if (indiceA === -1) return 1;
      if (indiceB === -1) return -1;

      return indiceA - indiceB;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrore("");
    setRisultato(null);

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
        setRisultato(data);
      }
    } catch {
      setErrore("Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
              <Utensils className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              CFood
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Generatore di piani alimentari intelligente basato su AI e analisi
            storica
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500">
            <Sparkles className="w-4 h-4" />
            <span>Powered by AWS Bedrock</span>
          </div>
        </div>

        {/* Pulsante Torna alla Lista (quando si visualizza un piano) */}
        {modalitaVisualizzazione === "dettagli" && (
          <div className="mb-6">
            <button
              onClick={tornaAllaLista}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
              <span>←</span>
              <span>Torna alla Lista</span>
            </button>
          </div>
        )}

        {/* Contenuto principale condizionale */}
        {modalitaVisualizzazione === "lista" ? (
          <>
            {/* Form di generazione e lista piani */}

            {/* Form Card */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-8 py-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Genera il tuo piano alimentare
                </h2>
                <p className="text-gray-600">
                  Crea un piano settimanale personalizzato basato su dati
                  storici e preferenze
                </p>
              </div>

              <div className="p-8">
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Inserisci il numero di giorni (7-365)"
                    />
                    <p className="text-sm text-gray-500">
                      Il sistema analizzerà i piani creati negli ultimi{" "}
                      {periodoGiorni} giorni per personalizzare le
                      raccomandazioni
                    </p>
                  </div>

                  {/* Preferenze */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">
                      Preferenze alimentari
                      <span className="text-gray-500 font-normal ml-1">
                        (opzionale)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={preferenze}
                      onChange={(e) => setPreferenze(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="es: vegetariano, mediterraneo, biologico, senza glutine"
                    />
                    <p className="text-sm text-gray-500">
                      Separa le preferenze con virgole. L&apos;AI le utilizzerà
                      per personalizzare i suggerimenti
                    </p>
                  </div>

                  {/* Esclusioni */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">
                      Esclusioni alimentari
                      <span className="text-gray-500 font-normal ml-1">
                        (opzionale)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={esclusioni}
                      onChange={(e) => setEsclusioni(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="es: glutine, lattosio, uova, crostacei, frutta secca"
                    />
                    <p className="text-sm text-gray-500">
                      Indica allergie, intolleranze o alimenti da evitare.
                      Saranno completamente esclusi dal piano
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
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
            </div>

            {/* Risultato */}
            {risultato && risultato.piano_alimentare && (
              <div className="space-y-6">
                {/* Success Header */}
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <Sparkles className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-green-900">
                      Piano generato con successo!
                    </h3>
                  </div>
                  <p className="text-green-700">
                    Il tuo piano alimentare personalizzato è pronto. Scorri
                    sotto per visualizzare tutti i dettagli.
                  </p>

                  {/* Toggle Raw Data */}
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => setShowRawData(!showRawData)}
                      className="text-sm text-green-600 hover:text-green-800 underline">
                      {showRawData ? "Nascondi" : "Mostra"} dati tecnici
                    </button>
                  </div>
                </div>

                {/* Piano Alimentare Visualizzato */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">
                    🍽️ Piano Alimentare Generato
                  </h3>

                  {/* Info piano */}
                  {risultato.piano_alimentare && (
                    <div className="mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-blue-50 rounded-lg p-4">
                          <div className="text-2xl font-bold text-blue-600">
                            {risultato.piano_alimentare.durata_giorni || 7}
                          </div>
                          <div className="text-blue-800 text-sm font-medium">
                            Giorni
                          </div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                          <div className="text-2xl font-bold text-green-600">
                            {(risultato.piano_alimentare.durata_giorni || 7) *
                              3}
                          </div>
                          <div className="text-green-800 text-sm font-medium">
                            Pasti totali
                          </div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4">
                          <div className="text-2xl font-bold text-purple-600">
                            {risultato.piano_alimentare.giorni &&
                            risultato.piano_alimentare.giorni.length > 0
                              ? Math.round(
                                  risultato.piano_alimentare.giorni.reduce(
                                    (acc, giorno) =>
                                      acc +
                                      giorno.pasti.colazione.calorie_stimate +
                                      giorno.pasti.pranzo.calorie_stimate +
                                      giorno.pasti.cena.calorie_stimate,
                                    0
                                  ) / risultato.piano_alimentare.giorni.length
                                )
                              : "~2000"}
                          </div>
                          <div className="text-purple-800 text-sm font-medium">
                            kcal/giorno
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Giorni del piano */}
                  {risultato.piano_alimentare?.giorni &&
                    Array.isArray(risultato.piano_alimentare.giorni) && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">
                          Dettaglio Settimanale
                        </h4>
                        <div className="grid gap-6">
                          {risultato.piano_alimentare.giorni
                            .slice(0, 7)
                            .map((giorno: GiornoInfo, index: number) => {
                              const calorieGiorno =
                                giorno.pasti.colazione.calorie_stimate +
                                giorno.pasti.pranzo.calorie_stimate +
                                giorno.pasti.cena.calorie_stimate;

                              return (
                                <div
                                  key={index}
                                  className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                                  <div className="flex justify-between items-center mb-4">
                                    <h5 className="text-lg font-bold text-gray-900">
                                      {giorno.nome_giorno}
                                    </h5>
                                    <div className="text-right">
                                      <div className="text-lg font-semibold text-gray-900">
                                        {calorieGiorno} kcal
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        Giorno {giorno.giorno}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* Colazione */}
                                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                                        <div className="font-bold text-amber-800">
                                          Colazione
                                        </div>
                                        <div className="ml-auto text-sm font-semibold text-amber-700">
                                          {
                                            giorno.pasti.colazione
                                              .calorie_stimate
                                          }{" "}
                                          kcal
                                        </div>
                                      </div>
                                      <div className="text-sm text-amber-900 mb-3 leading-relaxed">
                                        {
                                          giorno.pasti.colazione
                                            .descrizione_dettagliata
                                        }
                                      </div>
                                      <div className="flex gap-3 text-xs text-amber-700">
                                        <span>
                                          P: {giorno.pasti.colazione.proteine_g}
                                          g
                                        </span>
                                        <span>
                                          C:{" "}
                                          {giorno.pasti.colazione.carboidrati_g}
                                          g
                                        </span>
                                        <span>
                                          G: {giorno.pasti.colazione.grassi_g}g
                                        </span>
                                      </div>
                                    </div>

                                    {/* Pranzo */}
                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                                        <div className="font-bold text-blue-800">
                                          Pranzo
                                        </div>
                                        <div className="ml-auto text-sm font-semibold text-blue-700">
                                          {giorno.pasti.pranzo.calorie_stimate}{" "}
                                          kcal
                                        </div>
                                      </div>
                                      <div className="text-sm text-blue-900 mb-3 leading-relaxed">
                                        {
                                          giorno.pasti.pranzo
                                            .descrizione_dettagliata
                                        }
                                      </div>
                                      <div className="flex gap-3 text-xs text-blue-700">
                                        <span>
                                          P: {giorno.pasti.pranzo.proteine_g}g
                                        </span>
                                        <span>
                                          C: {giorno.pasti.pranzo.carboidrati_g}
                                          g
                                        </span>
                                        <span>
                                          G: {giorno.pasti.pranzo.grassi_g}g
                                        </span>
                                      </div>
                                    </div>

                                    {/* Cena */}
                                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                                        <div className="font-bold text-purple-800">
                                          Cena
                                        </div>
                                        <div className="ml-auto text-sm font-semibold text-purple-700">
                                          {giorno.pasti.cena.calorie_stimate}{" "}
                                          kcal
                                        </div>
                                      </div>
                                      <div className="text-sm text-purple-900 mb-3 leading-relaxed">
                                        {
                                          giorno.pasti.cena
                                            .descrizione_dettagliata
                                        }
                                      </div>
                                      <div className="flex gap-3 text-xs text-purple-700">
                                        <span>
                                          P: {giorno.pasti.cena.proteine_g}g
                                        </span>
                                        <span>
                                          C: {giorno.pasti.cena.carboidrati_g}g
                                        </span>
                                        <span>
                                          G: {giorno.pasti.cena.grassi_g}g
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Riepilogo macronutrienti del giorno */}
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="font-medium text-gray-600">
                                        Totali giorno:
                                      </span>
                                      <div className="flex gap-4 text-gray-700">
                                        <span>
                                          Proteine:{" "}
                                          <strong>
                                            {giorno.pasti.colazione.proteine_g +
                                              giorno.pasti.pranzo.proteine_g +
                                              giorno.pasti.cena.proteine_g}
                                            g
                                          </strong>
                                        </span>
                                        <span>
                                          Carboidrati:{" "}
                                          <strong>
                                            {giorno.pasti.colazione
                                              .carboidrati_g +
                                              giorno.pasti.pranzo
                                                .carboidrati_g +
                                              giorno.pasti.cena.carboidrati_g}
                                            g
                                          </strong>
                                        </span>
                                        <span>
                                          Grassi:{" "}
                                          <strong>
                                            {giorno.pasti.colazione.grassi_g +
                                              giorno.pasti.pranzo.grassi_g +
                                              giorno.pasti.cena.grassi_g}
                                            g
                                          </strong>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                  {/* Raw data toggle */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => setShowRawData(!showRawData)}
                      className="text-sm text-gray-600 hover:text-gray-800 underline">
                      {showRawData ? "Nascondi" : "Mostra"} dati completi JSON
                    </button>
                    {showRawData && (
                      <div className="mt-4 bg-gray-50 rounded-lg p-4">
                        <pre className="text-xs text-gray-700 overflow-auto max-h-48">
                          <code>
                            {JSON.stringify(
                              risultato.piano_alimentare,
                              null,
                              2
                            )}
                          </code>
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* Raw Data (nascosto di default) */}
                {showRawData && (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                      <h4 className="font-semibold text-gray-900">
                        Dati Tecnici Complete
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Risposta completa dall&apos;API per debugging e analisi
                      </p>
                    </div>
                    <div className="p-6">
                      <pre className="text-xs text-gray-700 overflow-auto max-h-96 bg-white p-4 rounded-lg border">
                        <code>{JSON.stringify(risultato, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Errore */}
            {errore && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-900">
                      Errore nella generazione
                    </h3>
                    <p className="text-red-700 mt-1">{errore}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Info className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    Come funziona CFood
                  </h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    <p>
                      <span className="font-medium">1. Analisi Storica:</span>{" "}
                      Il sistema analizza i piani alimentari precedenti per
                      comprendere pattern e preferenze
                    </p>
                    <p>
                      <span className="font-medium">2. Retrieval Ibrido:</span>{" "}
                      Combina frequenza storica (70%) e similarità semantica
                      (30%) per selezionare i migliori pasti
                    </p>
                    <p>
                      <span className="font-medium">3. Generazione AI:</span>{" "}
                      Utilizza AWS Bedrock per creare un piano personalizzato
                      basato sui dati raccolti
                    </p>
                    <p>
                      <span className="font-medium">
                        4. Calcolo Nutrizionale:
                      </span>{" "}
                      Analizza automaticamente i valori nutrizionali di ogni
                      pasto del piano
                    </p>
                  </div>
                  <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                    <p className="text-xs text-blue-700">
                      <span className="font-medium">API Endpoint:</span>{" "}
                      <code className="bg-blue-200 px-1 py-0.5 rounded text-xs">
                        /api/genera-piano
                      </code>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualizzatore Piani Recenti */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  📊 Piani Alimentari Recenti
                </h3>
                <button
                  onClick={caricaPianiRecenti}
                  disabled={loadingPiani}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50">
                  {loadingPiani ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Caricamento...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
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
                    Genera il tuo primo piano alimentare utilizzando il form
                    sopra.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pianiRecenti.map((piano) => (
                    <div
                      key={piano.id}
                      className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-blue-300"
                      onClick={() => visualizzaPiano(piano.id)}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">
                              {piano.nome}
                            </h4>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              #{piano.id}
                            </span>
                          </div>
                          {piano.descrizione && (
                            <p className="text-gray-600 mb-3 leading-relaxed">
                              {piano.descrizione}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                Creato:{" "}
                                {piano.dataCreazione
                                  ? new Date(
                                      piano.dataCreazione
                                    ).toLocaleDateString("it-IT")
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
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              visualizzaPiano(piano.id);
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 text-sm font-medium">
                            Visualizza Piano
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Visualizzazione dettagli piano */
          <div className="space-y-6">
            {loadingDettagli ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold text-gray-700">
                  Caricamento dettagli piano...
                </h3>
              </div>
            ) : dettagliPiano ? (
              <div className="space-y-6">
                {/* Header del Piano */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900 mb-2">
                        {dettagliPiano.piano?.nome ||
                          `Piano #${pianoSelezionato}`}
                      </h2>
                      {dettagliPiano.piano?.descrizione && (
                        <p className="text-gray-600 mb-4">
                          {dettagliPiano.piano.descrizione}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>
                          🍽️ {dettagliPiano.giorni?.length || 0} giorni
                        </span>
                        <span>
                          👨‍🍳 {dettagliPiano.piano?.autore || "Sconosciuto"}
                        </span>
                        <span>
                          📅{" "}
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
                              (acc: number, g: any) =>
                                acc + (g.carboidrati || 0),
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
                          ?.filter(
                            (r: any) => r.giornoSettimana === giorno.giorno
                          )
                          ?.sort(
                            (a: any, b: any) =>
                              (a.ordineNelGiorno || 0) -
                              (b.ordineNelGiorno || 0)
                          )
                          ?.map((r: any) =>
                            dettagliPiano.pasti?.find(
                              (p: any) => p.id === r.pastoId
                            )
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
                                  {giorno.carboidrati || 0}g • G:{" "}
                                  {giorno.grassi || 0}g
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Pasti del giorno */}
                          <div className="p-8">
                            {pastiGiorno.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <Utensils className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>
                                  Nessun pasto configurato per questo giorno
                                </p>
                              </div>
                            ) : (
                              <div className="grid gap-6 lg:grid-cols-3">
                                {pastiGiorno.map(
                                  (pasto: any, pastoIndex: number) => {
                                    console.log(
                                      `Debug pasto ${pastoIndex}:`,
                                      pasto
                                    ); // Debug

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
                                          <span>
                                            P: {pasto.proteineG || 0}g
                                          </span>
                                          <span>
                                            C: {pasto.carboidratiG || 0}g
                                          </span>
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
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Errore nel caricamento
                </h3>
                <p className="text-red-700">
                  Non è stato possibile caricare i dettagli del piano
                  selezionato.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
