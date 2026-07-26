import { env } from "./config/env";
import { connectToDatabase } from "./db";
import { createEmbedRepoWorker, EMBED_REPO_QUEUE } from "./queues/embedRepoWorker";

async function main() {
  await connectToDatabase();

  const worker = createEmbedRepoWorker();

  worker.on("ready", () => {
    console.log(`[workers] Worker process started (${env.nodeEnv}), listening on "${EMBED_REPO_QUEUE}"`);
  });

  process.on("SIGTERM", async () => {
    await worker.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[workers] Fatal startup error:", err);
  process.exit(1);
});
