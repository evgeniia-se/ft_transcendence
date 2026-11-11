<!-- Shows a skeleton while loading, then the content (see LoadGate).
     While the content reveals itself, its container has class "reveal" and --reveal-base. -->
<script lang="ts">
  import { t } from "../i18n.svelte";
  import type { Snippet } from "svelte";
  import type { LoadGate } from "../loadGate.svelte";

  let {
    gate,
    label,
    skeleton,
    children,
  }: { gate: LoadGate; label?: string; skeleton: Snippet; children: Snippet } = $props();

  const contentVisible = $derived(gate.phase === "skeleton-out" || gate.phase === "ready");
</script>

<div class="stage" aria-busy={gate.showSkeleton}>
  {#if contentVisible}
    <div class="content" class:reveal={gate.revealing} style:--reveal-base="{gate.revealBase}ms">
      {@render children()}
    </div>
  {/if}

  {#if gate.showSkeleton}
    <div class="sk-layer" class:overlay={gate.phase === "skeleton-out"} class:leave={gate.phase === "skeleton-out"} aria-hidden="true">
      {@render skeleton()}
    </div>
    <span class="sr-only" role="status">{label ?? t("common.loading")}</span>
  {/if}
</div>

<style>
  .stage {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .sk-layer {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--bg);
  }
  /* the skeleton fades out above the content */
  .sk-layer.overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }
  .sk-layer.leave {
    animation: sk-out 0.38s var(--ease) both;
  }
</style>
