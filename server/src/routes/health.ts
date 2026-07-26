import { Router } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptimeSeconds: process.uptime(),
    mongoConnection: mongoose.STATES[mongoose.connection.readyState],
    timestamp: new Date().toISOString(),
  });
});
