import {
  pgTable,
  serial,
  varchar,
  text,
  date,
  integer,
  vector,
  foreignKey,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Schema generato da introspect del database reale
export const pianiAlimentari = pgTable("piani_alimentari", {
  id: serial().primaryKey().notNull(),
  nome: varchar({ length: 255 }).notNull(),
  descrizione: text(),
  dataCreazione: date("data_creazione").default(sql`CURRENT_DATE`),
  dataUltimaModifica: date("data_ultima_modifica").default(sql`CURRENT_DATE`),
  autore: varchar({ length: 100 }).default("Sconosciuto").notNull(),
});

export const dettagliNutrizionaliGiornalieri = pgTable(
  "dettagli_nutrizionali_giornalieri",
  {
    id: serial().primaryKey().notNull(),
    pianoId: integer("piano_id").notNull(),
    giornoSettimana: varchar("giorno_settimana", { length: 20 }).notNull(),
    proteineTotaliG: integer("proteine_totali_g"),
    carboidratiTotaliG: integer("carboidrati_totali_g"),
    grassiTotaliG: integer("grassi_totali_g"),
    calorieTotaliKcal: integer("calorie_totali_kcal"),
  },
  (table) => [
    foreignKey({
      columns: [table.pianoId],
      foreignColumns: [pianiAlimentari.id],
      name: "dettagli_nutrizionali_giornalieri_piano_id_fkey",
    }).onDelete("cascade"),
    unique(
      "dettagli_nutrizionali_giornalieri_piano_id_giorno_settimana_key"
    ).on(table.pianoId, table.giornoSettimana),
  ]
);

export const pasti = pgTable("pasti", {
  id: serial().primaryKey().notNull(),
  tipoPasto: varchar("tipo_pasto", { length: 50 }).notNull(),
  descrizioneDettagliata: text("descrizione_dettagliata").notNull(),
  noteAggiuntive: text("note_aggiuntive"),
  calorieStimate: integer("calorie_stimate"),
  proteineG: integer("proteine_g"),
  carboidratiG: integer("carboidrati_g"),
  grassiG: integer("grassi_g"),
  embedding: vector({ dimensions: 1024 }),
});

export const pianiPasti = pgTable(
  "piani_pasti",
  {
    pianoId: integer("piano_id").notNull(),
    pastoId: integer("pasto_id").notNull(),
    giornoSettimana: varchar("giorno_settimana", { length: 20 }).notNull(),
    ordineNelGiorno: integer("ordine_nel_giorno"),
  },
  (table) => [
    foreignKey({
      columns: [table.pianoId],
      foreignColumns: [pianiAlimentari.id],
      name: "piani_pasti_piano_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.pastoId],
      foreignColumns: [pasti.id],
      name: "piani_pasti_pasto_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.pianoId, table.pastoId, table.giornoSettimana],
      name: "piani_pasti_pkey",
    }),
  ]
);

// Tipi TypeScript inferiti dalle tabelle
export type PianoAlimentare = typeof pianiAlimentari.$inferSelect;
export type NewPianoAlimentare = typeof pianiAlimentari.$inferInsert;

export type Pasto = typeof pasti.$inferSelect;
export type NewPasto = typeof pasti.$inferInsert;

export type PianoPasto = typeof pianiPasti.$inferSelect;
export type NewPianoPasto = typeof pianiPasti.$inferInsert;

export type DettaglioNutrizionale =
  typeof dettagliNutrizionaliGiornalieri.$inferSelect;
export type NewDettaglioNutrizionale =
  typeof dettagliNutrizionaliGiornalieri.$inferInsert;
