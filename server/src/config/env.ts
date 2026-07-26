import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  vectorServiceUrl: process.env.VECTOR_SERVICE_URL ?? "http://localhost:8001",
  embeddingServiceUrl: process.env.EMBEDDING_SERVICE_URL ?? "http://localhost:8002",
  ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.2:3b",
};
