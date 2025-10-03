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

// Client postgres-js (gestisce automaticamente SSL per AWS)
const client = postgres(connectionString, {
  ssl: "require", // Forza SSL per AWS Aurora
  prepare: false, // Disabilita prepared statements per compatibilità
  max: 1, // Limite connessioni per evitare pool overflow
  connection: {
    options: `--client_encoding=UTF8`,
  },
  // Configurazione SSL specifica per AWS Aurora
  transform: {
    undefined: null,
  },
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
