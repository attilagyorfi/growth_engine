import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// TiDB Cloud Serverless kötelezően SSL-t igényel.
// A drizzle-kit CLI alapból nem aktiválja az SSL-t az URL-paraméter nélkül,
// ezért explicit kell beállítani a dbCredentials.ssl-t.
// (A server-side mysql2 pool a server/db.ts-ben saját SSL config-ot használ.)
const isTiDB = connectionString.includes("tidbcloud.com");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
    ...(isTiDB && { ssl: { rejectUnauthorized: true } }),
  },
});
