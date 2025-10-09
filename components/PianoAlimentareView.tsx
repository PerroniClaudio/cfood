"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, Flame, Scale } from "lucide-react";

interface PastoDettaglio {
  nome: string;
  descrizione_dettagliata: string;
  ingredienti: string[];
  metodo_preparazione: string;
  calorie_stimate: number;
  tempo_preparazione_minuti?: number;
  difficolta?: string;
  macronutrienti: {
    proteine_g: number;
    carboidrati_g: number;
    grassi_g: number;
  };
  micronutrienti_principali?: string[];
  benefici_nutrizionali?: string;
}

interface GiornoAlimentare {
  giorno: number;
  nome_giorno: string;
  data: string;
  calorie_totali_stimate: number;
  pasti: {
    colazione: PastoDettaglio;
    pranzo: PastoDettaglio;
    cena: PastoDettaglio;
  };
}

interface PianoAlimentare {
  durata_giorni: number;
  data_inizio: string;
  media_calorica_target: string;
  note_generazione: string;
  giorni: GiornoAlimentare[];
}

interface Props {
  pianoData: {
    piano_alimentare: PianoAlimentare;
    summary?: {
      media_calorie_giorno: number;
      pasti_analizzati_nutrizionalmente: number;
    };
    [key: string]: unknown;
  };
}

const PastoCard = ({
  pasto,
  tipoPasto,
  isExpanded,
  onToggle,
}: {
  pasto: PastoDettaglio;
  tipoPasto: string;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const getColorScheme = (tipo: string) => {
    switch (tipo) {
      case "colazione":
        return {
          bg: "bg-amber-50",
          border: "border-amber-200",
          icon: "text-amber-600",
          badge: "bg-amber-100 text-amber-800",
        };
      case "pranzo":
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          icon: "text-blue-600",
          badge: "bg-blue-100 text-blue-800",
        };
      case "cena":
        return {
          bg: "bg-purple-50",
          border: "border-purple-200",
          icon: "text-purple-600",
          badge: "bg-purple-100 text-purple-800",
        };
      default:
        return {
          bg: "bg-gray-50",
          border: "border-gray-200",
          icon: "text-gray-600",
          badge: "bg-gray-100 text-gray-800",
        };
    }
  };

  const colors = getColorScheme(tipoPasto);

  return (
    <div
      className={`${colors.bg} ${colors.border} border rounded-lg p-4 transition-all duration-200`}>
      {/* Header del pasto */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`${colors.badge} px-2 py-1 rounded-full text-xs font-medium uppercase`}>
              {tipoPasto}
            </span>
            {pasto.difficolta && (
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                {pasto.difficolta}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-lg text-gray-900 mb-1">
            {pasto.nome}
          </h4>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-white rounded-full transition-colors">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      {/* Info rapide */}
      <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <Flame className={`w-4 h-4 ${colors.icon}`} />
          <span className="font-medium">{pasto.calorie_stimate} kcal</span>
        </div>
        {pasto.tempo_preparazione_minuti && (
          <div className="flex items-center gap-1">
            <Clock className={`w-4 h-4 ${colors.icon}`} />
            <span>{pasto.tempo_preparazione_minuti} min</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Scale className={`w-4 h-4 ${colors.icon}`} />
          <span>
            P:{pasto.macronutrienti.proteine_g}g | C:
            {pasto.macronutrienti.carboidrati_g}g | G:
            {pasto.macronutrienti.grassi_g}g
          </span>
        </div>
      </div>

      {/* Contenuto espandibile */}
      {isExpanded && (
        <div className="space-y-4 pt-3 border-t border-gray-200">
          {/* Descrizione */}
          <div>
            <h5 className="font-medium text-gray-900 mb-2">Descrizione</h5>
            <p className="text-gray-700 text-sm leading-relaxed">
              {pasto.descrizione_dettagliata}
            </p>
          </div>

          {/* Ingredienti */}
          <div>
            <h5 className="font-medium text-gray-900 mb-2">Ingredienti</h5>
            <ul className="space-y-1">
              {pasto.ingredienti.map((ingrediente, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex">
                  <span className="text-gray-400 mr-2">•</span>
                  <span>{ingrediente}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Preparazione */}
          <div>
            <h5 className="font-medium text-gray-900 mb-2">Preparazione</h5>
            <p className="text-gray-700 text-sm leading-relaxed">
              {pasto.metodo_preparazione}
            </p>
          </div>

          {/* Micronutrienti e benefici */}
          {(pasto.micronutrienti_principali || pasto.benefici_nutrizionali) && (
            <div className="grid md:grid-cols-2 gap-4">
              {pasto.micronutrienti_principali && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">
                    Micronutrienti principali
                  </h5>
                  <div className="flex flex-wrap gap-1">
                    {pasto.micronutrienti_principali.map((micro, idx) => (
                      <span
                        key={idx}
                        className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                        {micro}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {pasto.benefici_nutrizionali && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Benefici</h5>
                  <p className="text-gray-700 text-sm">
                    {pasto.benefici_nutrizionali}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const GiornoCard = ({ giorno }: { giorno: GiornoAlimentare }) => {
  const [expandedPasto, setExpandedPasto] = useState<string | null>(null);

  const togglePasto = (tipoPasto: string) => {
    setExpandedPasto(expandedPasto === tipoPasto ? null : tipoPasto);
  };

  // Calcola percentuali macro del giorno
  const totaleProteine =
    giorno.pasti.colazione.macronutrienti.proteine_g +
    giorno.pasti.pranzo.macronutrienti.proteine_g +
    giorno.pasti.cena.macronutrienti.proteine_g;
  const totaleCarboidrati =
    giorno.pasti.colazione.macronutrienti.carboidrati_g +
    giorno.pasti.pranzo.macronutrienti.carboidrati_g +
    giorno.pasti.cena.macronutrienti.carboidrati_g;
  const totaleGrassi =
    giorno.pasti.colazione.macronutrienti.grassi_g +
    giorno.pasti.pranzo.macronutrienti.grassi_g +
    giorno.pasti.cena.macronutrienti.grassi_g;

  const calorieDaMacro =
    totaleProteine * 4 + totaleCarboidrati * 4 + totaleGrassi * 9;
  const percProteine =
    calorieDaMacro > 0
      ? Math.round(((totaleProteine * 4) / calorieDaMacro) * 100)
      : 0;
  const percCarboidrati =
    calorieDaMacro > 0
      ? Math.round(((totaleCarboidrati * 4) / calorieDaMacro) * 100)
      : 0;
  const percGrassi =
    calorieDaMacro > 0
      ? Math.round(((totaleGrassi * 9) / calorieDaMacro) * 100)
      : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header del giorno */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">{giorno.nome_giorno}</h3>
            <p className="text-indigo-100 text-sm">
              {new Date(giorno.data).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {giorno.calorie_totali_stimate}
            </div>
            <div className="text-indigo-100 text-sm">kcal totali</div>
          </div>
        </div>

        {/* Macro breakdown del giorno */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold">{totaleProteine}g</div>
            <div className="text-indigo-200 text-xs">
              Proteine ({percProteine}%)
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold">{totaleCarboidrati}g</div>
            <div className="text-indigo-200 text-xs">
              Carboidrati ({percCarboidrati}%)
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold">{totaleGrassi}g</div>
            <div className="text-indigo-200 text-xs">
              Grassi ({percGrassi}%)
            </div>
          </div>
        </div>
      </div>

      {/* Pasti del giorno */}
      <div className="p-6 space-y-4">
        <PastoCard
          pasto={giorno.pasti.colazione}
          tipoPasto="colazione"
          isExpanded={expandedPasto === "colazione"}
          onToggle={() => togglePasto("colazione")}
        />
        <PastoCard
          pasto={giorno.pasti.pranzo}
          tipoPasto="pranzo"
          isExpanded={expandedPasto === "pranzo"}
          onToggle={() => togglePasto("pranzo")}
        />
        <PastoCard
          pasto={giorno.pasti.cena}
          tipoPasto="cena"
          isExpanded={expandedPasto === "cena"}
          onToggle={() => togglePasto("cena")}
        />
      </div>
    </div>
  );
};

export default function PianoAlimentareView({ pianoData }: Props) {
  const piano = pianoData.piano_alimentare;

  // Calcola statistiche del piano
  const mediaCalorie = Math.round(
    piano.giorni.reduce((sum, g) => sum + g.calorie_totali_stimate, 0) /
      piano.giorni.length
  );

  const totaleSettimanale = piano.giorni.reduce(
    (sum, g) => sum + g.calorie_totali_stimate,
    0
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header del piano */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🍽️ Piano Alimentare Settimanale
          </h1>
          <p className="text-gray-600">
            Dal {new Date(piano.data_inizio).toLocaleDateString("it-IT")} •{" "}
            {piano.durata_giorni} giorni
          </p>
        </div>

        {/* Statistiche del piano */}
        <div className="grid md:grid-cols-4 gap-6 text-center">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">
              {mediaCalorie}
            </div>
            <div className="text-blue-800 text-sm font-medium">kcal/giorno</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {totaleSettimanale}
            </div>
            <div className="text-green-800 text-sm font-medium">
              kcal totali
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">
              {piano.giorni.length}
            </div>
            <div className="text-purple-800 text-sm font-medium">giorni</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-amber-600">21</div>
            <div className="text-amber-800 text-sm font-medium">
              pasti totali
            </div>
          </div>
        </div>

        {/* Note di generazione */}
        {piano.note_generazione && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Note AI</h3>
            <p className="text-gray-700 text-sm">{piano.note_generazione}</p>
          </div>
        )}
      </div>

      {/* Griglia dei giorni */}
      <div className="grid gap-8">
        {piano.giorni.map((giorno) => (
          <GiornoCard key={giorno.giorno} giorno={giorno} />
        ))}
      </div>

      {/* Footer con informazioni aggiuntive */}
      <div className="mt-8 bg-gray-50 rounded-xl p-6 text-center text-gray-600">
        <p className="text-sm">
          Piano generato automaticamente dall&apos;intelligenza artificiale • Le
          informazioni nutrizionali sono indicative • Consulta un nutrizionista
          per piani personalizzati
        </p>
      </div>
    </div>
  );
}
