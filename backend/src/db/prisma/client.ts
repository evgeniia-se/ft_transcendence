/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   client.ts                                          :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/02 19:03:20 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/03 21:27:40 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the shared Prisma client singleton
// Every module's service layer (auth, projects, kanban, notes, etc.) imports `prisma` from
// here rather than constructing its own PrismaClient No module should
// import `@prisma/client` directly.

import { PrismaClient } from "@prisma/client";

// Creates global object so reloads in development reuse the same client
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };


// prisma is the single shared client instance imported by every module's service layer.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
		log:
			process.env.NODE_ENV === "development"
				? ["query", "warn", "error"]
				: ["warn", "error"],
	});
// save to the global object if it's production
if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

// connectDatabase verifies connectivity at boot and is called once from server.ts before listen().
export async function connectDatabase(): Promise<void> {
	await prisma.$connect();
}

// disconnectDatabase is called on graceful shutdown (SIGTERM/SIGINT handlers in server.ts).
export async function disconnectDatabase(): Promise<void> {
	await prisma.$disconnect();
}
