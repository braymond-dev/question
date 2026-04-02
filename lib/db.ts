import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __triviaPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __triviaDb:
    | ReturnType<typeof drizzle<typeof schema>>
    | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new Pool({
    connectionString
  });
}

export function getDb() {
  if (!global.__triviaPool) {
    global.__triviaPool = createPool();
  }

  if (!global.__triviaDb) {
    global.__triviaDb = drizzle(global.__triviaPool, { schema });
  }

  return global.__triviaDb;
}
