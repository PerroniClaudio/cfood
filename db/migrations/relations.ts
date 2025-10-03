import { relations } from "drizzle-orm/relations";
import { pianiAlimentari, dettagliNutrizionaliGiornalieri, pianiPasti, pasti } from "./schema";

export const dettagliNutrizionaliGiornalieriRelations = relations(dettagliNutrizionaliGiornalieri, ({one}) => ({
	pianiAlimentari: one(pianiAlimentari, {
		fields: [dettagliNutrizionaliGiornalieri.pianoId],
		references: [pianiAlimentari.id]
	}),
}));

export const pianiAlimentariRelations = relations(pianiAlimentari, ({many}) => ({
	dettagliNutrizionaliGiornalieris: many(dettagliNutrizionaliGiornalieri),
	pianiPastis: many(pianiPasti),
}));

export const pianiPastiRelations = relations(pianiPasti, ({one}) => ({
	pianiAlimentari: one(pianiAlimentari, {
		fields: [pianiPasti.pianoId],
		references: [pianiAlimentari.id]
	}),
	pasti: one(pasti, {
		fields: [pianiPasti.pastoId],
		references: [pasti.id]
	}),
}));

export const pastiRelations = relations(pasti, ({many}) => ({
	pianiPastis: many(pianiPasti),
}));