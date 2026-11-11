// Owner: Standard user management (avatar upload). Uploaded avatars live on disk next to the attachments, in
// UPLOADS_DIR/avatars; users.avatar keeps the public path ("/api/avatars/<uuid>.png") or, for a GitHub sign-in, the
// GitHub URL. No avatar at all means the frontend draws the default one (coloured initials).
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../db/prisma/client.js";

const AVATARS_DIR = path.resolve(process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads"), "avatars");
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MiB
const URL_PREFIX = "/api/avatars/";
const STORED_NAME = /^[0-9a-f-]{36}\.(png|jpg|gif|webp)$/;

export class InvalidAvatarError extends Error {
	constructor(public readonly reason: "unsupported_type" | "too_large" | "empty") {
		super(`invalid avatar: ${reason}`);
		this.name = "InvalidAvatarError";
	}
}

export const AVATAR_CONTENT_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
};

// the real type comes from the first bytes of the file; the type and name the browser declares are not trusted
function detectExtension(data: Buffer): string | null {
	if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
	if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
	if (data.length >= 6 && ["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString("latin1"))) return "gif";
	if (data.length >= 12 && data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
	return null;
}

// storedFileOf returns the file name behind an avatar value when it is one of ours (not a GitHub URL)
function storedFileOf(avatar: string | null): string | null {
	if (!avatar?.startsWith(URL_PREFIX)) return null;
	const name = avatar.slice(URL_PREFIX.length);
	return STORED_NAME.test(name) ? name : null;
}

async function deleteStoredFile(avatar: string | null): Promise<void> {
	const name = storedFileOf(avatar);
	if (name) await unlink(path.join(AVATARS_DIR, name)).catch(() => undefined);
}

// setAvatar stores the picture, points the user at it, and removes the previous upload. Returns the new avatar path.
export async function setAvatar(userId: string, data: Buffer): Promise<string> {
	if (data.length === 0) throw new InvalidAvatarError("empty");
	if (data.length > MAX_AVATAR_BYTES) throw new InvalidAvatarError("too_large");
	const ext = detectExtension(data);
	if (!ext) throw new InvalidAvatarError("unsupported_type");

	const name = `${randomUUID()}.${ext}`;
	await mkdir(AVATARS_DIR, { recursive: true });
	await writeFile(path.join(AVATARS_DIR, name), data);

	const avatar = `${URL_PREFIX}${name}`;
	const previous = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
	await prisma.user.update({ where: { id: userId }, data: { avatar } });
	await deleteStoredFile(previous?.avatar ?? null);
	return avatar;
}

// removeAvatar goes back to the default avatar
export async function removeAvatar(userId: string): Promise<void> {
	const previous = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
	await prisma.user.update({ where: { id: userId }, data: { avatar: null } });
	await deleteStoredFile(previous?.avatar ?? null);
}

// forgetAvatarFile is for account deletion: the picture goes with the account
export async function forgetAvatarFile(avatar: string | null): Promise<void> {
	await deleteStoredFile(avatar);
}

// readAvatarFile returns the bytes and content type of a stored avatar, or null when the name is not one of ours
export async function readAvatarFile(name: string): Promise<{ data: Buffer; contentType: string } | null> {
	if (!STORED_NAME.test(name)) return null;
	try {
		const data = await readFile(path.join(AVATARS_DIR, name));
		return { data, contentType: AVATAR_CONTENT_TYPES[name.split(".")[1]] };
	} catch {
		return null;
	}
}
