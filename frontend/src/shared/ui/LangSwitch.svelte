<script lang="ts">
  import Icon from "./Icon.svelte";
  import { i18n, setLang, t, LANGUAGES, type Lang } from "../i18n.svelte";

  let { compact = false }: { compact?: boolean } = $props();
</script>

<label class="switch" class:compact title={t("lang.label")}>
  <Icon name="globe" size={15} />
  <select
    aria-label={t("lang.label")}
    value={i18n.lang}
    onchange={(event) => setLang(event.currentTarget.value as Lang)}
  >
    {#each LANGUAGES as option (option.value)}
      <option value={option.value}>{compact ? option.value.toUpperCase() : option.label}</option>
    {/each}
  </select>
</label>

<style>
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 10px;
    background: var(--bg-sunken);
    border-radius: 10px;
    color: var(--text-soft);
    cursor: pointer;
  }
  .switch:hover {
    color: var(--text);
  }
  select {
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 550;
    cursor: pointer;
  }
  select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 4px;
  }
  option {
    color: var(--text);
    background: var(--surface-raised);
  }
</style>
