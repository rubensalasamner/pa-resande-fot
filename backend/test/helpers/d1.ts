import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getPlatformProxy } from "wrangler";

const BACKEND_DIR = path.resolve(__dirname, "../..");
const MIGRATIONS_DIR = path.join(BACKEND_DIR, "migrations");
const TABLES = ["route_collect_jobs", "route_pois", "narrations", "routes", "pois"];

export interface TestDb {
  db: D1Database;
  reset(): Promise<void>;
  dispose(): Promise<void>;
}

function migrationStatements(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) =>
      readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean)
    );
}

export async function createTestDb(): Promise<TestDb> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: path.join(BACKEND_DIR, "wrangler.jsonc"),
    persist: false,
  });
  const db = proxy.env.DB;

  for (const statement of migrationStatements()) {
    await db.prepare(statement).run();
  }

  return {
    db,
    async reset() {
      await db.batch(TABLES.map((table) => db.prepare(`DELETE FROM ${table}`)));
    },
    dispose: () => proxy.dispose(),
  };
}
