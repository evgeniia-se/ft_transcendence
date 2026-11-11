// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the runtime switch that opens or closes account creation (email signup and first GitHub login).
// The state lives in the app_settings table so it survives restarts; it is cached because every signup reads it.

import { prisma } from "../../db/prisma/client.js";

const KEY = "signup_open";

let cached: boolean | undefined;

// isSignupOpen is true until an admin closes it: a fresh install must let its first user in
export async function isSignupOpen(): Promise<boolean> {
	if (cached === undefined) {
		const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
		cached = row === null ? true : row.value === "true";
	}
	return cached;
}

export async function setSignupOpen(open: boolean): Promise<void> {
	const value = open ? "true" : "false";
	await prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
	cached = open;
}
