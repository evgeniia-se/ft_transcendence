// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: building and configuring the Fastify application instance — route registration, plugins, and middleware wiring.
import Fastify, { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { isConflict } from "./db/concurrency.js";
import type { AppConfig } from "./config/env.js";

// Import plugins
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyRawBody from "fastify-raw-body";

// Import route handlers
import { registerHealthRoutes } from "./modules/health/health.routes.js";
import { registerAdminRoutes } from "./modules/admin/admin.routes.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { initJwtService } from "./modules/auth/jwt.service.js";
import { initOAuthService } from "./modules/auth/oauth.service.js";
import { initTokenCrypto } from "./modules/auth/tokenCrypto.js";
import { registerProjectsRoutes } from "./modules/projects/projects.routes.js";
import { registerInviteRoutes } from "./modules/projects/invites.js";
import { registerUserRoutes, registerAvatarRoutes } from "./modules/permissions/users.routes.js";
import { registerKanbanRoutes } from "./modules/kanban/kanban.routes.js";
import { registerFoldersRoutes } from "./modules/folders/folders.routes.js";
import { registerNotesRoutes } from "./modules/notes/notes.routes.js";
import { registerWhiteboardRoutes } from "./modules/whiteboard/whiteboard.routes.js";
import { registerAttachmentsRoutes } from "./modules/attachments/attachments.routes.js";
import { registerSearchRoutes } from "./modules/search/search.routes.js";
import { registerNotificationsRoutes } from "./modules/notifications/notifications.routes.js";
import { registerGitWebhookRoutes } from "./modules/git/webhook.routes.js";
import { registerGitRoutes } from "./modules/git/git.routes.js";
import { registerPublicApiRoutes } from "./modules/publicapi/publicapi.routes.js";
import { initApiKeys } from "./modules/publicapi/apikeys.service.js";
import { apiKeyRouteConstraint } from "./modules/publicapi/apikey.middleware.js";


// Register plugins
function registerPlugins(app: FastifyInstance, config: AppConfig): void {
	// Security plugins
	app.register(helmet); // Security headers
	// The site and the API share one origin behind nginx, so cross-origin access is only needed for another front end
	// (the Vite dev server): CORS_ORIGIN names it, otherwise any origin is reflected as before.
	app.register(cors, { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()) : true });

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
function registerRoutes(app: FastifyInstance, config: AppConfig): void {
	app.register(registerHealthRoutes, { prefix: "/api" }); // Smoke test — no auth
	app.register(registerAuthRoutes, { prefix: "/api/auth" }); // Public routes (no auth required)
	// signup admin page: password from .env, no user account; only mounted when SIGNUP_ADMIN_PASSWORD is usable
	const adminPassword = config.signupAdminPassword ?? "";
	app.register(registerAdminRoutes, { prefix: "/api/admin", signupAdminPassword: adminPassword === "change_me" || adminPassword.length < 12 ? "" : adminPassword });
	app.register(registerGitWebhookRoutes, { prefix: "/api"}); // Webhook routes (HMAC-signed, no JWT)

	// Protected routes (require JWT)
	// Each of these route modules applies requireAuth / requireRole itself as a preHandler
	app.register(registerProjectsRoutes, { prefix: "/api/projects" });
	app.register(registerInviteRoutes, { prefix: "/api/projects" });
	app.register(registerUserRoutes, { prefix: "api/users" });
	app.register(registerAvatarRoutes, { prefix: "/api/avatars" }); // uploaded pictures, public by design
	app.register(registerKanbanRoutes, { prefix: "/api" });
	app.register(registerGitRoutes, { prefix: "/api" });
	app.register(registerFoldersRoutes, { prefix: "/api/folders" });
	app.register(registerNotesRoutes, { prefix: "/api/notes" });
	app.register(registerWhiteboardRoutes, { prefix: "/api/whiteboards" });
	app.register(registerAttachmentsRoutes, { prefix: "/api/attachments" });
	app.register(registerSearchRoutes, { prefix: "/api/search" });
	app.register(registerNotificationsRoutes, { prefix: "/api/notifications" });

	app.register(registerPublicApiRoutes, { prefix: "/api" }); // Public API routes (API-key auth, not JWT)
}

// buildApp constructs a Fastify instance with every module's routes registered, but does not start listening.
export function buildApp(config: AppConfig): FastifyInstance {
	// trustProxy: believe X-Forwarded-For only when the request comes from a private address, i.e. nginx on the
	// compose network (which overwrites the header with the real client address). Without it every request would
	// look like it comes from nginx, and the per-IP rate limits would be shared by all users. A connection from a
	// public address cannot choose its own IP. The backend is not published on the host anyway.
	const app = Fastify({ logger: true, trustProxy: "loopback, linklocal, uniquelocal", routerOptions: { constraints: { apiAuth: apiKeyRouteConstraint } } });

	// A request that loses a race with another user's change (the thing it targets was deleted a moment ago, a unique
	// value was taken first, a transaction was aborted) must answer with a normal client error, not a 500.
	app.setErrorHandler((error, request, reply) => {
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			const mapped: Record<string, [number, string]> = {
				P2025: [404, "not_found"],
				P2003: [404, "not_found"],
				P2002: [409, "conflict"],
				P2034: [503, "try_again"],
			};
			const [status, code] = mapped[error.code] ?? [500, "internal_error"];
			if (status === 503) reply.header("Retry-After", "1");
			if (status < 500) request.log.info({ prismaCode: error.code }, "request lost a race with another change");
			else request.log.error({ err: error }, "database error");
			return reply.code(status).send({ error: code });
		}
		if (isConflict(error)) {
			reply.header("Retry-After", "1");
			request.log.info("request lost a deadlock with another change");
			return reply.code(503).send({ error: "try_again" });
		}
		// everything else keeps Fastify's own behaviour (validation errors stay 400, and so on)
		return reply.send(error);
	});

	initJwtService(config.jwtSecret);
	initOAuthService({ github: config.oauthGithub, stateSecret: config.jwtSecret });
	initTokenCrypto(config.oauthTokenEncryptionKey);
	initApiKeys({ defaultRateLimit: config.publicApiRateLimitDefault });
	registerPlugins(app, config);
	registerRoutes(app, config);

	return app;
}
