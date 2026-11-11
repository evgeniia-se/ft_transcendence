<script lang="ts">
  import { initials } from "../initials";

  let {
    name,
    id = name,
    src = null,
    size = 32,
    online,
    ring = false,
  }: { name: string; id?: string; src?: string | null; size?: number; online?: boolean; ring?: boolean } = $props();

  const HUES = [150, 28, 205, 340, 262, 48, 180];

  function hueFor(key: string): number {
    let hash = 0;
    for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return HUES[hash % HUES.length];
  }

  // a new picture must not stay hidden because the previous one failed to load
  let broken = $state(false);
  $effect(() => {
    void src;
    broken = false;
  });
  const safeSrc = $derived(src && /^(https:\/\/|\/api\/avatars\/)/i.test(src) && !broken ? src : null);
  const hue = $derived(hueFor(id));
</script>

<span
  class="avatar"
  class:ring
  style:width="{size}px"
  style:height="{size}px"
  style:font-size="{Math.round(size * 0.38)}px"
  style:--hue={hue}
  title={name}
>
  {#if safeSrc}
    <img src={safeSrc} alt="" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
  {:else}
    {initials(name)}
  {/if}
  {#if online !== undefined}
    <span class="dot" class:online></span>
  {/if}
</span>

<style>
  .avatar {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 50%;
    background: hsl(var(--hue) 28% 86%);
    color: hsl(var(--hue) 40% 24%);
    font-weight: 700;
    letter-spacing: 0.02em;
    user-select: none;
  }
  :global(:root[data-theme="dark"]) .avatar {
    background: hsl(var(--hue) 22% 26%);
    color: hsl(var(--hue) 40% 86%);
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme="light"])) .avatar {
      background: hsl(var(--hue) 22% 26%);
      color: hsl(var(--hue) 40% 86%);
    }
  }
  .ring {
    box-shadow: 0 0 0 2px var(--surface);
  }
  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  .dot {
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--offline);
    border: 2px solid var(--surface);
  }
  .dot.online {
    background: var(--online);
  }
</style>
