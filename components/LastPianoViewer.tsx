"use client";

import { useState, useEffect } from "react";
import { Eye, Calendar, Loader2, ArrowLeft, History } from "lucide-react";
import PianoAlimentareView from "./PianoAlimentareView";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between sticky top-4 z-50 bg-background/80 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPianoSelezionato(null)}
            className="gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna ai piani
          </Button>
          <Badge variant="outline" className="text-xs font-mono">
            ID: {pianoSelezionato.piano_id}
          </Badge>
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
    <Card className="w-full mt-10 border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <History className="w-5 h-5" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Piani Alimentari Recenti</CardTitle>
        </div>
        <CardDescription className="text-base">
          Visualizza e gestisci i tuoi piani alimentari generati in precedenza.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm animate-pulse">Caricamento piani...</p>
          </div>
        ) : pianiRecenti.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border/60 rounded-xl bg-muted/5">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">
              Nessun piano trovato
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Non hai ancora generato nessun piano alimentare. Usa il form sopra per iniziare.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pianiRecenti.slice(0, 5).map((piano, index) => (
              <Card
                key={piano.id}
                className="group overflow-hidden border-border/40 bg-card/50 hover:bg-card hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">{piano.nome}</h4>
                      <Badge variant="secondary" className="text-[10px] font-normal bg-secondary/50">
                        {piano.autore}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 group-hover:text-muted-foreground/80 transition-colors">
                      {piano.descrizione}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground/70 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(piano.dataCreazione).toLocaleDateString(
                          "it-IT",
                          { day: 'numeric', month: 'long', year: 'numeric' }
                        )}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => visualizzaPiano(piano.id)}
                    disabled={loadingDettaglio}
                    className="shrink-0 bg-background hover:bg-primary hover:text-primary-foreground text-foreground border border-input shadow-sm group-hover:border-primary/50 transition-all duration-300"
                  >
                    {loadingDettaglio ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizza
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}

            {pianiRecenti.length > 5 && (
              <div className="text-center pt-6">
                <Button variant="ghost" onClick={caricaPianiRecenti} className="text-muted-foreground hover:text-primary">
                  Carica altri piani ({pianiRecenti.length - 5} rimanenti)
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

