// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: checking and merging Excalidraw elements on the server, shared by the live relay and the HTTP save.

//The bare minimum every element needs for the merge below to work; anything else is Excalidraw's business.
export interface SceneElement extends Record<string, unknown> {
	id: string;
	type: string;
	version: number;
	versionNonce: number;
	isDeleted?: boolean;
	updated?: number;
}

export const MAX_ELEMENTS_PER_MESSAGE = 2000;
export const MAX_ELEMENTS_PER_SCENE = 20000;
//An erased shape is kept as a tombstone so a client that was offline cannot bring it back; old ones are dropped.
const TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isSceneElement(value: unknown): value is SceneElement {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const element = value as Record<string, unknown>;
	return (
		typeof element.id === "string" &&
		element.id.length > 0 &&
		element.id.length <= 100 &&
		typeof element.type === "string" &&
		element.type.length <= 40 &&
		Number.isFinite(element.version) &&
		Number.isFinite(element.versionNonce) &&
		(element.isDeleted === undefined || typeof element.isDeleted === "boolean")
	);
}

//Keep the well-formed elements; null if the input is not an array or is over the limit.
export function validateElements(raw: unknown, limit: number): SceneElement[] | null {
	if (!Array.isArray(raw) || raw.length > limit) return null;
	return raw.filter(isSceneElement);
}

//The higher version wins; on a tie the lower versionNonce does, so every client and the server converge.
function incomingWins(current: SceneElement, incoming: SceneElement): boolean {
	return (
		incoming.version > current.version ||
		(incoming.version === current.version && incoming.versionNonce < current.versionNonce)
	);
}

//Merge incoming elements into the stored ones and drop expired tombstones.
export function mergeScene(stored: readonly SceneElement[], incoming: readonly SceneElement[]): SceneElement[] {
	const merged = [...stored];
	const indexById = new Map(merged.map((element, index) => [element.id, index]));

	for (const element of incoming) {
		const index = indexById.get(element.id);
		if (index === undefined) {
			indexById.set(element.id, merged.length);
			merged.push(element);
		} else if (incomingWins(merged[index], element)) {
			merged[index] = element;
		}
	}

	const cutoff = Date.now() - TOMBSTONE_TTL_MS;
	return merged.filter((element) => !(element.isDeleted && typeof element.updated === "number" && element.updated < cutoff));
}
