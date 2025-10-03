"use client";

import { useState } from "react";

export default function Home() {
  const [periodoGiorni, setPeriodoGiorni] = useState(14);
  const [preferenze, setPreferenze] = useState("");
  const [esclusioni, setEsclusioni] = useState("");
  const [loading, setLoading] = useState(false);
  const [risultato, setRisultato] = useState<Record<string, unknown> | null>(
    null
  );
  const [errore, setErrore] = useState("");

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
    <div className="min-h-screen bg-base-200 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">🍽️ CFood</h1>
          <p className="text-lg text-base-content/70">
            Generatore di piani alimentari intelligente
          </p>
        </div>

        {/* Form Card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">
              Genera il tuo piano alimentare
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Periodo Giorni */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Periodo (giorni)
                  </span>
                </label>
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={periodoGiorni}
                  onChange={(e) => setPeriodoGiorni(Number(e.target.value))}
                  className="input input-bordered w-full"
                  placeholder="Inserisci il numero di giorni (7-365)"
                />
                <label className="label">
                  <span className="label-text-alt">
                    Minimo 7 giorni, massimo 365 giorni
                  </span>
                </label>
              </div>

              {/* Preferenze */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Preferenze alimentari (opzionale)
                  </span>
                </label>
                <input
                  type="text"
                  value={preferenze}
                  onChange={(e) => setPreferenze(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="es: vegetariano, mediterraneo, biologico (separati da virgola)"
                />
              </div>

              {/* Esclusioni */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Esclusioni alimentari (opzionale)
                  </span>
                </label>
                <input
                  type="text"
                  value={esclusioni}
                  onChange={(e) => setEsclusioni(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="es: glutine, lattosio, uova (separati da virgola)"
                />
              </div>

              {/* Submit Button */}
              <div className="form-control mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className={`btn btn-primary ${loading ? "loading" : ""}`}>
                  {loading
                    ? "Generazione in corso..."
                    : "Genera Piano Alimentare"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Risultato */}
        {risultato && (
          <div className="card bg-success/10 border border-success/20 mt-6">
            <div className="card-body">
              <h3 className="card-title text-success">
                ✅ Piano generato con successo!
              </h3>
              <div className="mockup-code">
                <pre>
                  <code>{JSON.stringify(risultato, null, 2)}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Errore */}
        {errore && (
          <div className="alert alert-error mt-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{errore}</span>
          </div>
        )}

        {/* Info Card */}
        <div className="card bg-info/10 border border-info/20 mt-6">
          <div className="card-body">
            <h3 className="card-title text-info">ℹ️ Test API</h3>
            <p className="text-sm">
              Questa interfaccia ti permette di testare la route API{" "}
              <code className="bg-base-200 px-2 py-1 rounded">
                /api/genera-piano
              </code>
              per verificare che la validazione e le configurazioni funzionino
              correttamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
