# API Documentation - CFood

## Endpoint Principale

### `POST /api/genera-piano`

Genera un piano alimentare personalizzato completo utilizzando la pipeline a 7 fasi.

#### Request

**URL**: `/api/genera-piano`  
**Method**: `POST`  
**Content-Type**: `application/json`

**Body Parameters:**

```typescript
interface GeneraPianoRequest {
  periodo_giorni: number; // Durata piano (tipicamente 7)
  preferenze?: string[]; // Array preferenze alimentari
  esclusioni?: string[]; // Array esclusioni/allergie
}
```

**Esempio Request:**

```json
{
  "periodo_giorni": 7,
  "preferenze": ["pasta", "verdure di stagione", "pesce azzurro", "legumi"],
  "esclusioni": ["carne rossa", "latticini", "glutine"]
}
```

#### Response

**Status Code**: `200 OK`  
**Content-Type**: `application/json`

**Response Structure:**

```typescript
interface GeneraPianoResponse {
  // === HEADER RISPOSTA ===
  success: true;
  timestamp: string; // ISO timestamp generazione
  piano_id: number; // ID reale piano nel database
  fase_completata: string; // "FASE_7_AGGREGAZIONE_E_SALVATAGGIO_COMPLETATO"

  // === PARAMETRI RICHIESTA ===
  richiesta: {
    periodo_giorni: number;
    preferenze: string[];
    esclusioni: string[];
  };

  // === SUMMARY ESECUZIONE ===
  summary: {
    message: string;
    fasi_completate: string[];
    statistiche_elaborazione: {
      piani_storici_analizzati: number;
      pattern_temporali_identificati: number;
      preferenze_alimentari_rilevate: number;
      top_pasti_frequenti: number;
      pasti_raccomandati_totali: number;
      pasti_con_score_similarita: number;
      pasti_con_dati_frequenza: number;
      // FASE 7 statistics
      piano_id_database: number;
      nuovi_pasti_creati: number;
      relazioni_piano_pasti_create: number;
      embeddings_generati: number;
    };
    tempi_elaborazione: {
      fase_2_analisi_storica_ms: number;
      fase_3_retrieval_ibrido_ms: number;
      fase_5_generazione_bedrock_ms: number;
      fase_6_calcolo_nutrizionale_ms: number;
      fase_7_aggregazione_salvataggio_ms: number;
      totale_pipeline_ms: number;
    };
    utilizzo_ai: {
      modello_generazione: string;
      modello_nutrizionale: string;
      embedding_model: string;
      chiamate_bedrock_totali: number;
      token_input_utilizzati: number;
      token_output_generati: number;
      costo_stimato_usd: number;
    };
  };

  // === DATI ANALISI STORICA (FASE 2) ===
  analisi_storica: {
    piani_recenti: PianoAlimentare[];
    statistiche_generali: StatisticheGenerali;
    top_pasti: TopPasto[];
    pattern_temporali: PatternTemporale[];
    preferenze_rilevate: PreferenzaRilevata[];
  };

  // === PASTI RACCOMANDATI (FASE 3) ===
  pasti_raccomandati: {
    id: string;
    descrizione: string;
    tipo_pasto: "colazione" | "pranzo" | "cena";
    score_finale: number;
    dettagli: {
      frequenza: number;
      score_frequenza: number;
      similarita: number;
      score_similarita: number;
      fonte: "frequenza" | "similarita" | "ibrido";
    };
  }[];

  // === PIANO GENERATO (FASE 5) ===
  piano_generato: {
    piano_alimentare: {
      giorni: {
        giorno: number;
        giorno_settimana: string;
        data: string;
        pasti: {
          colazione: {
            nome: string;
            descrizione: string;
            ingredienti: string[];
            note_preparazione?: string;
          };
          pranzo: {
            nome: string;
            descrizione: string;
            ingredienti: string[];
            note_preparazione?: string;
          };
          cena: {
            nome: string;
            descrizione: string;
            ingredienti: string[];
            note_preparazione?: string;
          };
        };
      }[];
    };
    metadata_ai: {
      modello_utilizzato: string;
      temperatura: number;
      token_input: number;
      token_output: number;
      tempo_elaborazione_ms: number;
      prompt_version: string;
    };
  };

  // === VALORI NUTRIZIONALI (FASE 6) ===
  valori_nutrizionali: {
    valori_giornalieri: {
      giorno_numero: number;
      data_giorno: string;
      giorno_settimana: string;
      pasti: {
        colazione?: ValoriNutrizionaliPasto;
        pranzo?: ValoriNutrizionaliPasto;
        cena?: ValoriNutrizionaliPasto;
      };
      totali_giorno: {
        calorie_totali_kcal: number;
        proteine_totali_g: number;
        carboidrati_totali_g: number;
        grassi_totali_g: number;
        percentuali_macro: {
          proteine_perc: number;
          carboidrati_perc: number;
          grassi_perc: number;
        };
      };
    }[];

    riepilogo_settimanale: {
      calorie_totali_settimana: number;
      media_calorie_giorno: number;
      proteine_totali_settimana_g: number;
      carboidrati_totali_settimana_g: number;
      grassi_totali_settimana_g: number;
      distribuzione_macro_media: {
        proteine_perc: number;
        carboidrati_perc: number;
        grassi_perc: number;
      };
      confronto_con_linee_guida: {
        calorie_range_consigliato: { min: number; max: number };
        proteine_perc_consigliata: { min: number; max: number };
        carboidrati_perc_consigliata: { min: number; max: number };
        grassi_perc_consigliata: { min: number; max: number };
        valutazione_bilanciamento: "ottimale" | "accettabile" | "da_migliorare";
      };
    };

    statistiche_calcolo: {
      pasti_totali_analizzati: number;
      pasti_calcolati_ai: number;
      pasti_stimati_fallback: number;
      pasti_con_errore: number;
      tempo_elaborazione_ms: number;
      modello_ai_utilizzato: string;
      chiamate_ai_totali: number;
      token_utilizzati_totali?: number;
    };
  };
}
```

#### Esempio Response (Abbreviated)

```json
{
  "success": true,
  "timestamp": "2025-10-06T14:30:25.123Z",
  "piano_id": 42,
  "fase_completata": "FASE_7_AGGREGAZIONE_E_SALVATAGGIO_COMPLETATO",

  "richiesta": {
    "periodo_giorni": 7,
    "preferenze": ["pasta", "verdure", "pesce"],
    "esclusioni": ["carne rossa", "latticini"]
  },

  "summary": {
    "message": "✅ Pipeline completa: Piano alimentare generato, calcolato e salvato nel database!",
    "fasi_completate": [
      "FASE_2: Analisi storica dei dati",
      "FASE_3: Retrieval ibrido (frequenza + similarità)",
      "FASE_4: Costruzione contesto RAG",
      "FASE_5: Generazione piano con Bedrock",
      "FASE_6: Calcolo nutrizionale a posteriori",
      "FASE_7: Aggregazione e salvataggio nel database"
    ],
    "statistiche_elaborazione": {
      "piano_id_database": 42,
      "nuovi_pasti_creati": 15,
      "relazioni_piano_pasti_create": 21,
      "embeddings_generati": 15,
      "piani_storici_analizzati": 25,
      "pattern_temporali_identificati": 7,
      "pasti_raccomandati_totali": 150
    },
    "tempi_elaborazione": {
      "fase_2_analisi_storica_ms": 2847,
      "fase_3_retrieval_ibrido_ms": 1253,
      "fase_5_generazione_bedrock_ms": 12459,
      "fase_6_calcolo_nutrizionale_ms": 18324,
      "fase_7_aggregazione_salvataggio_ms": 4892,
      "totale_pipeline_ms": 39775
    },
    "utilizzo_ai": {
      "modello_generazione": "anthropic.claude-3-7-sonnet-20241022-v1:0",
      "modello_nutrizionale": "anthropic.claude-3-7-sonnet-20241022-v1:0",
      "embedding_model": "amazon.titan-embed-text-v2:0",
      "chiamate_bedrock_totali": 23,
      "token_input_utilizzati": 24680,
      "token_output_generati": 8340,
      "costo_stimato_usd": 1.24
    }
  },

  "piano_generato": {
    "piano_alimentare": {
      "giorni": [
        {
          "giorno": 1,
          "giorno_settimana": "Lunedì",
          "data": "2025-10-06",
          "pasti": {
            "colazione": {
              "nome": "Porridge di Avena con Frutti di Bosco",
              "descrizione": "Porridge cremoso di avena integrale con frutti di bosco freschi, semi di chia e un cucchiaino di miele",
              "ingredienti": [
                "80g avena integrale",
                "200ml bevanda vegetale di avena",
                "100g frutti di bosco misti",
                "1 cucchiaino semi di chia",
                "1 cucchiaino miele"
              ],
              "note_preparazione": "Cuocere l'avena con la bevanda vegetale per 5-7 minuti. Aggiungere i frutti di bosco a fine cottura."
            },
            "pranzo": {
              "nome": "Pasta Integrale con Broccoli e Acciughe",
              "descrizione": "Pasta integrale condita con broccoli saltati, acciughe, aglio e olio extravergine di oliva",
              "ingredienti": [
                "120g pasta integrale",
                "200g broccoli",
                "4 filetti di acciughe",
                "2 spicchi aglio",
                "3 cucchiai olio evo",
                "peperoncino q.b."
              ]
            },
            "cena": {
              "nome": "Salmone alla Griglia con Verdure Miste",
              "descrizione": "Filetto di salmone alla griglia accompagnato da verdure miste di stagione saltate",
              "ingredienti": [
                "150g filetto di salmone",
                "200g verdure miste (zucchine, peperoni, melanzane)",
                "2 cucchiai olio evo",
                "erbe aromatiche",
                "limone"
              ]
            }
          }
        }
        // ... altri 6 giorni
      ]
    }
  },

  "valori_nutrizionali": {
    "riepilogo_settimanale": {
      "calorie_totali_settimana": 14350,
      "media_calorie_giorno": 2050,
      "proteine_totali_settimana_g": 735,
      "carboidrati_totali_settimana_g": 1680,
      "grassi_totali_settimana_g": 574,
      "distribuzione_macro_media": {
        "proteine_perc": 20,
        "carboidrati_perc": 47,
        "grassi_perc": 33
      },
      "confronto_con_linee_guida": {
        "valutazione_bilanciamento": "ottimale"
      }
    }
  }
}
```

## Error Responses

### 400 Bad Request

**Cause comuni:**

- Parametri mancanti o non validi
- `periodo_giorni` non nel range supportato
- Format JSON non valido

```json
{
  "error": "Validazione fallita: periodo_giorni deve essere tra 1 e 14",
  "timestamp": "2025-10-06T14:30:25.123Z"
}
```

### 500 Internal Server Error

**Cause comuni:**

- Errore connessione database
- Fallimento chiamate AWS Bedrock
- Errore parsing response AI

```json
{
  "error": "Errore interno del server durante la generazione del piano",
  "timestamp": "2025-10-06T14:30:25.123Z",
  "details": "Errore nella FASE 5 - Generazione piano con Bedrock: ..."
}
```

## Rate Limiting

- **Limite**: 10 richieste per minuto per IP
- **Header response**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Status quando superato**: 429 Too Many Requests

## Performance

### Tempi di Response Tipici

- **Fast response**: 25-35 secondi (cache hit su dati storici)
- **Standard response**: 35-45 secondi (generazione completa)
- **Slow response**: 45-60 secondi (con fallback su AI failures)

### Timeouts

- **Request timeout**: 120 secondi
- **AI generation timeout**: 60 secondi per singola chiamata
- **Database timeout**: 30 secondi per operazione

### Caching

- **Analisi storica**: Cache 1 ora
- **Pattern temporali**: Cache 6 ore
- **Embeddings**: Persistenti nel database

---

## Health Check Endpoint

### `GET /api/health`

Verifica stato del sistema e dipendenze.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-10-06T14:30:25.123Z",
  "services": {
    "database": "connected",
    "bedrock": "accessible",
    "embeddings": "operational"
  },
  "version": "1.0.0"
}
```
