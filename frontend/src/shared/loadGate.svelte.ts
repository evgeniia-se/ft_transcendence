// Decides when a loading skeleton shows and how it hands over to the content.
//   data before `delay`: wait -> ready
//   data later:          wait -> skeleton-in -> skeleton -> skeleton-out -> ready
// If data arrives during skeleton-in, the entrance plays to the end first.
export type GatePhase = "wait" | "skeleton-in" | "skeleton" | "skeleton-out" | "ready";

interface GateOptions {
  // ms before the skeleton shows
  delay?: number;
  // ms of the skeleton's entrance animation (with its stagger)
  enter?: number;
  // ms of the hand-over to the content
  leave?: number;
}

const REVEAL_MS = 1800;

export class LoadGate {
  phase = $state<GatePhase>("wait");
  // the content is playing its entrance animation
  revealing = $state(false);
  // ms to delay the content's entrance (a beat after a skeleton)
  revealBase = $state(0);

  readonly #delay: number;
  readonly #enter: number;
  readonly #leave: number;
  #loaded = false;
  #timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(options: GateOptions = {}) {
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.#delay = options.delay ?? 500;
    this.#enter = reduced ? 0 : (options.enter ?? 700);
    this.#leave = reduced ? 0 : (options.leave ?? 380);
  }

  get showSkeleton(): boolean {
    return this.phase === "skeleton-in" || this.phase === "skeleton" || this.phase === "skeleton-out";
  }

  // call when loading begins
  start(): void {
    this.#after(this.#delay, () => {
      if (this.#loaded) return;
      this.phase = "skeleton-in";
      this.#after(this.#enter, () => {
        this.phase = "skeleton";
        if (this.#loaded) this.#handOver();
      });
    });
  }

  // call when the data (or the error) is there
  resolve(): void {
    if (this.#loaded) return;
    this.#loaded = true;
    if (this.phase === "wait") {
      // no skeleton was shown
      this.#clear();
      this.revealBase = 0;
      this.#startReveal();
      this.phase = "ready";
    } else if (this.phase === "skeleton") {
      this.#handOver();
    }
    // during skeleton-in, the entrance timer hands over when it ends
  }

  destroy(): void {
    this.#clear();
  }

  #handOver(): void {
    this.revealBase = 140;
    this.#startReveal();
    this.phase = "skeleton-out";
    this.#after(this.#leave, () => (this.phase = "ready"));
  }

  #startReveal(): void {
    this.revealing = true;
    this.#after(REVEAL_MS, () => (this.revealing = false));
  }

  #after(ms: number, run: () => void): void {
    const id = setTimeout(() => {
      this.#timers.delete(id);
      run();
    }, ms);
    this.#timers.add(id);
  }

  #clear(): void {
    for (const id of this.#timers) clearTimeout(id);
    this.#timers.clear();
  }
}
