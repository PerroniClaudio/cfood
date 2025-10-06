# CFood - Documentazione Tecnica Avanzata

## 🎯 Architettura della Pipeline

### Panoramica del Flusso di Elaborazione

```mermaid
graph TD
    A[Request POST] --> B[FASE 2: Analisi Storica]
    B --> C[FASE 3: Retrieval Ibrido]
    C --> D[FASE 4: Costruzione RAG]
    D --> E[FASE 5: Generazione Piano AI]
    E --> F[FASE 6: Calcolo Nutrizionale]
    F --> G[FASE 7: Aggregazione & Salvataggio]
    G --> H[Response JSON Completa]
```

## 📊 FASE 2: Analisi Storica dei Dati

### Implementazione

```typescript
// Query analisi pattern temporali
const patternQuery = db
  .select({
    giornoSettimana: dettagliNutrizionaliGiornalieri.giornoSettimana,
    mediaCalorie: avg(dettagliNutrizionaliGiornalieri.calorieTotaliKcal),
    mediaProteine: avg(dettagliNutrizionaliGiornalieri.proteineTotaliG),
  })
  .from(dettagliNutrizionaliGiornalieri)
  .groupBy(dettagliNutrizionaliGiornalieri.giornoSettimana);
```

### Output Strutturato

- **Piani recenti**: Ultimi 10 piani alimentari
- **Statistiche generali**: Medie caloriche e distribuzione macro
- **Top pasti**: Pasti più frequenti per tipo (colazione/pranzo/cena)
- **Pattern temporali**: Variazioni nutrizionali per giorno settimana
- **Preferenze rilevate**: Ingredienti e categorie più utilizzate

## 🔍 FASE 3: Retrieval Ibrido (Frequenza + Similarità)

### Algoritmo di Scoring

```typescript
const PESO_FREQUENZA = 0.4;
const PESO_SIMILARITA = 0.6;

const scoreFinale =
  scoreFrequenza * PESO_FREQUENZA + scoreSimilarita * PESO_SIMILARITA;
```

### Vector Search con pgvector

```sql
-- Query similarità coseno
SELECT *,
  1 - (embedding <=> '[...]'::vector) as similarita
FROM pasti
WHERE embedding IS NOT NULL
ORDER BY embedding <=> '[...]'::vector
LIMIT 50;
```

### Embedding Generation

- **Modello**: `amazon.titan-embed-text-v2:0`
- **Dimensioni**: 1024
- **Normalizzazione**: true
- **Costo**: ~$0.0001 per 1K token

## 📝 FASE 4: Sistema Prompt Engineering

### Template Esternalizzato (`/prompts/piano-alimentare.md`)

```markdown
# Piano Alimentare Settimanale

## Contesto Storico

{{contesto_rag}}

## Preferenze Utente

{{preferenze}}

## Esclusioni

{{esclusioni}}

## Output Richiesto

JSON strutturato con:

- piano_alimentare.giorni[7]
- Ogni giorno: colazione, pranzo, cena
- Descrizioni dettagliate per ogni pasto
```

### Vantaggi Sistema Esternalizzato

- **Manutenibilità**: Modifiche prompt senza rebuild
- **Versioning**: Tracking modifiche prompt
- **A/B Testing**: Test multiple versioni
- **Separazione Responsabilità**: Logic vs Content

## 🤖 FASE 5: Generazione Piano con AWS Bedrock

### Configurazione Claude 3.7 Sonnet

```typescript
const command = new InvokeModelCommand({
  modelId: "anthropic.claude-3-7-sonnet-20241022-v1:0",
  contentType: "application/json",
  body: JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4000,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  }),
});
```

### Validazione JSON Response

1. **Parsing sicuro** con try/catch
2. **Validazione struttura** `piano_alimentare.giorni`
3. **Controllo completezza** 7 giorni × 3 pasti
4. **Sanitizzazione** rimozione markdown wrapper

### Gestione Errori

- **Retry logic** per chiamate API fallite
- **Fallback su template** se JSON malformato
- **Logging dettagliato** per debugging

## 🧮 FASE 6: Calcolo Nutrizionale A Posteriori

### Pipeline Calcolo per Pasto

```typescript
async function calcolaValoriNutrizionaliPasto(
  descrizionePasto: string,
  tipoPasto: "colazione" | "pranzo" | "cena"
): Promise<ValoriNutrizionaliPasto>;
```

### Processo AI Nutrizionale

1. **Prompt Template** da `/prompts/analisi-nutrizionale.md`
2. **Chiamata Bedrock** con Claude per stima valori
3. **Parsing JSON** response nutrizionale
4. **Validazione Range** valori realistici
5. **Fallback System** se calcolo fallisce

### Valori Fallback per Tipo Pasto

```typescript
const FALLBACK_NUTRIZIONALI = {
  colazione: { calorie: 350, proteine: 15, carboidrati: 45, grassi: 12 },
  pranzo: { calorie: 550, proteine: 25, carboidrati: 65, grassi: 18 },
  cena: { calorie: 450, proteine: 22, carboidrati: 35, grassi: 15 },
};
```

### Aggregazione Multilivello

- **Pasto singolo**: Valori base + metadati
- **Giorno**: Somma 3 pasti + percentuali macro
- **Settimana**: Totali + medie + confronto linee guida

## 💾 FASE 7: Aggregazione e Salvataggio Database

### Workflow Completo

```typescript
async function eseguiFase7AggregazioneESalvataggio() {
  // 7.1-7.2: Calcoli aggregati
  const giorniConTotali = calcolaTotaliGiornalieri();
  const riepilogoSettimanale = calcolaTotaliSettimanali();

  // 7.3: Piano principale
  const pianoId = await salvaPianoPrincipale();

  // 7.4: Dettagli nutrizionali
  await salvaDettagliNutrizionaliGiornalieri();

  // 7.5: Nuovi pasti
  const { mappaIdPasti } = await salvaNuoviPastiGenerati();

  // 7.6: Relazioni
  await creaRelazioniPianoPasti();

  // 7.7-7.8: Embeddings
  await generaEmbeddingsNuoviPasti();
}
```

### Gestione Pasti Nuovi vs Esistenti

```typescript
// Identificazione pasti nuovi
const pastiEsistenti = await db
  .select({ id: pasti.id, descrizione: pasti.descrizioneDettagliata })
  .from(pasti)
  .where(inArray(pasti.descrizioneDettagliata, descrizioniArray));

const nuoveDescrizioni = descrizioniArray.filter(
  (desc) => !mappaEsistenti.has(desc)
);
```

### Batch Operations per Performance

- **INSERT multipli** con `.values(array)`
- **Transaction safety** per consistenza dati
- **Rate limiting** per API Bedrock (100ms delay)
- **Error handling** per operazioni parziali

## 🔧 Configurazioni e Ottimizzazioni

### Environment Variables Richieste

```bash
# AWS Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_BEDROCK_MODEL=anthropic.claude-3-7-sonnet-20241022-v1:0

# Database PostgreSQL + pgvector
DATABASE_URL=postgresql://user:pass@host:5432/cfood
```

### Performance Tuning

#### Database Indexes

```sql
-- Indexes per performance vector search
CREATE INDEX CONCURRENTLY idx_pasti_embedding_cosine
ON pasti USING ivfflat (embedding vector_cosine_ops);

-- Indexes per query frequenti
CREATE INDEX idx_piani_alimentari_data_creazione
ON piani_alimentari(data_creazione);

CREATE INDEX idx_dettagli_nutrizionali_piano_giorno
ON dettagli_nutrizionali_giornalieri(piano_id, giorno_settimana);
```

#### Connection Pooling

```typescript
// Drizzle con connection pooling
const db = drizzle(
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Max 20 connessioni
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })
);
```

### Memory Management

- **Streaming responses** per large datasets
- **Pagination** su query massive
- **Garbage collection** per long-running processes

## 📊 Monitoring e Observability

### Metriche Chiave da Monitorare

```typescript
interface MetricsRisposta {
  tempi_elaborazione: {
    fase_2_analisi_ms: number;
    fase_3_retrieval_ms: number;
    fase_5_generazione_ms: number;
    fase_6_nutrizionale_ms: number;
    fase_7_salvataggio_ms: number;
    totale_pipeline_ms: number;
  };

  utilizzo_ai: {
    chiamate_bedrock_totali: number;
    token_input_consumati: number;
    token_output_generati: number;
    costo_stimato_usd: number;
  };

  database_operations: {
    query_eseguite: number;
    record_inseriti: number;
    embeddings_generati: number;
  };
}
```

### Health Checks

```typescript
// Endpoint salute sistema
GET /api/health
{
  "status": "healthy",
  "database": "connected",
  "bedrock": "accessible",
  "timestamp": "2025-10-06T..."
}
```

### Error Tracking

- **Structured logging** con context
- **Error categorization** per tipo fallimento
- **Retry mechanisms** con exponential backoff
- **Circuit breakers** per servizi esterni

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe("FASE 6: Calcolo Nutrizionale", () => {
  test("dovrebbe calcolare valori realistici", async () => {
    const risultato = await calcolaValoriNutrizionaliPasto(
      "Pasta al pomodoro con basilico",
      "pranzo"
    );

    expect(risultato.calorie_stimate).toBeGreaterThan(300);
    expect(risultato.calorie_stimate).toBeLessThan(800);
    expect(risultato.stato_calcolo).toBe("calcolato");
  });
});
```

### Integration Tests

```typescript
describe("Pipeline Completa", () => {
  test("dovrebbe generare piano completo", async () => {
    const response = await fetch("/api/genera-piano", {
      method: "POST",
      body: JSON.stringify({
        periodo_giorni: 7,
        preferenze: ["pasta", "verdure"],
        esclusioni: ["carne rossa"],
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.fase_completata).toBe(
      "FASE_7_AGGREGAZIONE_E_SALVATAGGIO_COMPLETATO"
    );
  });
});
```

### Load Testing

- **k6 scripts** per test performance
- **Gradual ramp-up** per identificare bottleneck
- **Resource monitoring** durante carico

## 🚀 Deployment e Scaling

### Docker Configuration

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Scaling Considerations

- **Horizontal scaling** con load balancer
- **Database connection pooling** per multi-instance
- **Caching layer** (Redis) per dati frequenti
- **CDN** per assets statici

### Production Checklist

- [ ] Environment variables configurate
- [ ] Database migrations applicate
- [ ] Monitoring e alerting attivi
- [ ] Backup automatico database
- [ ] Rate limiting su API endpoints
- [ ] HTTPS e security headers
- [ ] Error tracking configurato

---

**Documentazione aggiornata al 6 Ottobre 2025**
**Pipeline completa implementata e testata ✅**
