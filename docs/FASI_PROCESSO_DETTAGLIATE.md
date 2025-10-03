# 🔧 Documentazione Tecnica - Fasi del Processo

## FASE 2: Analisi Storica Dettagliata

### Architettura Funzioni

```typescript
// Funzione helper principale
async function getPianiRecentiIds(periodoIntervallo: number): Promise<number[]>;

// Funzioni di analisi
async function getPianiRecenti(
  periodoIntervallo: number
): Promise<PianoAlimentare[]>;
async function getStatisticheGenerali(
  periodoIntervallo: number
): Promise<StatisticheGenerali>;
async function getTopPasti(periodoIntervallo: number): Promise<TopPasto[]>;
async function getPatternTemporali(
  periodoIntervallo: number
): Promise<PatternTemporale[]>;
async function getPreferenzeRilevate(
  periodoIntervallo: number
): Promise<PreferenzaRilevata[]>;

// Funzione orchestratore
async function eseguiAnalisiStorica(
  periodoIntervallo: number
): Promise<AnalisiStorica>;
```

### Query SQL Dettagliate

#### 1. Recupero Piani Recenti

```sql
SELECT id
FROM piani_alimentari
WHERE data_creazione >= $1
ORDER BY data_creazione DESC
```

#### 2. Statistiche Nutrizionali

```sql
SELECT
  AVG(calorie_totali_kcal) as media_calorie,
  AVG(proteine_totali_g) as media_proteine,
  AVG(carboidrati_totali_g) as media_carboidrati,
  AVG(grassi_totali_g) as media_grassi
FROM dettagli_nutrizionali_giornalieri
WHERE piano_id = ANY($1)
```

#### 3. Conteggio Pasti per Tipo

```sql
SELECT
  p.tipo_pasto,
  COUNT(*) as conteggio
FROM piani_pasti pp
INNER JOIN pasti p ON pp.pasto_id = p.id
WHERE pp.piano_id = ANY($1)
GROUP BY p.tipo_pasto
```

#### 4. Top Pasti per Frequenza

```sql
SELECT
  p.id as pasto_id,
  p.descrizione_dettagliata as nome_pasto,
  p.tipo_pasto,
  COUNT(*) as frequenza
FROM piani_pasti pp
INNER JOIN pasti p ON pp.pasto_id = p.id
WHERE pp.piano_id = ANY($1)
GROUP BY p.id, p.descrizione_dettagliata, p.tipo_pasto
ORDER BY COUNT(*) DESC
LIMIT 10
```

#### 5. Pattern Temporali

```sql
SELECT
  giorno_settimana,
  AVG(calorie_totali_kcal) as media_calorie,
  AVG(proteine_totali_g) as media_proteine
FROM dettagli_nutrizionali_giornalieri
WHERE piano_id = ANY($1)
GROUP BY giorno_settimana
ORDER BY giorno_settimana
```

### Strutture Dati Output

#### StatisticheGenerali

```typescript
interface StatisticheGenerali {
  totale_piani: number;
  media_calorie_giornaliere: number;
  distribuzione_macro: {
    proteine_avg: number;
    carboidrati_avg: number;
    grassi_avg: number;
  };
  conteggio_pasti: {
    colazione: number;
    pranzo: number;
    cena: number;
  };
}
```

#### PatternTemporale

```typescript
interface PatternTemporale {
  giorno_settimana: number; // 0=Domenica, 1=Lunedì, etc.
  nome_giorno: string; // "Lunedì", "Martedì", etc.
  media_calorie: number;
  media_proteine: number;
}
```

---

## FASE 3: Retrieval Ibrido Dettagliato

### Algoritmo di Scoring

#### 1. Generazione Embedding Query

```typescript
async function generaEmbeddingQuery(
  preferenze: string[],
  esclusioni: string[]
): Promise<number[]>;
```

**Prompt Template:**

```
Crea piano alimentare bilanciato basato sulle mie abitudini.
Preferenze: [pesce, verdure, integrale]
Escludere: [latticini, glutine]
```

**Modello**: `amazon.titan-embed-text-v2:0`
**Output**: Array di 1024 dimensioni

#### 2. Retrieval per Frequenza

```typescript
async function getTopPastiFrequenza(
  periodoIntervallo: number
): Promise<FrequencyResult[]>;
```

**Score Calculation:**

```typescript
score_frequenza = frequenza_pasto / max_frequenza_periodo;
```

#### 3. Retrieval Semantico

```typescript
async function getTopPastiSimilarita(
  embedding: number[]
): Promise<SimilarityResult[]>;
```

**Query con pgvector:**

```sql
SELECT
  id, descrizione_dettagliata, tipo_pasto,
  1 - (embedding <=> $1::vector) as similarita
FROM pasti
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT 8
```

**Score Calculation:**

```typescript
score_similarita = similarita_cosine / max_similarita_batch;
```

#### 4. Combinazione Ibrida

```typescript
score_finale = score_frequenza × 0.7 + score_similarita × 0.3
```

### Struttura Risultato Retrieval

```typescript
interface RetrievalResult {
  id: number;
  descrizione: string;
  tipo_pasto: string;
  score_finale: number;
  dettagli: {
    frequenza?: number;
    score_frequenza: number;
    similarita?: number;
    score_similarita: number;
    fonte: "frequenza" | "similarita" | "entrambi";
  };
}
```

---

## FASE 4: Costruzione Contesto RAG

### Funzioni di Formattazione

#### 1. Statistiche Storiche

```typescript
function formattaStatisticheStoriche(statistiche: StatisticheGenerali): string;
```

**Output Example:**

```
Analisi storica basata su 15 piani alimentari:

PROFILO NUTRIZIONALE:
• Media calorica giornaliera: 1850 kcal
• Proteine: 95g (23%)
• Carboidrati: 220g (52%)
• Grassi: 65g (25%)

DISTRIBUZIONE PASTI:
• Colazioni: 45 pasti (21%)
• Pranzi: 105 pasti (50%)
• Cene: 60 pasti (29%)
```

#### 2. Pattern Temporali

```typescript
function formattaPatternTemporali(pattern: PatternTemporale[]): string;
```

**Logic:**

```typescript
const variazCalorie =
  ((pasto.media_calorie - mediaGenerale) / mediaGenerale) * 100;
const variazProteine =
  ((pasto.media_proteine - mediaGenerale) / mediaGenerale) * 100;
```

**Output Example:**

```
PATTERN SETTIMANALI:
• Lunedì: +8% calorie (1998 kcal), +15% proteine (109g)
• Martedì: 1820 kcal standard, 88g proteine
• Mercoledì: -5% calorie (1758 kcal), 92g proteine
```

#### 3. Top Pasti Similarità

```typescript
function formattaTopPastiSimilarita(pasti: RetrievalResult[]): string;
```

**Output Example:**

```
TOP 5 PASTI SEMANTICAMENTE RILEVANTI:
1. [Pranzo] Salmone grigliato con quinoa e broccoli
   Similarità: 87%, Score totale: 91%, Freq: 6
2. [Cena] Pollo alle erbe con verdure di stagione
   Similarità: 82%, Score totale: 88%, Freq: 4
```

### Controllo Lunghezza Contesto

```typescript
function assemblaContestoRAG(): string {
  // ... assembla tutte le sezioni

  // Controllo lunghezza (4000 token ≈ 16000 caratteri)
  if (contesto.length > 16000) {
    console.warn(`Contesto RAG troppo lungo: ${contesto.length} caratteri`);
    // Eventuale troncamento se necessario
  }

  return contesto;
}
```

---

## FASE 5: Generazione Piano LLM

### Configurazione Modello

#### Model Selection Logic

```typescript
const getBedrockModel = (): string => {
  const modelFromEnv = process.env.AWS_BEDROCK_MODEL;
  if (!modelFromEnv) {
    throw new Error("Variabile d'ambiente AWS_BEDROCK_MODEL non configurata!");
  }
  return modelFromEnv;
};
```

#### Inference Profile per Claude 3.7

```typescript
// Per Claude 3.7, usa inference profile cross-region
if (modello.includes("claude-3-7-sonnet")) {
  modelIdToUse = `us.${modello}`;
  console.log(`🔄 Usando inference profile per Claude 3.7: ${modelIdToUse}`);
}
```

### Prompt Engineering

#### Template Strutturato

```typescript
function costruisciPromptPianoAlimentare(
  contestoRAG: string,
  preferenze: string[],
  esclusioni: string[]
): string;
```

**Sezioni del Prompt:**

1. **Ruolo e Obiettivo**: Nutrizionista esperto
2. **Istruzioni Precise**: 7 punti specifici
3. **Struttura Output**: JSON schema dettagliato
4. **Contesto Storico**: RAG completo
5. **Trigger Generazione**: Comando finale

**JSON Schema Output:**

```json
{
  "piano_alimentare": {
    "durata_giorni": 7,
    "data_inizio": "2025-10-03",
    "media_calorica_target": 1850,
    "note_generazione": "Spiegazione scelte basate su contesto storico",
    "giorni": [
      {
        "giorno": 1,
        "nome_giorno": "Lunedì",
        "data": "2025-10-03",
        "calorie_totali_stimate": 1874,
        "pasti": {
          "colazione": {
            "nome": "Nome piatto preciso",
            "descrizione_dettagliata": "Descrizione con grammature specifiche",
            "ingredienti": [
              "ingrediente1 (quantità)",
              "ingrediente2 (quantità)"
            ],
            "metodo_preparazione": "Breve descrizione preparazione",
            "calorie_stimate": 420,
            "macronutrienti": {
              "proteine_g": 16,
              "carboidrati_g": 52,
              "grassi_g": 14
            }
          }
          // pranzo, cena...
        }
      }
      // ... giorni 2-7
    ]
  }
}
```

### Parsing e Validazione

#### JSON Cleaning

````typescript
// Rimuovi eventuali markdown wrapper
const jsonString = contenutoRisposta
  .replace(/```json\n?/g, "")
  .replace(/```\n?/g, "")
  .trim();
````

#### Validazioni Strutturali

```typescript
// 1. Controllo oggetto principale
if (!pianoGenerato.piano_alimentare) {
  throw new Error("Struttura JSON non valida: manca 'piano_alimentare'");
}

// 2. Controllo array giorni
if (!Array.isArray(pianoGenerato.piano_alimentare.giorni)) {
  throw new Error("Struttura JSON non valida: manca 'giorni' array");
}

// 3. Controllo numero giorni
if (pianoGenerato.piano_alimentare.giorni.length !== 7) {
  throw new Error(`Piano deve avere 7 giorni, ricevuti: ${length}`);
}
```

### Metriche e Monitoring

#### Metadata Raccolti

```typescript
interface MetadataChiamata {
  modello_utilizzato: string; // Modello effettivamente chiamato (con profile)
  modello_configurato: string; // Modello originale da .env
  lunghezza_prompt: number; // Caratteri totali prompt
  token_input_stimati: number; // Stima token input
  token_output_ricevuti: number; // Token output reali
  tempo_elaborazione_ms: number; // Tempo totale chiamata
}
```

#### Performance Logging

```
🤖 Chiamata Bedrock - Modello base: anthropic.claude-3-7-sonnet-20250219-v1:0
🔄 Usando inference profile per Claude 3.7: us.anthropic.claude-3-7-sonnet-20250219-v1:0
📝 Prompt: 3840 caratteri (960 token stimati)
🚀 Tentativo chiamata Bedrock con modello base...
✅ Risposta ricevuta: 12543 caratteri
📊 Token utilizzati: 960 input + 3136 output
✅ JSON validato con successo
```

---

## Configurazioni Avanzate

### Environment Variables

```bash
# Obbligatorie
AWS_BEDROCK_MODEL=anthropic.claude-3-7-sonnet-20250219-v1:0
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1

# Opzionali (fallback a default)
DATABASE_URL=postgresql://...
```

### Tuning Parametri

#### CONFIG Object

```typescript
const CONFIG = {
  // Retrieval
  PESO_FREQUENZA_RETRIEVAL: 0.7, // Aumenta per favorire pattern storici
  PESO_SIMILARITA_RETRIEVAL: 0.3, // Aumenta per favorire novità

  // LLM
  TEMPERATURE_LLM: 0.7, // 0.1-1.0, creatività vs consistenza
  TOP_P_LLM: 0.9, // 0.1-1.0, diversità token
  MAX_TOKENS_OUTPUT: 8000, // Limite output generazione

  // Quality Control
  MAX_TOKEN_CONTESTO_RAG: 4000, // Limite contesto per non saturare
  GIORNI_PIANO_RICHIESTI: 7, // Piano sempre 7 giorni
} as const;
```

### Troubleshooting

#### Errori Comuni e Soluzioni

1. **"Model ID not supported"**

   - Verificare modello abilitato in AWS Console
   - Controllare inference profile per modelli recenti

2. **"Context too long"**

   - Sistema auto-tronca a 16000 caratteri
   - Ridurre periodo_giorni se necessario

3. **"Invalid JSON from LLM"**

   - Retry automatico implementato
   - Logging completo per debug

4. **"No historical data"**

   - Aumentare periodo_giorni
   - Popolare più dati di base

5. **"Embedding generation failed"**
   - Verifica credenziali AWS
   - Controlla region del servizio Bedrock

---

**Documentazione Versione**: 1.0  
**Compatibilità**: TypeScript 5.0+, Node.js 18+  
**Ultimo Update**: Ottobre 2025
