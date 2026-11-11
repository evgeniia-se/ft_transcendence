/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   password.service.ts                                :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/07 20:49:42 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/08 20:40:52 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: hashing and verifying passwords for the mandatory email/password baseline (general requirements section 1). TS equivalent of backend/internal/auth/password.go (Go skeleton, removed).

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

const scrypt = promisify(scryptCallback);

// HashPassword generates a salted hash for a plaintext password before it is stored on the User record.
export async function hashPassword(plaintext: string): Promise<{ hash: string; salt: string }> {
	const salt = randomBytes(SALT_BYTES).toString("hex");
	const derivedKey = (await scrypt(plaintext, salt, KEY_LENGTH)) as Buffer;
	return { hash: derivedKey.toString("hex"), salt };
}

// verifyPassword checks a login attempt's plaintext password against the stored hash and salt.
export async function verifyPassword(
	plaintext: string,
	storedHash: string,
	storedSalt: string
): Promise<boolean> {
	try {
		const derivedKey = (await scrypt(plaintext, storedSalt, KEY_LENGTH)) as Buffer;
		const storedKey = Buffer.from(storedHash, "hex");
		// length mismatch means the stored hash doesn't match this input, not an error
		if (derivedKey.length !== storedKey.length) {
			return false;
		}
		return timingSafeEqual(derivedKey, storedKey); // timingSafeEqual throws on length mismatch rather than returning false
		} catch {
		return false;
	}
}
