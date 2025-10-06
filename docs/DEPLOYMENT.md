# Deployment Guide - CFood

## 🚀 Deployment Overview

Questa guida copre il deployment di CFood in diversi ambienti, dalle configurazioni di sviluppo locale alla produzione scalabile.

## 📋 Prerequisites

### System Requirements

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **PostgreSQL**: >= 14.0 con estensione pgvector
- **AWS Account**: Con accesso a Bedrock

### Required Environment Variables

```bash
# === AWS BEDROCK CONFIGURATION ===
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_BEDROCK_MODEL=anthropic.claude-3-7-sonnet-20241022-v1:0

# === DATABASE CONFIGURATION ===
DATABASE_URL=postgresql://user:password@localhost:5432/cfood

# === APPLICATION CONFIGURATION ===
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=production
```

## 🏠 Local Development Setup

### 1. Database Setup

```bash
# Install PostgreSQL with pgvector
brew install postgresql pgvector

# Start PostgreSQL
brew services start postgresql

# Create database
createdb cfood

# Connect and enable pgvector
psql cfood -c "CREATE EXTENSION vector;"
```

### 2. Application Setup

```bash
# Clone repository
git clone https://github.com/PerroniClaudio/cfood.git
cd cfood/app/cfood

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your configurations

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### 3. AWS Bedrock Setup

Ensure your AWS credentials have access to:

- **Claude 3.7 Sonnet**: `anthropic.claude-3-7-sonnet-20241022-v1:0`
- **Titan Embed Text v2**: `amazon.titan-embed-text-v2:0`

```bash
# Test Bedrock access
aws bedrock list-foundation-models --region us-east-1
```

## ☁️ AWS Deployment

### Option 1: AWS App Runner

Create `apprunner.yaml`:

```yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - npm ci
      - npm run build
run:
  runtime-version: 18
  command: npm start
  network:
    port: 3000
  env:
    - name: NODE_ENV
      value: production
```

Deploy:

```bash
# Create App Runner service
aws apprunner create-service \
  --service-name cfood-api \
  --source-configuration '{
    "CodeRepository": {
      "RepositoryUrl": "https://github.com/PerroniClaudio/cfood",
      "SourceCodeVersion": {"Type": "BRANCH", "Value": "main"},
      "CodeConfiguration": {
        "ConfigurationSource": "REPOSITORY"
      }
    }
  }'
```

### Option 2: AWS Lambda + API Gateway

Create `serverless.yml`:

```yaml
service: cfood-api

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    AWS_BEDROCK_MODEL: ${env:AWS_BEDROCK_MODEL}
    DATABASE_URL: ${env:DATABASE_URL}

functions:
  api:
    handler: .next/standalone/server.js
    events:
      - http:
          path: /{proxy+}
          method: ANY
    timeout: 120
    memorySize: 2048
```

Deploy:

```bash
npm install -g serverless
serverless deploy
```

### Option 3: AWS ECS + Fargate

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm && pnpm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

Deploy with ECS:

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

docker build -t cfood .
docker tag cfood:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/cfood:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/cfood:latest

# Create ECS service
aws ecs create-service \
  --cluster cfood-cluster \
  --service-name cfood-api \
  --task-definition cfood-task \
  --desired-count 2
```

## 🐳 Docker Deployment

### Development Docker Setup

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/cfood
    depends_on:
      - db
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: pgvector/pgvector:pg14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: cfood
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Run:

```bash
docker-compose up -d
```

### Production Docker Setup

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  app:
    image: cfood:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - app
    restart: unless-stopped
```

## 🔒 Security Configuration

### SSL/TLS Setup

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout configuration for long-running requests
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

### Environment Security

```bash
# Use AWS Secrets Manager for production
aws secretsmanager create-secret \
  --name cfood/production/env \
  --description "CFood production environment variables" \
  --secret-string file://secrets.json
```

### CORS Configuration

```typescript
// next.config.ts
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://your-domain.com",
          },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};
```

## 📊 Monitoring & Observability

### Health Checks

```typescript
// app/api/health/route.ts
export async function GET() {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      bedrock: await checkBedrock(),
      embeddings: await checkEmbeddings(),
    },
    version: process.env.npm_package_version || "1.0.0",
  };

  return Response.json(health);
}
```

### Logging Configuration

```typescript
// lib/logger.ts
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});
```

### Metrics Collection

```typescript
// lib/metrics.ts
import { Registry, Counter, Histogram } from "prom-client";

const register = new Registry();

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route"],
  registers: [register],
});

export const bedrockCallsTotal = new Counter({
  name: "bedrock_calls_total",
  help: "Total number of Bedrock API calls",
  labelNames: ["model", "phase"],
  registers: [register],
});
```

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy CFood

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: "pnpm"

      - run: pnpm install
      - run: pnpm lint
      - run: pnpm build
      - run: pnpm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to App Runner
        run: |
          aws apprunner start-deployment \
            --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }}
```

## 📈 Scaling Considerations

### Database Scaling

```sql
-- Database optimizations for production
CREATE INDEX CONCURRENTLY idx_pasti_embedding_cosine
ON pasti USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_piani_alimentari_data_creazione
ON piani_alimentari(data_creazione DESC);

CREATE INDEX idx_dettagli_nutrizionali_compound
ON dettagli_nutrizionali_giornalieri(piano_id, giorno_settimana);

-- Connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
```

### Application Scaling

```typescript
// lib/cache.ts
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export async function getCachedAnalisiStorica(key: string) {
  const cached = await redis.get(`analisi:${key}`);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedAnalisiStorica(key: string, data: any) {
  await redis.setex(`analisi:${key}`, 3600, JSON.stringify(data));
}
```

### Load Balancing

```yaml
# AWS ALB Target Group
TargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    Port: 3000
    Protocol: HTTP
    HealthCheckPath: /api/health
    HealthCheckIntervalSeconds: 30
    HealthyThresholdCount: 2
    UnhealthyThresholdCount: 3
    Matcher:
      HttpCode: 200
```

## 🔧 Troubleshooting

### Common Issues

**1. Bedrock Access Denied**

```bash
# Verify Bedrock model access
aws bedrock get-foundation-model \
  --model-identifier anthropic.claude-3-7-sonnet-20241022-v1:0
```

**2. Database Connection Issues**

```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT version();"
```

**3. Memory Issues**

```javascript
// Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Performance Monitoring

```bash
# Monitor application metrics
curl http://localhost:3000/api/health

# Check logs
tail -f logs/combined.log | grep ERROR

# Database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

---

## 📚 Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [AWS Bedrock Developer Guide](https://docs.aws.amazon.com/bedrock/)
- [PostgreSQL pgvector Documentation](https://github.com/pgvector/pgvector)
- [Drizzle ORM Production Guide](https://orm.drizzle.team/docs/overview)

**Last Updated**: 6 Ottobre 2025
