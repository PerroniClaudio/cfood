import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.AWS_AURORA_ENDPOINT!,
    port: 5432,
    user: process.env.AWS_AURORA_USERNAME!,
    password: process.env.AWS_AURORA_PASSWORD!,
    database: process.env.AWS_AURORA_DB_NAME!,
    ssl: {
      rejectUnauthorized: false,
    },
  },
  verbose: true,
  strict: true,
});
