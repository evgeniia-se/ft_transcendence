<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    align = "end",
    width = 260,
    fixed = false,
    trigger,
    children,
    onopen,
  }: {
    open?: boolean;
    align?: "start" | "end";
    width?: number;
    // fixed: the panel is moved to <body> and positioned on the screen, so it is not clipped by a scrolling
    // or transformed ancestor (a card inside a scrolling list). It flips above the trigger when short of room.
    fixed?: boolean;
    trigger: Snippet<[{ open: boolean; toggle: () => void }]>;
    children: Snippet<[{ close: () => void }]>;
    onopen?: () => void;
  } = $props();

  let root: HTMLElement;
  let panel = $state<HTMLElement>();

  // keep the panel inside the screen: on phones its trigger is not at the edge
  function portal(node: HTMLElement, enabled: boolean) {
    if (!enabled) return {};
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  function fitFixed(): void {
    if (!panel) return;
    const margin = 12;
    const rect = root.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const wanted = align === "end" ? rect.right - w : rect.left;
    let top = rect.bottom + 8;
    if (top + h > vh - margin && rect.top - 8 - h >= margin) top = rect.top - 8 - h;
    panel.style.left = `${Math.max(margin, Math.min(wanted, vw - w - margin))}px`;
    panel.style.top = `${Math.max(margin, top)}px`;
  }

  function fit(): void {
    if (!panel) return;
    if (fixed) return fitFixed();
    panel.style.translate = "0 0";
    // the opening animation scales the panel: measure its real box
    const box = panel.getBoundingClientRect();
    const left = box.left + (box.width - panel.offsetWidth) / 2;
    const right = left + panel.offsetWidth;
    const margin = 12;
    const viewport = document.documentElement.clientWidth;
    const dx = left < margin ? margin - left : right > viewport - margin ? viewport - margin - right : 0;
    panel.style.translate = `${dx}px 0`;
  }

  $effect(() => {
    if (open && panel) fit();
  });

  // the content can grow while open (an expanding section): keep the panel on screen
  $effect(() => {
    if (!open || !fixed || !panel) return;
    const observer = new ResizeObserver(() => fitFixed());
    observer.observe(panel);
    return () => observer.disconnect();
  });

  // a fixed panel would stay behind when something scrolls under it: close it instead
  $effect(() => {
    if (!open || !fixed) return;
    const onScroll = (event: Event) => {
      if (!panel?.contains(event.target as Node)) close();
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  });

  function toggle(): void {
    open = !open;
    if (open) onopen?.();
  }

  function close(): void {
    open = false;
  }

  function onWindowPointerDown(event: PointerEvent): void {
    // during the theme animation, clicks land on <html> (the snapshots), not on the page: not an outside click
    if (event.target === document.documentElement) return;
    if (open && !root.contains(event.target as Node) && !panel?.contains(event.target as Node)) close();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (open && event.key === "Escape") {
      event.stopPropagation();
      close();
      root.querySelector<HTMLElement>("[data-popover-trigger], button, a")?.focus();
    }
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} onresize={fit} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="popover" bind:this={root} onkeydown={onKeydown}>
  <span class="anchor" data-popover-trigger-wrap>{@render trigger({ open, toggle })}</span>
  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="float {align}"
      class:fixed
      bind:this={panel}
      use:portal={fixed}
      onkeydown={onKeydown}
      style:width="min({width}px, calc(100vw - 24px))"
    >
      {@render children({ close })}
    </div>
  {/if}
</div>

<style>
  .popover {
    position: relative;
    display: inline-flex;
  }
  .anchor {
    display: inline-flex;
  }
  .float {
    position: absolute;
    top: calc(100% + 8px);
    z-index: 60;
    padding: 6px;
    background: var(--surface-raised);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    animation: pop 0.14s var(--ease);
  }
  .float.fixed {
    max-height: calc(100vh - 24px);
    overflow-y: auto;
    position: fixed;
    top: 0;
    left: 0;
    right: auto;
  }
  .float.end {
    right: 0;
  }
  .float.start {
    left: 0;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }
</style>
