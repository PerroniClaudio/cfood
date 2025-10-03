# 🍽️ API Generazione Piano Alimentare

## Panoramica

L'API `/api/genera-piano` implementa un sistema avanzato di generazione di piani alimentari personalizzati utilizzando tecniche di Retrieval-Augmented Generation (RAG), analisi storica dei dati e intelligenza artificiale.

## 🎯 Architettura del Sistema

La pipeline di generazione è suddivisa in **5 fasi sequenziali**:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   FASE 1    │───▶│   FASE 2    │───▶│   FASE 3    │───▶│   FASE 4    │───▶│   FASE 5    │
│ Validazione │    │   Analisi   │    │  Retrieval  │    │ Contesto    │    │ Generazione │
│   Input     │    │   Storica   │    │   Ibrido    │    │    RAG      │    │ Piano LLM   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## 📋 Endpoint

### POST `/api/genera-piano`

Genera un piano alimentare personalizzato di 7 giorni basato sull'analisi storica dei dati utente.

#### Request Body

```typescript
{
  "periodo_giorni": number,     // Periodo di analisi storica (7-365 giorni)
  "preferenze": string[],       // Array di preferenze alimentari (opzionale)
  "esclusioni": string[]        // Array di alimenti da escludere (opzionale)
}
```

#### Esempio Request

```json
{
  "periodo_giorni": 30,
  "preferenze": ["pesce", "verdure", "integrale"],
  "esclusioni": ["latticini", "glutine", "carne rossa"]
}
```

#### Response Structure

```typescript
{
  // Header della risposta
  success: boolean;
  timestamp: string;
  piano_id: string;
  fase_completata: "FASE_5_PIANO_GENERATO";

  // Parametri della richiesta
  richiesta: {
    periodo_giorni: number;
    preferenze: string[];
    esclusioni: string[];
  };

  // Summary dell'esecuzione
  summary: {
    message: string;
    fasi_completate: string[];
    statistiche_elaborazione: {
      piani_storici_analizzati: number;
      pattern_temporali_identificati: number;
      // ... altre statistiche
    };
  };

  // Risultati analisi storica
  analisi_storica: AnalisiStorica;

  // Risultati retrieval ibrido
  retrieval_ibrido: {
    metodologia: string;
    pasti_raccomandati: RetrievalResult[];
  };

  // Contesto RAG generato
  contesto_rag: {
    stato: string;
    metriche: {
      lunghezza_caratteri: number;
      token_stimati: number;
      utilizzo_percentuale: number;
    };
    testo_completo: string;
  };

  // Piano alimentare generato
  piano_alimentare: {
    id: string;
    stato: string;
    dettagli_generazione: {
      modello_utilizzato: string;
      tempo_elaborazione_ms: number;
      // ... altri dettagli
    };
    piano_completo: PianoAlimentareCompleto;
  };
}
```

## 🔄 Fasi del Processo

### FASE 1: Validazione Input

- Validazione parametri richiesta
- Controllo range periodo_giorni (7-365)
- Validazione array preferenze/esclusioni

### FASE 2: Analisi Storica

Analizza i dati storici dell'utente per identificare pattern e preferenze:

#### Componenti Analizzate:

- **Piani Recenti**: Ultimi piani alimentari nel periodo specificato
- **Statistiche Generali**: Media calorie, distribuzione macronutrienti
- **Top Pasti**: I 10 pasti più frequenti nel periodo
- **Pattern Temporali**: Variazioni nutrizionali per giorno della settimana
- **Preferenze Rilevate**: Categorizzazione automatica degli alimenti

#### Query Principali:

```sql
-- Esempio: Query pattern temporali
SELECT
  giorno_settimana,
  AVG(calorie_totali_kcal) as media_calorie,
  AVG(proteine_totali_g) as media_proteine
FROM dettagli_nutrizionali_giornalieri
WHERE piano_id IN (piani_recenti_ids)
GROUP BY giorno_settimana;
```

### FASE 3: Retrieval Ibrido

Combina due approcci per trovare i pasti più rilevanti:

#### Retrieval per Frequenza (70%)

- Top 8 pasti più utilizzati storicamente
- Score normalizzato basato sulla frequenza

#### Retrieval Semantico (30%)

- Genera embedding della query utente
- Ricerca vettoriale nei pasti del database
- Utilizza pgvector con cosine similarity

#### Formula Score Finale:

```
score_finale = score_frequenza × 0.7 + score_similarità × 0.3
```

### FASE 4: Costruzione Contesto RAG

Formatta tutti i dati in un contesto leggibile per l'LLM:

#### Componenti del Contesto:

1. **Statistiche Storiche**: Profilo nutrizionale con percentuali
2. **Pattern Temporali**: Variazioni settimanali formattate
3. **Preferenze Rilevate**: Categorizzazione ingredienti
4. **Top Pasti Frequenti**: Lista con descrizioni
5. **Pasti Semanticamente Rilevanti**: Con score di similarità

#### Esempio Contesto Generato:

```
=== CONTESTO PER GENERAZIONE PIANO ALIMENTARE ===

PROFILO NUTRIZIONALE:
• Media calorica giornaliera: 1850 kcal
• Proteine: 95g (23%)
• Carboidrati: 220g (52%)
• Grassi: 65g (25%)

PATTERN SETTIMANALI:
• Lunedì: +8% calorie (1998 kcal), +15% proteine (109g)
• Martedì: 1820 kcal standard, 88g proteine
...

TOP 5 PASTI PIÙ FREQUENTI:
1. [Colazione] Avena con frutta e noci (12 volte)
2. [Pranzo] Salmone grigliato con verdure (8 volte)
...
```

### FASE 5: Generazione Piano LLM

Utilizza AWS Bedrock con Claude 3.7 Sonnet per generare il piano:

#### Configurazione LLM:

- **Modello**: `anthropic.claude-3-7-sonnet-20250219-v1:0`
- **Max Tokens**: 8,000
- **Temperature**: 0.7
- **Top P**: 0.9

#### Prompt Structure:

1. **Istruzioni precise** per mantenere pattern storici
2. **Contesto RAG completo** con analisi storica
3. **Vincoli nutrizionali** e preferenze utente
4. **Output JSON strutturato** richiesto

#### Output Finale:

```json
{
  "piano_alimentare": {
    "durata_giorni": 7,
    "data_inizio": "2025-10-03",
    "giorni": [
      {
        "giorno": 1,
        "nome_giorno": "Lunedì",
        "pasti": {
          "colazione": {
            "nome": "Porridge di avena con mirtilli e mandorle",
            "descrizione_dettagliata": "80g avena integrale, 200ml latte di mandorla, 100g mirtilli freschi, 20g mandorle a scaglie, 1 cucchiaino miele",
            "ingredienti": [
              "80g avena integrale",
              "200ml latte mandorla",
              "100g mirtilli",
              "20g mandorle",
              "5g miele"
            ],
            "calorie_stimate": 420,
            "macronutrienti": {
              "proteine_g": 16,
              "carboidrati_g": 52,
              "grassi_g": 14
            }
          }
          // ... pranzo, cena
        }
      }
      // ... 6 giorni restanti
    ]
  }
}
```

## ⚙️ Configurazione

### Variabili d'Ambiente (.env.local)

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=eu-central-1

# Bedrock Configuration
AWS_BEDROCK_MODEL=anthropic.claude-3-7-sonnet-20250219-v1:0

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

### Configurazione Sistema

Le costanti del sistema sono definite in `CONFIG`:

```typescript
const CONFIG = {
  MAX_TOKEN_CONTESTO_RAG: 4000, // Limite token per contesto RAG
  PESO_FREQUENZA_RETRIEVAL: 0.7, // Peso retrieval per frequenza
  PESO_SIMILARITA_RETRIEVAL: 0.3, // Peso retrieval semantico
  LIMITE_TOP_PASTI: 10, // Limite pasti nelle query
  MAX_TOKENS_OUTPUT: 8000, // Max token output LLM
  TEMPERATURE_LLM: 0.7, // Temperatura generazione
  GIORNI_PIANO_RICHIESTI: 7, // Giorni piano fisso
  CARATTERI_PER_TOKEN: 4, // Stima conversione caratteri/token
} as const;
```

## 🔍 Monitoraggio e Debugging

### Log di Sistema

Il sistema produce log dettagliati per ogni fase:

```
🤖 Chiamata Bedrock - Modello base: anthropic.claude-3-7-sonnet-20250219-v1:0
🔄 Usando inference profile per Claude 3.7: us.anthropic.claude-3-7-sonnet-20250219-v1:0
📝 Prompt: 3840 caratteri (960 token stimati)
🚀 Tentativo chiamata Bedrock con modello base...
✅ Risposta ricevuta: 12543 caratteri
📊 Token utilizzati: 960 input + 3136 output
✅ JSON validato con successo
✅ Piano generato con successo in 4250ms
```

### Metriche Incluse nella Risposta

- **Tempo elaborazione**: Per ogni fase e totale
- **Utilizzo token**: Input e output stimati
- **Qualità contesto**: Lunghezza e copertura componenti
- **Score retrieval**: Efficacia della selezione pasti

## 🚨 Gestione Errori

### Errori Comuni

#### 1. Modello non disponibile

```json
{
  "error": "Errore generazione piano con Bedrock: Invocation of model ID ... isn't supported"
}
```

**Soluzione**: Verificare che il modello sia abilitato in AWS Bedrock

#### 2. Contesto troppo lungo

```
Contesto RAG troppo lungo: 17500 caratteri
```

**Soluzione**: Il sistema gestisce automaticamente il troncamento

#### 3. JSON non valido dall'LLM

```json
{
  "error": "Errore parsing JSON dalla risposta LLM: Unexpected token"
}
```

**Soluzione**: Riprovare la chiamata, il sistema ha retry automatici

#### 4. Dati storici insufficienti

```json
{
  "analisi_storica": {
    "statistiche_generali": {
      "totale_piani": 0
    }
  }
}
```

**Soluzione**: Aumentare il `periodo_giorni` o popolare più dati storici

## 🔧 Dipendenze Tecniche

### Database

- **PostgreSQL** con estensione pgvector
- **Drizzle ORM** per query tipizzate
- **Schema**: `piani_alimentari`, `pasti`, `piani_pasti`, `dettagli_nutrizionali_giornalieri`

### AWS Services

- **Bedrock Runtime**: Per chiamate LLM
- **Titan Embeddings**: Per generazione embedding
- **Claude 3.7 Sonnet**: Per generazione piano

### Packages Node.js

- `@aws-sdk/client-bedrock-runtime`
- `drizzle-orm`
- `next.js`

## 📊 Performance

### Metriche Tipiche

- **Tempo totale**: 3-8 secondi
- **Token utilizzati**: 1000-1500 input, 2500-4000 output
- **Dimensione risposta**: 15-25 KB JSON
- **Accuracy contesto**: >95% delle informazioni storiche incluse

### Ottimizzazioni

- Query database parallele in FASE 2
- Cache embedding per query simili
- Validazione incrementale JSON
- Logging asincrono

---

## 📝 Note di Sviluppo

- Sistema progettato per scalabilità orizzontale
- Pattern Repository per separazione logica database
- Type-safe con TypeScript end-to-end
- Configurazione centralizzata per maintenance
- Extensive logging per debugging e monitoring

**Versione API**: 1.0  
**Ultimo aggiornamento**: Ottobre 2025  
**Sviluppato per**: CFood Platform
