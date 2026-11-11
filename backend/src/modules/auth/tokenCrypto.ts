/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   tokenCrypto.ts                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/29 20:45:03 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/29 20:45:07 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: application-level encryption of OAuth access/refresh tokens before they're
// persisted to OAuthAccount. store the user's GitHub token so the backend can call GitHub on the user's behalf
// Track 3's Octokit branch create/list calls), using `crypto.createCipheriv` + a key from env
// rather than a managed KMS, since that's proportionate for this project. Postgres only ever
// sees the ciphertext this module produces — OAuthAccount.accessToken/refreshToken never hold a
// usable plaintext token.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

let encryptionKey: Buffer | undefined;

// initTokenCrypto is called once from app.ts's buildApp with AppConfig.oauthTokenEncryptionKey
// (64 hex chars = 32 bytes), the same init-once pattern as initJwtService/initOAuthService
// Generate a key with: openssl rand -hex 32
export function initTokenCrypto(hexKey: string): void {
	const key = Buffer.from(hexKey, "hex");
	if (key.length !== KEY_LENGTH) {
		throw new Error(`OAUTH_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars), got ${key.length} bytes`);
	}
	encryptionKey = key;
}

function getKey(): Buffer {
	if (!encryptionKey) {
		throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY not configured (call initTokenCrypto first)");
	}
	return encryptionKey;
}

// encryptToken encrypts a plaintext OAuth token for storage in OAuthAccount.accessToken/refreshToken
// Output is self-contained ("<iv>:<authTag>:<ciphertext>", each base64) so decryptToken needs no
// extra column, and GCM's auth tag means a tampered or corrupted row fails closed
export function encryptToken(plaintext: string): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, getKey(), iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

// decryptToken reverses encryptToken. Throws if the key is wrong or the stored value was tampered
// with (GCM auth tag check) — callers should let this propagate rather than swallow it, since a
// silently-ignored decrypt failure would look like "user has no linked GitHub account"
export function decryptToken(stored: string): string {
	const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
	if (!ivB64 || !authTagB64 || !ciphertextB64) {
		throw new Error("Malformed encrypted token (expected iv:authTag:ciphertext)");
	}
	const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
	decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
	const plaintext = Buffer.concat([
		decipher.update(Buffer.from(ciphertextB64, "base64")),
		decipher.final(),
	]);
	return plaintext.toString("utf8");
}
