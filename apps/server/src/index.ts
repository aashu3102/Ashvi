import dotenv from "dotenv";
import { resolve } from "node:path";
import { buildApp } from "./app/build-app.js";
import { loadEnvironment } from "./config/env.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
const environment = loadEnvironment();
const app = buildApp(environment);

async function start() {
  try {
    await app.listen({ port: environment.ASHVI_SERVER_PORT, host: "127.0.0.1" });
    app.log.info({ port: environment.ASHVI_SERVER_PORT }, "Ashvi server started");
  } catch (error) {
    app.log.error({ err: error }, "Ashvi server failed to start");
    process.exit(1);
  }
}

async function shutdown(signal: NodeJS.Signals) {
  app.log.info({ signal }, "Ashvi server shutting down");
  await app.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
void start();
