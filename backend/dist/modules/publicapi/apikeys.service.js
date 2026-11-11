// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: API key issuance/validation for the Public API major module
import { randomBytes, createHash } from "crypto";
import { prisma } from "../../db/prisma/client.js";
// API_KEY_PREFIX makes keys recognizable
export const API_KEY_PREFIX = "tk_";
// MAX_RATE_LIMIT caps what an admin can request for a single key (requests per minute)
export const MAX_RATE_LIMIT = 10_000;
const MAX_PRESENTED_KEY_LENGTH = 128;
let defaultRateLimit = 100;
// initApiKeys is called once from app.ts with config.publicApiRateLimitDefault
export function initApiKeys(options) {
    if (!Number.isInteger(options.defaultRateLimit) || options.defaultRateLimit <= 0) {
        throw new Error("PUBLIC_API_RATE_LIMIT_DEFAULT must be a positive integer");
    }
    defaultRateLimit = options.defaultRateLimit;
}
export class InvalidApiKeyInputError extends Error {
    details;
    constructor(details) {
        super("invalid api key input");
        this.details = details;
        this.name = "InvalidApiKeyInputError";
    }
}
export class ApiKeyNotFoundError extends Error {
    constructor() {
        super("api key not found");
        this.name = "ApiKeyNotFoundError";
    }
}
function hashKey(key) {
    return createHash("sha256").update(key).digest("hex");
}
export function stripKeyHash(apiKey) {
    const { keyHash: _keyHash, ...safe } = apiKey;
    return safe;
}
// issueApiKey generates a new API key for external/script access to the public endpoints
// The plaintext key is returned exactly once to the caller, it can't be recovered later
export async function issueApiKey(input) {
    const rateLimit = input.rateLimit ?? defaultRateLimit;
    if (!Number.isInteger(rateLimit) || rateLimit <= 0 || rateLimit > MAX_RATE_LIMIT) {
        throw new InvalidApiKeyInputError([`rateLimit must be an integer between 1 and ${MAX_RATE_LIMIT}`]);
    }
    const plaintextKey = API_KEY_PREFIX + randomBytes(32).toString("base64url");
    const apiKey = await prisma.apiKey.create({
        data: {
            userId: input.userId,
            projectId: input.projectId ?? null,
            keyHash: hashKey(plaintextKey),
            rateLimit,
        },
    });
    return { apiKey, plaintextKey };
}
// revokeApiKey disables a previously issued key
export async function revokeApiKey(keyId, projectId) {
    const existing = await prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!existing || (projectId !== undefined && existing.projectId !== projectId)) {
        throw new ApiKeyNotFoundError();
    }
    await prisma.apiKey.deleteMany({ where: { id: keyId } });
}
// listApiKeys returns a project's keys (hash stripped) for the admin management view
export async function listApiKeys(projectId) {
    const keys = await prisma.apiKey.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
    });
    return keys.map(stripKeyHash);
}
// validateApiKey checks an incoming request's API key header against stored key hashes
export async function validateApiKey(presentedKey) {
    if (!presentedKey.startsWith(API_KEY_PREFIX) || presentedKey.length > MAX_PRESENTED_KEY_LENGTH) {
        return null;
    }
    const apiKey = await prisma.apiKey.findFirst({ where: { keyHash: hashKey(presentedKey) } });
    if (!apiKey || apiKey.userId === null) {
        return null;
    }
    return apiKey;
}
//# sourceMappingURL=apikeys.service.js.map