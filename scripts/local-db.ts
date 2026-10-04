import EmbeddedPostgres from "embedded-postgres";
import { mkdir } from "node:fs/promises";
await mkdir(".data", { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: ".data/postgres",
  user: "fitware",
  password: "fitware",
  port: 55432,
  persistent: true,
});
await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("fitware");
} catch {
  /* Already exists on restart. */
}
console.log("Development PostgreSQL is ready on port 55432.");
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
