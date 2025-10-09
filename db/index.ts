import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  pianiAlimentari,
  pasti,
  pianiPasti,
  dettagliNutrizionaliGiornalieri,
} from "./schema";

// Configurazione connessione PostgreSQL con postgres-js
const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Client postgres-js con configurazione per Vercel/Aurora
const client = postgres(connectionString, {
  ssl: process.env.NODE_ENV === "production" ? "require" : "prefer",
  prepare: false, // Disabilita prepared statements per compatibilità con serverless
  max: process.env.NODE_ENV === "production" ? 1 : 10, // Limite connessioni per Vercel
  idle_timeout: 20, // Timeout idle per connessioni serverless
  connect_timeout: 10, // Timeout connessione
  connection: {
    options: `--client_encoding=UTF8`,
  },
  // Configurazione SSL specifica per AWS Aurora
  transform: {
    undefined: null,
  },
  onnotice: process.env.NODE_ENV === "development" ? console.log : undefined,
  debug: process.env.NODE_ENV === "development",
});

// Schema per Drizzle
const schema = {
  pianiAlimentari,
  pasti,
  pianiPasti,
  dettagliNutrizionaliGiornalieri,
};

// Istanza Drizzle
export const db = drizzle(client, { schema });

// Chiudi connessione (per cleanup)
export const closeConnection = () => client.end();
