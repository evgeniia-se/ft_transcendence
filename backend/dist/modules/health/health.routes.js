import { prisma } from "../../db/prisma/client.js";
// registerHealthRoutes mounts GET /api/health, called from app.ts (prefix "/api").
export async function registerHealthRoutes(app) {
    app.get("/health", async () => {
        let db = "up";
        try {
            await prisma.$queryRaw `SELECT 1`;
        }
        catch {
            db = "down";
        }
        return {
            status: "ok",
            service: "ft_transcendence backend",
            db,
            time: new Date().toISOString(),
        };
    });
}
//# sourceMappingURL=health.routes.js.map