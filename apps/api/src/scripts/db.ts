import { defaultDatabasePath, resetSqliteDatabase, SqliteStore } from "../storage/sqliteStore.js";

const command = process.argv[2] ?? "migrate";
const path = process.env.OPEN_PRIOR_AUTH_DB_PATH ?? defaultDatabasePath();

if (command === "migrate") {
  const store = new SqliteStore(path);
  store.close();
  console.log(`Migrated SQLite database at ${path}`);
} else if (command === "reset") {
  resetSqliteDatabase(path);
  console.log(`Reset SQLite database at ${path}`);
} else {
  console.error(`Unknown db command: ${command}`);
  process.exitCode = 1;
}
