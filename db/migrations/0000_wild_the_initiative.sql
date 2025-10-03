-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "piani_alimentari" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"descrizione" text,
	"data_creazione" date DEFAULT CURRENT_DATE,
	"data_ultima_modifica" date DEFAULT CURRENT_DATE,
	"autore" varchar(100) DEFAULT 'Sconosciuto' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dettagli_nutrizionali_giornalieri" (
	"id" serial PRIMARY KEY NOT NULL,
	"piano_id" integer NOT NULL,
	"giorno_settimana" varchar(20) NOT NULL,
	"proteine_totali_g" integer,
	"carboidrati_totali_g" integer,
	"grassi_totali_g" integer,
	"calorie_totali_kcal" integer,
	CONSTRAINT "dettagli_nutrizionali_giornalieri_piano_id_giorno_settimana_key" UNIQUE("piano_id","giorno_settimana")
);
--> statement-breakpoint
CREATE TABLE "pasti" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo_pasto" varchar(50) NOT NULL,
	"descrizione_dettagliata" text NOT NULL,
	"note_aggiuntive" text,
	"calorie_stimate" integer,
	"proteine_g" integer,
	"carboidrati_g" integer,
	"grassi_g" integer,
	"embedding" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "piani_pasti" (
	"piano_id" integer NOT NULL,
	"pasto_id" integer NOT NULL,
	"giorno_settimana" varchar(20) NOT NULL,
	"ordine_nel_giorno" integer,
	CONSTRAINT "piani_pasti_pkey" PRIMARY KEY("piano_id","pasto_id","giorno_settimana")
);
--> statement-breakpoint
ALTER TABLE "dettagli_nutrizionali_giornalieri" ADD CONSTRAINT "dettagli_nutrizionali_giornalieri_piano_id_fkey" FOREIGN KEY ("piano_id") REFERENCES "public"."piani_alimentari"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piani_pasti" ADD CONSTRAINT "piani_pasti_piano_id_fkey" FOREIGN KEY ("piano_id") REFERENCES "public"."piani_alimentari"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piani_pasti" ADD CONSTRAINT "piani_pasti_pasto_id_fkey" FOREIGN KEY ("pasto_id") REFERENCES "public"."pasti"("id") ON DELETE cascade ON UPDATE no action;
*/