<script lang="ts">
  import Icon from "./Icon.svelte";
  import { theme, setThemePref, type ThemePref } from "../theme.svelte";
  import { t, type MessageKey } from "../i18n.svelte";

  let { compact = false }: { compact?: boolean } = $props();

  const OPTIONS: { value: ThemePref; label: MessageKey; icon: string }[] = [
    { value: "system", label: "theme.system", icon: "monitor" },
    { value: "light", label: "theme.light", icon: "sun" },
    { value: "dark", label: "theme.dark", icon: "moon" },
  ];
</script>

<div class="switch" class:compact role="radiogroup" aria-label={t("theme.label")}>
  {#each OPTIONS as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={theme.pref === option.value}
      class:active={theme.pref === option.value}
      title={option.value === "system" ? t("theme.systemHint") : t(option.label)}
      onclick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        setThemePref(option.value, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
      }}
    >
      <Icon name={option.icon} size={15} />
      {#if !compact}<span>{t(option.label)}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .switch {
    display: flex;
    padding: 3px;
    gap: 2px;
    background: var(--bg-sunken);
    border-radius: 10px;
  }
  button {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-soft);
    font-size: 0.82rem;
    font-weight: 550;
    transition: background-color 0.15s var(--ease), color 0.15s var(--ease);
  }
  button:hover {
    color: var(--text);
  }
  button.active {
    background: var(--surface-raised);
    color: var(--text);
    box-shadow: var(--shadow-sm);
  }
  .compact button {
    min-width: 34px;
  }
</style>
