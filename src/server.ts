import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { startScheduler, stopScheduler } from "./services/schedulerService";
import { initChat } from "./services/chatService";

// Initializes the HTTP server, loads chat history, and starts the background scheduler.
const server = app.listen(env.port, () => {
  console.log(`API server listening on http://localhost:${env.port}`);
  initChat();
  startScheduler();
});

const shutdown = async (): Promise<void> => {
  server.close(async () => {
    stopScheduler();
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
