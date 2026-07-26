import { createApp } from "./app";
import { connectToDatabase } from "./config/db";
import { env } from "./config/env";

async function main() {
  await connectToDatabase();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`[server] Listening on port ${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error("[server] Fatal startup error:", err);
  process.exit(1);
});
