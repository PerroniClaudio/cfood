# Verifica Connessione Aurora su Vercel

## Problemi Comuni

### 1. **Variabili d'Ambiente**

- Verifica che `DATABASE_URL` sia configurata correttamente su Vercel
- La password contiene caratteri speciali che potrebbero richiedere encoding URL

### 2. **Security Groups Aurora**

Aurora deve permettere connessioni da:

- **IP Vercel**: `0.0.0.0/0` (o range specifico Vercel)
- **Porta**: `5432` (PostgreSQL)
- **Protocollo**: TCP

### 3. **VPC e Subnet Groups**

- Aurora deve essere in **subnet pubbliche** per accesso esterno
- O configurare un **bastion host** se in subnet private

### 4. **SSL Configuration**

- Aurora richiede SSL in produzione
- Verifica che il certificato sia valido

## Debugging Steps

### 1. Test Health Check

```bash
curl https://your-app.vercel.app/api/health
```

### 2. Check Vercel Logs

```bash
vercel logs --follow
```

### 3. Test Locale vs Produzione

- Funziona in locale? → Problema di rete/security groups
- Non funziona nemmeno in locale? → Problema di configurazione

### 4. Verifica Security Groups AWS

```bash
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

## Soluzioni

### Quick Fix 1: Security Group

```json
{
  "IpPermissions": [
    {
      "IpProtocol": "tcp",
      "FromPort": 5432,
      "ToPort": 5432,
      "IpRanges": [
        {
          "CidrIp": "0.0.0.0/0",
          "Description": "Allow from anywhere (temporary)"
        }
      ]
    }
  ]
}
```

### Quick Fix 2: Environment Variables

Verifica su Vercel Dashboard che:

- `DATABASE_URL` sia correttamente impostata
- Non ci siano caratteri speciali non escapati
- Le credenziali siano corrette

### Quick Fix 3: Connection String

```env
# Formato corretto
DATABASE_URL=postgresql://username:password@endpoint:5432/database?sslmode=require

# Con caratteri speciali
DATABASE_URL=postgresql://cfood_admin:3X1%25b6Wy4DPsaj%5E2@cfood-knowledge-base.cluster-cle48ksqibxw.eu-central-1.rds.amazonaws.com:5432/cfood_knowledge_base?sslmode=require
```
