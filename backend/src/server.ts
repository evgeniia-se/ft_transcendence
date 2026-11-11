/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   server.ts                                          :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/08/28 20:01:23 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/04 19:55:55 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: process entrypoint — loads config, connects the database, builds the Fastify app, attaches the Socket.IO Kanban hub, and starts listening. Replaces backend/cmd/server/main.go (Go skeleton, removed).
import "dotenv/config";
import { loadConfig } from "./config/env.js";
import { buildApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./db/prisma/client.js";
import { createKanbanHub } from "./modules/kanban/hub.js";
import { flushAllNotes } from "./modules/notes/notes.collab.js";

async function main(): Promise<void> {
	try {
		// Load config from env
		const config = loadConfig();
		console.log(`Starting server on ${config.host}:${config.port} in ${config.nodeEnv} mode`)

		// Connect Database
		await connectDatabase();
		console.log("Database connected");

		// Build Fastify app
		const app = buildApp(config);
		console.log("Fastify app built");

		// Attach Socket.IO to the same HTTP server Fastify created, and expose the
		// instance on the app (app.io) for handlers and the shutdown hook below.
		app.decorate("io", createKanbanHub(app.server));
		console.log("Socket.IO hub attached");

		// Start listening
		await app.listen({port: config.port, host: config.host});
		console.log(`Server listening on http://${config.host}:${config.port}`);

		// Handle shutdown (SIGTERM / SIGINT)
		// SIGTERM = SIGnal TERMinate kill signal from container/process managet
		// SIGINT = Ctrl + C
		const signals = ["SIGTERM", "SIGINT"];
		signals.forEach((signal) => {
			process.on(signal, async() => {
				console.log(`\n${signal} received, shutting down gracefully...`);

				try {
					// Save the notes being edited before the database goes away
					await flushAllNotes();

					// Close Socket.IO (disconnects clients; also closes the shared HTTP
					// server, which app.close() below then tolerates as already-stopped).
					app.io.close();
					console.log("Socket.IO hub closed");

					// Close Fastify
					await app.close();
					console.log("Fastify server closed");

					// Close database
					await disconnectDatabase();
					console.log("Database disconnected");
					console.log("Shutdown complete");
					process.exit(0);
				} catch (err) {
					console.error("Error during shutdown:", err);
					process.exit(1);
				}
			});
		});
	} catch (err) {
		console.error("Fatal error during startup:", err);
		process.exit(1);
	}
}

main().catch((err) => {
  console.error("Unhandled error in main", err);
  process.exit(1);
});
