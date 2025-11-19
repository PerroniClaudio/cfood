"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, Flame, Scale, Info, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        return "border-amber-200/50 bg-amber-50/40 hover:bg-amber-50/80 dark:bg-amber-950/10 dark:border-amber-900/30 dark:hover:bg-amber-950/20";
      case "pranzo":
        return "border-blue-200/50 bg-blue-50/40 hover:bg-blue-50/80 dark:bg-blue-950/10 dark:border-blue-900/30 dark:hover:bg-blue-950/20";
      case "cena":
        return "border-purple-200/50 bg-purple-50/40 hover:bg-purple-50/80 dark:bg-purple-950/10 dark:border-purple-900/30 dark:hover:bg-purple-950/20";
      default:
        return "border-muted bg-muted/40";
    }
  };

  const getBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case "colazione": return "secondary"; // Amber-ish
      case "pranzo": return "default"; // Blue-ish (primary)
      case "cena": return "outline"; // Purple-ish
      default: return "secondary";
    }
  };

  return (
    <Card
      className={cn(
        "transition-all duration-300 cursor-pointer group overflow-hidden",
        getColorScheme(tipoPasto),
        isExpanded ? "shadow-md ring-1 ring-primary/10 scale-[1.01]" : "shadow-sm hover:shadow-md"
      )}
      onClick={onToggle}
    >
      <CardContent className="p-5">
        {/* Header del pasto */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={cn(
                  "uppercase text-[10px] tracking-wider font-bold border-primary/20",
                  tipoPasto === "colazione" && "text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20",
                  tipoPasto === "pranzo" && "text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/20",
                  tipoPasto === "cena" && "text-purple-600 dark:text-purple-400 bg-purple-100/50 dark:bg-purple-900/20"
                )}
              >
                {tipoPasto}
              </Badge>
              {pasto.difficolta && (
                <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-sm">
                  {pasto.difficolta}
                </Badge>
              )}
            </div>
            <h4 className="font-semibold text-lg leading-tight text-foreground group-hover:text-primary transition-colors">
              {pasto.nome}
            </h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full shrink-0 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Info rapide */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="font-medium text-foreground">{pasto.calorie_stimate} <span className="text-xs text-muted-foreground font-normal">kcal</span></span>
          </div>
          {pasto.tempo_preparazione_minuti && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>{pasto.tempo_preparazione_minuti} <span className="text-xs text-muted-foreground font-normal">min</span></span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium">
              <span className="text-foreground">{pasto.macronutrienti.proteine_g}g</span> P • 
              <span className="text-foreground ml-1">{pasto.macronutrienti.carboidrati_g}g</span> C • 
              <span className="text-foreground ml-1">{pasto.macronutrienti.grassi_g}g</span> G
            </span>
          </div>
        </div>

        {/* Contenuto espandibile */}
        {isExpanded && (
          <div 
            className="mt-5 pt-5 border-t border-border/50 space-y-5 animate-in slide-in-from-top-2 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Descrizione */}
            <div className="bg-background/40 p-3 rounded-lg border border-border/30">
              <h5 className="font-medium text-sm mb-1.5 flex items-center gap-2 text-primary">
                <Info className="w-3.5 h-3.5" /> Descrizione
              </h5>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {pasto.descrizione_dettagliata}
              </p>
            </div>

            {/* Ingredienti */}
            <div>
              <h5 className="font-medium text-sm mb-2.5 text-foreground/90">Ingredienti</h5>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pasto.ingredienti.map((ingrediente, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2 group/ing">
                    <span className="text-primary/40 mt-1.5 group-hover/ing:text-primary transition-colors">•</span>
                    <span className="group-hover/ing:text-foreground transition-colors">{ingrediente}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Preparazione */}
            <div>
              <h5 className="font-medium text-sm mb-1.5 text-foreground/90">Preparazione</h5>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {pasto.metodo_preparazione}
              </p>
            </div>

            {/* Micronutrienti e benefici */}
            {(pasto.micronutrienti_principali ||
              pasto.benefici_nutrizionali) && (
              <div className="grid md:grid-cols-2 gap-4 pt-2">
                {pasto.micronutrienti_principali && (
                  <div className="bg-background/60 rounded-lg p-4 border border-border/50 shadow-sm">
                    <h5 className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-3">
                      Micronutrienti
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {pasto.micronutrienti_principali.map((micro, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="text-xs font-normal bg-background hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
                        >
                          {micro}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {pasto.benefici_nutrizionali && (
                  <div className="bg-background/60 rounded-lg p-4 border border-border/50 shadow-sm">
                    <h5 className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Benefici
                    </h5>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {pasto.benefici_nutrizionali}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
    <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/50 bg-card/50 backdrop-blur-sm">
      {/* Header del giorno */}
      <div className="bg-gradient-to-r from-primary to-purple-600 text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-white">{giorno.nome_giorno}</h3>
            <p className="text-white/80 text-sm font-medium mt-1">
              {new Date(giorno.data).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="text-right bg-white/10 backdrop-blur-md rounded-lg px-4 py-2 border border-white/10">
            <div className="text-2xl font-bold tracking-tighter text-white">
              {giorno.calorie_totali_stimate}
            </div>
            <div className="text-white/70 text-[10px] font-bold uppercase tracking-widest">kcal</div>
          </div>
        </div>

        {/* Macro breakdown del giorno */}
        <div className="relative z-10 mt-6 grid grid-cols-3 gap-4 text-center border-t border-white/10 pt-4">
          <div className="group cursor-default">
            <div className="text-lg font-semibold text-white group-hover:scale-110 transition-transform">{totaleProteine}g</div>
            <div className="text-white/60 text-xs font-medium">
              Proteine ({percProteine}%)
            </div>
          </div>
          <div className="group cursor-default">
            <div className="text-lg font-semibold text-white group-hover:scale-110 transition-transform">{totaleCarboidrati}g</div>
            <div className="text-white/60 text-xs font-medium">
              Carboidrati ({percCarboidrati}%)
            </div>
          </div>
          <div className="group cursor-default">
            <div className="text-lg font-semibold text-white group-hover:scale-110 transition-transform">{totaleGrassi}g</div>
            <div className="text-white/60 text-xs font-medium">
              Grassi ({percGrassi}%)
            </div>
          </div>
        </div>
      </div>

      {/* Pasti del giorno */}
      <CardContent className="p-6 space-y-4 bg-muted/5">
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
      </CardContent>
    </Card>
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
    <div className="max-w-5xl mx-auto space-y-10 pb-16 animate-in fade-in duration-700">
      {/* Header del piano */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <CardContent className="p-10 relative z-10">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 px-3 py-1 border-primary/20 text-primary bg-primary/5">
              Piano Generato da AI
            </Badge>
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground mb-3 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Piano Alimentare Settimanale
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Valido dal <span className="font-semibold text-foreground">{new Date(piano.data_inizio).toLocaleDateString("it-IT")}</span> •{" "}
              Durata di <span className="font-semibold text-foreground">{piano.durata_giorni} giorni</span>
            </p>
          </div>

          {/* Statistiche del piano */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <Card className="bg-blue-50/30 border-blue-100/50 dark:bg-blue-950/10 dark:border-blue-900/30 hover:bg-blue-50/50 transition-colors">
              <CardContent className="p-5">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {mediaCalorie}
                </div>
                <div className="text-blue-700/60 dark:text-blue-300/60 text-[10px] font-bold uppercase tracking-widest">kcal/giorno</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50/30 border-green-100/50 dark:bg-green-950/10 dark:border-green-900/30 hover:bg-green-50/50 transition-colors">
              <CardContent className="p-5">
                <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {(totaleSettimanale / 1000).toFixed(1)}k
                </div>
                <div className="text-green-700/60 dark:text-green-300/60 text-[10px] font-bold uppercase tracking-widest">
                  kcal totali
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50/30 border-purple-100/50 dark:bg-purple-950/10 dark:border-purple-900/30 hover:bg-purple-50/50 transition-colors">
              <CardContent className="p-5">
                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                  {piano.giorni.length}
                </div>
                <div className="text-purple-700/60 dark:text-purple-300/60 text-[10px] font-bold uppercase tracking-widest">giorni</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50/30 border-amber-100/50 dark:bg-amber-950/10 dark:border-amber-900/30 hover:bg-amber-50/50 transition-colors">
              <CardContent className="p-5">
                <div className="text-4xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                  {piano.giorni.length * 3}
                </div>
                <div className="text-amber-700/60 dark:text-amber-300/60 text-[10px] font-bold uppercase tracking-widest">
                  pasti totali
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Note di generazione */}
          {piano.note_generazione && (
            <div className="mt-10 p-6 bg-card/50 rounded-xl border border-border/50 shadow-sm backdrop-blur-sm">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-primary" /> Note dell&apos;Intelligenza Artificiale
              </h3>
              <p className="text-muted-foreground leading-relaxed text-base">{piano.note_generazione}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Griglia dei giorni */}
      <div className="grid gap-10">
        {piano.giorni.map((giorno) => (
          <GiornoCard key={giorno.giorno} giorno={giorno} />
        ))}
      </div>

      {/* Footer con informazioni aggiuntive */}
      <div className="mt-16 text-center text-muted-foreground border-t border-border/40 pt-10 pb-4">
        <p className="text-sm max-w-md mx-auto">
          Piano generato automaticamente da cFood AI. Le informazioni nutrizionali sono stime basate su database standard.
        </p>
      </div>
    </div>
  );
}
