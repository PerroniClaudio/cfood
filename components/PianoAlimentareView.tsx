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
        return "bg-white dark:bg-zinc-900 border-2 border-border hover:shadow-neo hover:-translate-y-1";
      case "pranzo":
        return "bg-white dark:bg-zinc-900 border-2 border-border hover:shadow-neo hover:-translate-y-1";
      case "cena":
        return "bg-white dark:bg-zinc-900 border-2 border-border hover:shadow-neo hover:-translate-y-1";
      default:
        return "bg-muted border-2 border-border";
    }
  };

  const getBadgeStyle = (tipo: string) => {
    switch (tipo) {
      case "colazione": return "bg-muted text-muted-foreground border-2 border-border";
      case "pranzo": return "bg-primary text-primary-foreground border-2 border-border";
      case "cena": return "bg-secondary text-secondary-foreground border-2 border-border";
      default: return "bg-muted text-muted-foreground border-2 border-border";
    }
  };

  return (
    <Card
      className={cn(
        "transition-all duration-200 cursor-pointer group overflow-hidden rounded-lg",
        getColorScheme(tipoPasto),
        isExpanded ? "shadow-neo -translate-y-1 ring-2 ring-border" : "shadow-none"
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
                  "uppercase text-[10px] tracking-wider font-black rounded-sm shadow-neo-sm",
                  getBadgeStyle(tipoPasto)
                )}
              >
                {tipoPasto}
              </Badge>
              {pasto.difficolta && (
                <Badge variant="outline" className="text-[10px] font-bold bg-background border-2 border-border shadow-neo-sm">
                  {pasto.difficolta}
                </Badge>
              )}
            </div>
            <h4 className="font-black text-lg leading-tight text-foreground uppercase">
              {pasto.nome}
            </h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md border-2 border-transparent hover:border-border hover:shadow-neo transition-all"
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
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold border-t-2 border-border/10 pt-3">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-foreground" />
            <span className="text-foreground">{pasto.calorie_stimate} <span className="text-xs text-muted-foreground font-normal uppercase">kcal</span></span>
          </div>
          {pasto.tempo_preparazione_minuti && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-foreground" />
              <span>{pasto.tempo_preparazione_minuti} <span className="text-xs text-muted-foreground font-normal uppercase">min</span></span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-foreground" />
            <span className="text-xs font-bold">
              <span className="text-foreground">{pasto.macronutrienti.proteine_g}g</span> P • 
              <span className="text-foreground ml-1">{pasto.macronutrienti.carboidrati_g}g</span> C • 
              <span className="text-foreground ml-1">{pasto.macronutrienti.grassi_g}g</span> G
            </span>
          </div>
        </div>

        {/* Contenuto espandibile */}
        {isExpanded && (
          <div 
            className="mt-5 pt-5 border-t-2 border-border space-y-5 animate-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Descrizione */}
            <div className="bg-muted/30 p-4 rounded-none border-2 border-border shadow-neo-sm">
              <h5 className="font-black text-sm mb-1.5 flex items-center gap-2 text-foreground uppercase">
                <Info className="w-3.5 h-3.5" /> Descrizione
              </h5>
              <p className="text-sm text-foreground font-medium leading-relaxed">
                {pasto.descrizione_dettagliata}
              </p>
            </div>

            {/* Ingredienti */}
            <div>
              <h5 className="font-black text-sm mb-2.5 text-foreground uppercase border-b-2 border-border inline-block">Ingredienti</h5>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pasto.ingredienti.map((ingrediente, idx) => (
                  <li key={idx} className="text-sm font-medium text-foreground flex items-start gap-2">
                    <span className="text-primary mt-1.5 font-bold">■</span>
                    <span>{ingrediente}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Preparazione */}
            <div>
              <h5 className="font-black text-sm mb-1.5 text-foreground uppercase border-b-2 border-border inline-block">Preparazione</h5>
              <p className="text-sm text-foreground font-medium leading-relaxed">
                {pasto.metodo_preparazione}
              </p>
            </div>

            {/* Micronutrienti e benefici */}
            {(pasto.micronutrienti_principali ||
              pasto.benefici_nutrizionali) && (
              <div className="grid md:grid-cols-2 gap-4 pt-2">
                {pasto.micronutrienti_principali && (
                  <div className="bg-background rounded-none p-4 border-2 border-border shadow-neo-sm">
                    <h5 className="font-black text-xs uppercase tracking-wider text-foreground mb-3">
                      Micronutrienti
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {pasto.micronutrienti_principali.map((micro, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="text-xs font-bold bg-accent text-accent-foreground border-2 border-border rounded-sm"
                        >
                          {micro}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {pasto.benefici_nutrizionali && (
                  <div className="bg-background rounded-none p-4 border-2 border-border shadow-neo-sm">
                    <h5 className="font-black text-xs uppercase tracking-wider text-foreground mb-2">
                      Benefici
                    </h5>
                    <p className="text-sm text-foreground font-medium leading-relaxed">
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
    <Card className="overflow-hidden border-2 border-border shadow-neo-lg bg-card">
      {/* Header del giorno */}
      <div className="bg-foreground text-background p-6 relative overflow-hidden border-b-2 border-border">
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h3 className="text-3xl font-black tracking-tighter text-background uppercase">{giorno.nome_giorno}</h3>
            <p className="text-background/80 text-sm font-bold mt-1 uppercase">
              {new Date(giorno.data).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="text-right bg-background text-foreground rounded-none px-4 py-2 border-2 border-border shadow-neo-sm">
            <div className="text-2xl font-black tracking-tighter">
              {giorno.calorie_totali_stimate}
            </div>
            <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">kcal</div>
          </div>
        </div>

        {/* Macro breakdown del giorno */}
        <div className="relative z-10 mt-6 grid grid-cols-3 gap-4 text-center border-t-2 border-background/20 pt-4">
          <div className="group cursor-default">
            <div className="text-lg font-black text-background">{totaleProteine}g</div>
            <div className="text-background/60 text-xs font-bold uppercase">
              Proteine ({percProteine}%)
            </div>
          </div>
          <div className="group cursor-default">
            <div className="text-lg font-black text-background">{totaleCarboidrati}g</div>
            <div className="text-background/60 text-xs font-bold uppercase">
              Carboidrati ({percCarboidrati}%)
            </div>
          </div>
          <div className="group cursor-default">
            <div className="text-lg font-black text-background">{totaleGrassi}g</div>
            <div className="text-background/60 text-xs font-bold uppercase">
              Grassi ({percGrassi}%)
            </div>
          </div>
        </div>
      </div>

      {/* Pasti del giorno */}
      <CardContent className="p-6 space-y-4 bg-background">
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
      <Card className="border-2 border-border shadow-neo-lg bg-card overflow-hidden relative">
        <CardContent className="p-10 relative z-10">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 px-3 py-1 border-2 border-border text-foreground bg-primary font-bold shadow-neo-sm">
              PIANO GENERATO DA AI
            </Badge>
            <h1 className="text-5xl font-black tracking-tighter text-foreground mb-3 uppercase">
              Piano Alimentare Settimanale
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-medium border-2 border-border p-2 inline-block bg-background shadow-neo-sm">
              DAL <span className="font-bold text-foreground">{new Date(piano.data_inizio).toLocaleDateString("it-IT")}</span> •{" "}
              DURATA: <span className="font-bold text-foreground">{piano.durata_giorni} GIORNI</span>
            </p>
          </div>

          {/* Statistiche del piano */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <Card className="bg-accent border-2 border-border shadow-neo hover:-translate-y-1 transition-transform">
              <CardContent className="p-5">
                <div className="text-4xl font-black text-accent-foreground mb-1">
                  {mediaCalorie}
                </div>
                <div className="text-accent-foreground font-bold uppercase tracking-widest text-xs border-t-2 border-accent-foreground/20 pt-2 mt-2">kcal/giorno</div>
              </CardContent>
            </Card>
            <Card className="bg-primary border-2 border-border shadow-neo hover:-translate-y-1 transition-transform">
              <CardContent className="p-5">
                <div className="text-4xl font-black text-primary-foreground mb-1">
                  {(totaleSettimanale / 1000).toFixed(1)}k
                </div>
                <div className="text-primary-foreground font-bold uppercase tracking-widest text-xs border-t-2 border-primary-foreground/20 pt-2 mt-2">
                  kcal totali
                </div>
              </CardContent>
            </Card>
            <Card className="bg-secondary border-2 border-border shadow-neo hover:-translate-y-1 transition-transform">
              <CardContent className="p-5">
                <div className="text-4xl font-black text-secondary-foreground mb-1">
                  {piano.giorni.length}
                </div>
                <div className="text-secondary-foreground font-bold uppercase tracking-widest text-xs border-t-2 border-secondary-foreground/20 pt-2 mt-2">giorni</div>
              </CardContent>
            </Card>
            <Card className="bg-muted border-2 border-border shadow-neo hover:-translate-y-1 transition-transform">
              <CardContent className="p-5">
                <div className="text-4xl font-black text-muted-foreground mb-1">
                  {piano.giorni.length * 3}
                </div>
                <div className="text-muted-foreground font-bold uppercase tracking-widest text-xs border-t-2 border-muted-foreground/20 pt-2 mt-2">
                  pasti totali
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Note di generazione */}
          {piano.note_generazione && (
            <div className="mt-10 p-6 bg-background rounded-none border-2 border-border shadow-neo">
              <h3 className="font-black text-foreground mb-3 flex items-center gap-2 text-lg uppercase">
                <Sparkles className="w-5 h-5 text-foreground" /> Note dell&apos;Intelligenza Artificiale
              </h3>
              <p className="text-muted-foreground leading-relaxed text-base font-medium">{piano.note_generazione}</p>
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
      <div className="mt-16 text-center text-muted-foreground border-t-2 border-border pt-10 pb-4">
        <p className="text-sm max-w-md mx-auto font-bold uppercase">
          Piano generato automaticamente da cFood AI.
        </p>
      </div>
    </div>
  );
}
