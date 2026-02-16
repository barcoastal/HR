import path from "node:path";
import { defineConfig } from "prisma/config";

const dbUrl = "file:" + path.join(__dirname, "prisma", "dev.db");

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrate: {
    async adapter() {
      const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
      return new PrismaBetterSqlite3({ url: dbUrl });
    },
  },
  datasource: {
    url: dbUrl,
  },
});
