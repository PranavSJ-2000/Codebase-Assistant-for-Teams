import cors from "cors";
import express, { Express } from "express";
import { healthRouter } from "./routes/health";
import { reposRouter } from "./routes/repos";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api", reposRouter);

  return app;
}
