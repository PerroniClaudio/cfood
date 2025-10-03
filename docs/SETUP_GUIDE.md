# 🚀 Guida Setup - API Generazione Piano Alimentare

## Prerequisiti

### Sistema

- **Node.js**: 18.0+
- **pnpm**: 8.0+
- **PostgreSQL**: 14+ con estensione pgvector
- **TypeScript**: 5.0+

### Servizi AWS

- **Account AWS** attivo
- **AWS Bedrock** abilitato in regione `eu-central-1`
- **Claude 3.7 Sonnet** attivato nel model access
- **Titan Embeddings** attivato per generazione embedding

## 🔧 Setup Ambiente di Sviluppo

### 1. Clone e Dipendenze

```bash
git clone <repository>
cd cfood/app/cfood
pnpm install
```

### 2. Configurazione Database

#### Setup PostgreSQL con pgvector

```sql
-- Connessione al database come superuser
CREATE EXTENSION IF NOT EXISTS vector;

-- Verifica installazione
SELECT * FROM pg_extension WHERE extname = 'vector';
```

#### Schema Richiesto

Le tabelle necessarie devono essere già create tramite Drizzle migrations:

- `piani_alimentari`
- `pasti` (con colonna `embedding` di tipo `vector(1024)`)
- `piani_pasti`
- `dettagli_nutrizionali_giornalieri`

```bash
# Esegui migrations
pnpm drizzle-kit migrate
```

### 3. Configurazione AWS

#### AWS CLI Setup

```bash
aws configure
# Inserisci:
# AWS Access Key ID: [il tuo access key]
# AWS Secret Access Key: [il tuo secret key]
# Default region name: eu-central-1
# Default output format: json
```

#### Verifica Accesso Bedrock

```bash
aws bedrock list-foundation-models --region eu-central-1
```

Dovresti vedere nel risultato:

```json
{
  "modelId": "anthropic.claude-3-7-sonnet-20250219-v1:0",
  "modelLifecycle": {
    "status": "ACTIVE"
  }
}
```

### 4. Configurazione Variabili d'Ambiente

Crea il file `.env.local`:

```bash
# Copia template
cp .env.example .env.local
```

#### .env.local Template Completo

```bash
# ================================
# AWS CONFIGURATION
# ================================

# Credenziali AWS (dalla console IAM)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1

# Modello Bedrock (OBBLIGATORIO)
AWS_BEDROCK_MODEL=anthropic.claude-3-7-sonnet-20250219-v1:0

# ================================
# DATABASE CONFIGURATION
# ================================

# PostgreSQL con pgvector
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require

# Esempio locale:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/cfood_dev?sslmode=disable

# Esempio AWS RDS:
# DATABASE_URL=postgresql://admin:password@cluster.eu-central-1.rds.amazonaws.com:5432/cfood?sslmode=require

# ================================
# OPTIONAL CONFIGURATIONS
# ================================

# Ambiente di sviluppo
NODE_ENV=development

# Next.js
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

## 🏗️ Setup AWS Bedrock

### 1. Accesso Modelli

#### Console AWS Bedrock

1. Vai su [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Naviga su **Model access** nel menu laterale
3. Clicca **Request model access**

#### Modelli da Abilitare

✅ **Claude 3.7 Sonnet** (`anthropic.claude-3-7-sonnet-20250219-v1:0`)
✅ **Titan Text Embeddings V2** (`amazon.titan-embed-text-v2:0`)

**Nota**: L'approvazione può richiedere alcuni minuti.

### 2. IAM Permissions

#### Policy IAM Minima

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": [
        "arn:aws:bedrock:eu-central-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0",
        "arn:aws:bedrock:eu-central-1::foundation-model/amazon.titan-embed-text-v2:0"
      ]
    }
  ]
}
```

#### Attach Policy all'utente

```bash
aws iam attach-user-policy \
  --user-name your-username \
  --policy-arn arn:aws:iam::account:policy/BedrockInvokePolicy
```

### 3. Test Configurazione

#### Test Bedrock Access

```bash
aws bedrock-runtime invoke-model \
  --region eu-central-1 \
  --model-id anthropic.claude-3-7-sonnet-20250219-v1:0 \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"Test"}]}' \
  test-output.json

# Verifica output
cat test-output.json
```

## 🗄️ Setup Database

### 1. Schema Pasti con Embeddings

```sql
-- Esempio di tabella pasti con embedding
CREATE TABLE pasti (
  id SERIAL PRIMARY KEY,
  descrizione_dettagliata TEXT NOT NULL,
  tipo_pasto VARCHAR(50) NOT NULL,
  embedding vector(1024), -- Titan V2 produce 1024 dimensioni
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index per ricerca vettoriale efficiente
CREATE INDEX pasti_embedding_idx ON pasti
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 2. Dati di Esempio

#### Inserimento Pasti Base

```sql
INSERT INTO pasti (descrizione_dettagliata, tipo_pasto) VALUES
('Porridge di avena integrale con mirtilli freschi e mandorle a scaglie', 'colazione'),
('Salmone grigliato con quinoa e broccoli al vapore', 'pranzo'),
('Pollo alle erbe con verdure di stagione e riso integrale', 'cena'),
('Yogurt greco con granola e frutta di stagione', 'colazione'),
('Insalata di tonno con cannellini e verdure crude', 'pranzo');

-- Nota: Gli embedding verranno generati automaticamente dall'API
```

#### Generazione Embeddings per Pasti Esistenti

```bash
# Script per popolare embeddings (da creare)
pnpm run generate-embeddings
```

### 3. Dati Storici Minimi

Per testare l'analisi storica, servono almeno:

- **3-5 piani alimentari** nel periodo
- **Dettagli nutrizionali** per ogni giorno
- **Associazioni piani-pasti** popolate

```sql
-- Esempio piano alimentare
INSERT INTO piani_alimentari (data_creazione, autore) VALUES
('2025-09-15', 'user-test-1'),
('2025-09-22', 'user-test-1'),
('2025-09-29', 'user-test-1');

-- Dettagli nutrizionali esempio
INSERT INTO dettagli_nutrizionali_giornalieri
(piano_id, giorno_settimana, calorie_totali_kcal, proteine_totali_g, carboidrati_totali_g, grassi_totali_g) VALUES
(1, 'lunedi', 1850, 95, 220, 65),
(1, 'martedi', 1780, 88, 210, 62);
```

## 🧪 Testing Setup

### 1. Verifica Ambiente

```bash
# Test connessione database
pnpm run db:test

# Test configurazione AWS
pnpm run aws:test

# Start development server
pnpm dev
```

### 2. Test API Endpoint

#### Test Base

```bash
curl -X POST http://localhost:3000/api/genera-piano \
  -H "Content-Type: application/json" \
  -d '{
    "periodo_giorni": 30,
    "preferenze": ["pesce", "verdure"],
    "esclusioni": ["latticini"]
  }'
```

#### Test Response Attesa

```json
{
  "success": true,
  "timestamp": "2025-10-03T...",
  "fase_completata": "FASE_5_PIANO_GENERATO",
  "summary": {
    "message": "✅ Pipeline completa: Piano alimentare generato con successo!",
    "fasi_completate": [
      "FASE_2: Analisi storica dei dati",
      "FASE_3: Retrieval ibrido (frequenza + similarità)",
      "FASE_4: Costruzione contesto RAG",
      "FASE_5: Generazione piano con Bedrock"
    ]
  },
  "piano_alimentare": {
    "stato": "✅ Generato con successo",
    "piano_completo": {
      "piano_alimentare": {
        "durata_giorni": 7,
        "giorni": [
          /* ... 7 giorni di pasti ... */
        ]
      }
    }
  }
}
```

## 🔍 Troubleshooting Setup

### Errori Comuni

#### 1. "AWS_BEDROCK_MODEL non configurata"

```bash
# Verifica file .env.local
cat .env.local | grep AWS_BEDROCK_MODEL

# Deve contenere:
AWS_BEDROCK_MODEL=anthropic.claude-3-7-sonnet-20250219-v1:0
```

#### 2. "Model ID not supported"

```bash
# Verifica accesso modello in Bedrock
aws bedrock list-foundation-models --region eu-central-1 | grep claude-3-7

# Se non presente, richiedi accesso via console AWS
```

#### 3. "Database connection failed"

```bash
# Test connessione PostgreSQL
psql "$DATABASE_URL" -c "SELECT version();"

# Test estensione pgvector
psql "$DATABASE_URL" -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

#### 4. "No historical data found"

```bash
# Verifica dati nel database
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM piani_alimentari;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM pasti WHERE embedding IS NOT NULL;"

# Minimo richiesto:
# - 3+ piani_alimentari
# - 10+ pasti con embedding
```

#### 5. "Embedding generation failed"

```bash
# Test manuale generazione embedding
curl -X POST https://bedrock-runtime.eu-central-1.amazonaws.com/ \
  -H "Authorization: AWS4-HMAC-SHA256 ..." \
  -d '{"inputText": "test embedding"}'
```

### Logs di Debug

#### Abilitare Logging Dettagliato

```bash
# .env.local
DEBUG=bedrock:*,database:*
LOG_LEVEL=debug
```

#### Monitoring Logs

```bash
# Durante il testing
tail -f .next/trace
# oppure
pnpm dev 2>&1 | grep "🤖\|✅\|❌"
```

## 📊 Ottimizzazioni Performance

### 1. Database Indexes

```sql
-- Indexes per performance query storiche
CREATE INDEX idx_piani_data_creazione ON piani_alimentari(data_creazione);
CREATE INDEX idx_dettagli_piano_giorno ON dettagli_nutrizionali_giornalieri(piano_id, giorno_settimana);
CREATE INDEX idx_piani_pasti_piano ON piani_pasti(piano_id);

-- Index per embedding search (se non già presente)
CREATE INDEX pasti_embedding_cosine_idx ON pasti
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 2. Connection Pooling

```typescript
// drizzle.config.ts
export default {
  // ...
  poolMax: 20,
  poolMin: 5,
  poolIdle: 10000,
};
```

### 3. Caching (Opzionale)

```bash
# Redis per cache embeddings (opzionale)
npm install redis @types/redis

# .env.local
REDIS_URL=redis://localhost:6379
```

## 🚀 Deploy Production

### Variabili Ambiente Production

```bash
# .env.production
NODE_ENV=production
AWS_REGION=eu-central-1
AWS_BEDROCK_MODEL=anthropic.claude-3-7-sonnet-20250219-v1:0

# Database production (es. AWS RDS)
DATABASE_URL=postgresql://user:pass@prod.amazonaws.com:5432/cfood?sslmode=require

# Security
NEXTAUTH_SECRET=super-secure-secret-key
NEXTAUTH_URL=https://your-domain.com
```

### Health Check Endpoint

```typescript
// pages/api/health.ts
export default async function handler(req, res) {
  try {
    // Test database
    await db.select().from(pasti).limit(1);

    // Test Bedrock (opzionale)
    // await testBedrockConnection();

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: "ok",
        bedrock: "ok",
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
    });
  }
}
```

---

## 📋 Checklist Setup Completo

### ✅ Prerequisiti

- [ ] Node.js 18+ installato
- [ ] PostgreSQL con pgvector configurato
- [ ] Account AWS con Bedrock abilitato
- [ ] Claude 3.7 Sonnet attivato

### ✅ Configurazione

- [ ] Repository clonato e dipendenze installate
- [ ] File `.env.local` configurato correttamente
- [ ] Database schema creato (migrations)
- [ ] Dati di test inseriti
- [ ] Embeddings generati per pasti esistenti

### ✅ Testing

- [ ] Connessione database verificata
- [ ] Accesso AWS Bedrock testato
- [ ] Endpoint API risponde correttamente
- [ ] Piano alimentare generato con successo

### ✅ Monitoraggio

- [ ] Logs configurati per debug
- [ ] Health check funzionante
- [ ] Performance indexes creati

---

**Setup Guide Versione**: 1.0  
**Compatibilità**: Next.js 14+, AWS Bedrock 2025  
**Ultimo Update**: Ottobre 2025

🎉 **Setup completato con successo!** Il sistema è ora pronto per generare piani alimentari personalizzati.
