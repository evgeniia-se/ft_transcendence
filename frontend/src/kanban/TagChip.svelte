<script lang="ts">
  import type { Tag } from "./types";

  let { tag, small = false }: { tag: Pick<Tag, "name" | "color">; small?: boolean } = $props();
</script>

<span class="tag" class:small style:--tag={tag.color} title={tag.name}>
  <span class="dot"></span><span class="name">{tag.name}</span>
</span>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 2px 10px 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tag) 16%, transparent);
    color: color-mix(in srgb, var(--tag) 70%, var(--text));
    font-size: 0.76rem;
    font-weight: 620;
    line-height: 1.6;
  }
  .small {
    padding: 0 8px 0 6px;
    font-size: 0.72rem;
    line-height: 1.55;
  }
  .dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--tag);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
