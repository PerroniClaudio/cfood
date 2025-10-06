# CFood - Sistema AI per Generazione Piani Alimentari

> **Sistema avanzato basato su AI per la generazione automatica di piani alimentari personalizzati utilizzando AWS Bedrock, retrieval ibrido e calcolo nutrizionale intelligente.**

## 🎯 Panoramica del Progetto

CFood è una piattaforma Next.js 14 che implementa una pipeline completa a 7 fasi per la generazione di piani alimentari personalizzati. Il sistema combina analisi storica, retrieval ibrido RAG, AI generativa e calcolo nutrizionale per creare piani alimentari bilanciati e personalizzati.

## 🏗️ Architettura del Sistema

### Pipeline Completa a 7 Fasi

1. **FASE 2: Analisi Storica** 📊

   - Analisi pattern alimentari passati
   - Identificazione preferenze utente
   - Calcolo statistiche nutrizionali storiche

2. **FASE 3: Retrieval Ibrido** 🔍

   - Combinazione frequenza + similarità semantica
   - Vector search con pgvector + PostgreSQL
   - Modello Titan Embed Text v2 (1024 dimensioni)

3. **FASE 4: Costruzione Contesto RAG** 📝

   - Prompt engineering avanzato
   - Sistema prompt template esternalizzato
   - Integrazione dati storici e preferenze

4. **FASE 5: Generazione Piano** 🤖

   - AWS Bedrock con Claude 3.7 Sonnet
   - Generazione piano settimanale strutturato
   - Validazione JSON e controlli qualità

5. **FASE 6: Calcolo Nutrizionale** 🧮

   - Analisi nutrizionale automatica con AI
   - Valori per singoli pasti e aggregati giornalieri
   - Sistema fallback per resilienza

6. **FASE 7: Aggregazione e Salvataggio** 💾
   - Calcolo totali giornalieri e settimanali
   - Persistenza completa nel database
   - Generazione embeddings per search futuro

## 🛠️ Stack Tecnologico

### Frontend & Backend

- **Next.js 14** - Framework full-stack
- **TypeScript** - Type safety e sviluppo robusto
- **Tailwind CSS + DaisyUI** - Styling e componenti UI

### Database & Vector Search

- **PostgreSQL** - Database relazionale principale
- **pgvector** - Estensione per vector similarity search
- **Drizzle ORM** - Type-safe database operations

### AI & Machine Learning

- **AWS Bedrock** - Servizio AI gestito
- **Claude 3.7 Sonnet** - Modello per generazione piani
- **Titan Embed Text v2** - Embeddings per semantic search

### Infrastructure

- **AWS SDK v3** - Integrazione servizi AWS
- **pnpm** - Package manager performante

## 📁 Struttura del Progetto

```
cfood/
├── app/
│   ├── api/
│   │   └── genera-piano/
│   │       └── route.ts           # 🎯 API principale (7 fasi)
│   ├── layout.tsx                 # Layout applicazione
│   └── page.tsx                   # Homepage
├── components/                    # Componenti React riutilizzabili
├── db/
│   ├── index.ts                   # Configurazione database
│   ├── schema.ts                  # Schema Drizzle ORM
│   └── migrations/                # Migrazioni database
├── interfaces/
│   └── database.ts                # Interfacce database
├── lib/
│   ├── analisi-storica.ts         # Utilities analisi dati
│   └── validation.ts              # Validazione input
├── prompts/
│   ├── index.ts                   # Sistema prompt management
│   ├── piano-alimentare.md        # Template generazione piani
│   └── analisi-nutrizionale.md    # Template calcolo nutrizionale
├── types/
│   └── genera-piano.ts            # Interfacce TypeScript complete
└── public/                        # Assets statici
```

## 🗃️ Schema Database

### Tabelle Principali

**piani_alimentari**

- Piano alimentare principale con metadati
- Collegamento a dettagli nutrizionali e pasti

**pasti**

- Catalogo completo pasti con descrizioni
- Valori nutrizionali e embeddings 1024-dim
- Supporto per semantic search

**dettagli_nutrizionali_giornalieri**

- Aggregazioni nutrizionali per giorno
- Totali calorie, proteine, carboidrati, grassi

**piani_pasti**

- Relazioni many-to-many piano ↔ pasti
- Organizzazione per giorno settimana e ordine

## 🚀 API Endpoint Principale

### `POST /api/genera-piano`

**Input:**

```typescript
{
  "periodo_giorni": 7,
  "preferenze": ["pasta", "verdure", "pesce"],
  "esclusioni": ["carne rossa", "latticini"]
}
```

**Output Completo:**

```typescript
{
  "success": true,
  "timestamp": "2025-10-06T...",
  "piano_id": 42,                          // ID reale dal database
  "fase_completata": "FASE_7_AGGREGAZIONE_E_SALVATAGGIO_COMPLETATO",

  "summary": {
    "message": "✅ Pipeline completa: Piano alimentare generato, calcolato e salvato!",
    "fasi_completate": ["FASE_2", "FASE_3", "FASE_4", "FASE_5", "FASE_6", "FASE_7"],
    "statistiche_elaborazione": {
      "piano_id_database": 42,
      "nuovi_pasti_creati": 15,
      "relazioni_piano_pasti_create": 21,
      "embeddings_generati": 15,
      // ... altre statistiche
    }
  },

  "analisi_storica": { /* Dati FASE 2 */ },
  "pasti_raccomandati": [ /* Dati FASE 3 */ ],
  "piano_generato": { /* Dati FASE 5 */ },
  "valori_nutrizionali": { /* Dati FASE 6 */ }
}
```

## ⚙️ Configurazione Ambiente

```bash
# AWS Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BEDROCK_MODEL=anthropic.claude-3-7-sonnet-20241022-v1:0

# Database PostgreSQL con pgvector
DATABASE_URL=postgresql://user:password@localhost:5432/cfood

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🧪 Comandi di Sviluppo

```bash
# Installazione dipendenze
pnpm install

# Sviluppo locale
pnpm dev

# Build produzione
pnpm build

# Verifica types e linting
pnpm lint

# Database migrations
pnpm db:migrate
```

## 🔬 Funzionalità Avanzate

### Sistema Prompt Esternalizzato

- Template markdown configurabili in `/prompts/`
- Separazione logic/content per manutenibilità
- Supporto variabili dinamiche

### Retrieval Ibrido Intelligente

- Combina score frequenza + similarità semantica
- Pesi configurabili per bilanciamento risultati
- Fallback su dati storici se vector search fallisce

### Calcolo Nutrizionale Multi-Livello

- Analisi per singolo pasto con AI
- Aggregazione giornaliera e settimanale
- Confronto con linee guida nutrizionali
- Sistema fallback con valori predefiniti

### Vector Search & Embeddings

- Embeddings 1024-dimensionali per semantic search
- Integrazione pgvector per performance ottimali
- Cosine similarity per matching intelligente

## 🎯 Prossimi Sviluppi

- [ ] **Dashboard Amministrativa** - Gestione piani e analytics
- [ ] **API Utente Finale** - Interfaccia consumo piani
- [ ] **Cache Layer** - Redis per performance
- [ ] **Monitoring** - Metriche AI calls e performance
- [ ] **A/B Testing** - Ottimizzazione prompt e parametri

## 📈 Metriche di Performance

### Tempi di Elaborazione Tipici

- **FASE 2-4**: ~2-3 secondi (analisi + retrieval)
- **FASE 5**: ~8-12 secondi (generazione AI piano)
- **FASE 6**: ~15-25 secondi (calcolo nutrizionale)
- **FASE 7**: ~3-5 secondi (salvataggio + embeddings)
- **TOTALE**: ~30-45 secondi per piano completo

### Utilizzo Risorse AWS

- **Claude 3.7 Sonnet**: ~8 chiamate per piano (1 piano + 7 analisi nutrizionali)
- **Titan Embed**: ~15 chiamate per nuovi pasti
- **Token stimati**: ~25k input + ~8k output per piano

---

## 👥 Sviluppo e Contributi

Questo progetto implementa una architettura modulare e scalabile per la generazione automatica di piani alimentari. Ogni fase è indipendente e testabile, permettendo iterazioni rapide e miglioramenti continui.

**Sviluppato con ❤️ utilizzando Next.js 14, AWS Bedrock, e PostgreSQL + pgvector**
