import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: "cfood-knowledge-base.cluster-cle48ksqibxw.eu-central-1.rds.amazonaws.com",
    port: 5432,
    user: "cfood_admin",
    password: "3X1%b6Wy4DPsaj^2",
    database: "cfood_knowledge_base",
    ssl: {
      rejectUnauthorized: false,
    },
  },
  verbose: true,
  strict: true,
});
