<!-- Owner: Track 2 (Person A — Kanban CRUD and UI)
     Responsible for: the "add a card / add a list" control. It stays open after each Enter. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import Icon from "../shared/ui/Icon.svelte";

  let {
    label,
    placeholder,
    onadd,
    multiline = false,
    ghost = false,
    maxlength = 100,
  }: {
    label: string;
    placeholder: string;
    onadd: (title: string) => Promise<boolean>;
    multiline?: boolean;
    // ghost: dashed button style, for the "new list" slot
    ghost?: boolean;
    maxlength?: number;
  } = $props();

  let open = $state(false);
  let value = $state("");
  let field = $state<HTMLTextAreaElement | HTMLInputElement>();

  $effect(() => {
    if (open) field?.focus();
  });

  // lets the list menu open the composer
  export function show(): void {
    open = true;
  }

  async function submit(): Promise<void> {
    const title = value.trim();
    if (!title) return;
    value = "";
    if (!(await onadd(title))) value = title;
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      value = "";
      open = false;
    }
  }

  function onblur(event: FocusEvent): void {
    // do not close before the Add click lands
    if ((event.relatedTarget as HTMLElement | null)?.closest?.(".composer")) return;
    if (!value.trim()) open = false;
  }
</script>

{#if open}
  <form class="composer" class:ghost onsubmit={(e) => (e.preventDefault(), submit())}>
    {#if multiline}
      <textarea bind:this={field} bind:value rows="2" {maxlength} {placeholder} aria-label={placeholder} {onkeydown} {onblur}></textarea>
    {:else}
      <input bind:this={field} bind:value {maxlength} {placeholder} aria-label={placeholder} autocomplete="off" {onkeydown} {onblur} />
    {/if}
    <div class="actions">
      <button type="submit" class="btn btn-primary btn-sm" disabled={!value.trim()}>{t("common.add")}</button>
      <button
        type="button"
        class="icon-btn"
        aria-label={t("common.close")}
        onclick={() => {
          value = "";
          open = false;
        }}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  </form>
{:else}
  <button type="button" class="open" class:ghost onclick={() => (open = true)}>
    <Icon name="plus" size={16} />
    <span>{label}</span>
  </button>
{/if}

<style>
  .open {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: var(--radius);
    background: transparent;
    color: var(--text-soft);
    font-size: 0.9rem;
    font-weight: 550;
    text-align: left;
    transition: background-color 0.15s var(--ease), color 0.15s var(--ease);
  }
  .open:hover {
    background: color-mix(in srgb, var(--text) 7%, transparent);
    color: var(--text);
  }
  .open.ghost {
    justify-content: center;
    padding: 14px;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius-lg);
  }
  .open.ghost:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
  .composer {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .composer.ghost {
    padding: 10px;
    border: 1px solid var(--accent);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  textarea,
  input {
    width: 100%;
    padding: 9px 11px;
    resize: none;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: var(--surface-raised);
    box-shadow: 0 0 0 3px var(--accent-soft);
    outline: none;
    line-height: 1.4;
  }
  .composer.ghost input {
    box-shadow: none;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .actions .icon-btn {
    width: 32px;
    height: 32px;
  }
</style>
