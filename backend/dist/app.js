// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: building and configuring the Fastify application instance — route registration, plugins, and middleware wiring.
import Fastify from "fastify";
// Import plugins
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyRawBody from "fastify-raw-body";
// Import route handlers
import { registerHealthRoutes } from "./modules/health/health.routes.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { initJwtService } from "./modules/auth/jwt.service.js";
import { initOAuthService } from "./modules/auth/oauth.service.js";
import { initTokenCrypto } from "./modules/auth/tokenCrypto.js";
import { registerProjectsRoutes } from "./modules/projects/projects.routes.js";
import { registerInviteRoutes } from "./modules/projects/invites.js";
import { registerUserRoutes } from "./modules/permissions/users.routes.js";
import { registerKanbanRoutes } from "./modules/kanban/kanban.routes.js";
import { registerNotesRoutes } from "./modules/notes/notes.routes.js";
import { registerWhiteboardRoutes } from "./modules/whiteboard/whiteboard.routes.js";
import { registerAttachmentsRoutes } from "./modules/attachments/attachments.routes.js";
import { registerSearchRoutes } from "./modules/search/search.routes.js";
import { registerNotificationsRoutes } from "./modules/notifications/notifications.routes.js";
import { registerGitWebhookRoutes } from "./modules/git/webhook.routes.js";
import { registerPublicApiRoutes } from "./modules/publicapi/publicapi.routes.js";
import { initApiKeys } from "./modules/publicapi/apikeys.service.js";
import { apiKeyRouteConstraint } from "./modules/publicapi/apikey.middleware.js";
// Register plugins
function registerPlugins(app, config) {
    // Security plugins
    app.register(helmet); // Security headers
    app.register(cors, { origin: true, }); // Allow all Cross-Origin Resource Sharing
    app.register(rateLimit, {
        max: config.rateLimit.globalMax,
        timeWindow: config.rateLimit.globalWindowMs
    });
    app.register(fastifyRawBody, {
        field: "rawBody",
        global: false,
        encoding: "utf8",
        runFirst: true,
    });
}
// Register all routes
function registerRoutes(app) {
    app.register(registerHealthRoutes, { prefix: "/api" }); // Smoke test — no auth
    app.register(registerAuthRoutes, { prefix: "/api/auth" }); // Public routes (no auth required)
    app.register(registerGitWebhookRoutes, { prefix: "/api" }); // Webhook routes (HMAC-signed, no JWT)
    // Protected routes (require JWT)
    // Each of these route modules applies requireAuth / requireRole itself as a preHandler
    app.register(registerProjectsRoutes, { prefix: "/api/projects" });
    app.register(registerInviteRoutes, { prefix: "/api/projects" });
    app.register(registerUserRoutes, { prefix: "api/users" });
    app.register(registerKanbanRoutes, { prefix: "/api" });
    app.register(registerNotesRoutes, { prefix: "/api/notes" });
    app.register(registerWhiteboardRoutes, { prefix: "/api/whiteboards" });
    app.register(registerAttachmentsRoutes, { prefix: "/api/attachments" });
    app.register(registerSearchRoutes, { prefix: "/api/search" });
    app.register(registerNotificationsRoutes, { prefix: "/api/notifications" });
    app.register(registerPublicApiRoutes, { prefix: "/api" }); // Public API routes (API-key auth, not JWT)
}
// buildApp constructs a Fastify instance with every module's routes registered, but does not start listening.
export function buildApp(config) {
    const app = Fastify({ logger: true, routerOptions: { constraints: { apiAuth: apiKeyRouteConstraint } } });
    initJwtService(config.jwtSecret);
    initOAuthService({ github: config.oauthGithub, stateSecret: config.jwtSecret });
    initTokenCrypto(config.oauthTokenEncryptionKey);
    initApiKeys({ defaultRateLimit: config.publicApiRateLimitDefault });
    registerPlugins(app, config);
    registerRoutes(app);
    return app;
}
//# sourceMappingURL=app.js.map