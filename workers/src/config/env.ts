import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: process.env.MONGO_URI ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  vectorServiceUrl: process.env.VECTOR_SERVICE_URL ?? "http://localhost:8001",
  embeddingServiceUrl: process.env.EMBEDDING_SERVICE_URL ?? "http://localhost:8002",
};
