import { Router } from "express";
import { askQuestion } from "../controllers/ask.controller";
import { createRepo, getRepo } from "../controllers/repos.controller";

export const reposRouter = Router();

reposRouter.post("/repos", createRepo);
reposRouter.get("/repos/:id", getRepo);
reposRouter.get("/repos/:id/ask", askQuestion);
