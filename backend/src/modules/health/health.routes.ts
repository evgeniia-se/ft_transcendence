// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: a lightweight smoke-test endpoint. The /landing page calls this to
// visually confirm the full round-trip works: browser -> nginx -> backend -> Postgres.
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma/client.js";

// registerHealthRoutes mounts GET /api/health, called from app.ts (prefix "/api").
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    let db: "up" | "down" = "up";
    try {
      // a read through the ORM, so the health check does not need raw SQL either
      await prisma.user.findFirst({ select: { id: true } });
    } catch {
      db = "down";
    }

    return {
      status: db === "up" ? "ok" : "degraded",
      time: new Date().toISOString(),
    };
  });
}
