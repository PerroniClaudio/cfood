"use client";

import { useState } from "react";
import { Sparkles, AlertCircle, Loader2, Calendar, Utensils, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    <Card className="w-full border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
            Genera Piano Alimentare
          </CardTitle>
        </div>
        <CardDescription className="text-base">
          Crea un piano settimanale personalizzato basato su dati storici e
          preferenze.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Periodo Giorni */}
          <div className="space-y-2 group">
            <Label htmlFor="periodo" className="text-sm font-medium flex items-center gap-2 text-foreground/80 group-focus-within:text-primary transition-colors">
              <Calendar className="w-4 h-4" />
              Periodo di analisi storica
            </Label>
            <div className="relative">
              <Input
                id="periodo"
                type="number"
                min="7"
                max="365"
                value={periodoGiorni}
                onChange={(e) => setPeriodoGiorni(Number(e.target.value))}
                className="pl-4 transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Inserisci il numero di giorni (7-365)"
              />
            </div>
            <p className="text-xs text-muted-foreground pl-1">
              Il sistema analizzerà i piani creati negli ultimi <span className="font-medium text-foreground">{periodoGiorni}</span> giorni.
            </p>
          </div>

          {/* Preferenze */}
          <div className="space-y-2 group">
            <Label htmlFor="preferenze" className="text-sm font-medium flex items-center gap-2 text-foreground/80 group-focus-within:text-primary transition-colors">
              <Utensils className="w-4 h-4" />
              Preferenze alimentari
              <span className="text-muted-foreground font-normal text-xs ml-auto">
                (opzionale)
              </span>
            </Label>
            <Input
              id="preferenze"
              type="text"
              value={preferenze}
              onChange={(e) => setPreferenze(e.target.value)}
              className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="es: vegetariano, mediterraneo, biologico"
            />
            <p className="text-xs text-muted-foreground pl-1">
              Separa le preferenze con virgole.
            </p>
          </div>

          {/* Esclusioni */}
          <div className="space-y-2 group">
            <Label htmlFor="esclusioni" className="text-sm font-medium flex items-center gap-2 text-foreground/80 group-focus-within:text-destructive transition-colors">
              <Ban className="w-4 h-4" />
              Esclusioni alimentari
              <span className="text-muted-foreground font-normal text-xs ml-auto">
                (opzionale)
              </span>
            </Label>
            <Input
              id="esclusioni"
              type="text"
              value={esclusioni}
              onChange={(e) => setEsclusioni(e.target.value)}
              className="transition-all duration-300 focus:ring-2 focus:ring-destructive/20 focus:border-destructive"
              placeholder="es: glutine, lattosio, uova"
            />
            <p className="text-xs text-muted-foreground pl-1">
              Indica allergie o alimenti da evitare.
            </p>
          </div>

          {/* Errore */}
          {errore && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3 text-destructive animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4" />
              <div className="text-sm font-medium">{errore}</div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 hover:bg-muted/50 transition-colors"
              onClick={onCloseAction}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              className={cn(
                "flex-1 text-white border-0 transition-all duration-300 shadow-lg hover:shadow-primary/25",
                "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90",
                loading && "opacity-80"
              )}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Genera Piano AI
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
