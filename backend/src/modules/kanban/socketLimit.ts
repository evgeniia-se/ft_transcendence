export function createTokenBucket(burst: number, refillPerSec: number): () => boolean {
	let tokens = burst;
	let refilledAt = Date.now();
	return () => {
		const now = Date.now();
		tokens = Math.min(burst, tokens + ((now - refilledAt) / 1000) * refillPerSec);
		refilledAt = now;
		if (tokens < 1) return false;
		tokens -= 1;
		return true;
	};
}
