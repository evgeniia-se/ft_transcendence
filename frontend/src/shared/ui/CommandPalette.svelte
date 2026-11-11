<script lang="ts">
  import { t } from "../i18n.svelte";
  import Icon from "./Icon.svelte";
  import { searchProject } from "../../api/accountApi";
  import type { SearchResult } from "../../api/types";
  import { cycleTheme, theme } from "../theme.svelte";
  import { isPageEnabled } from "../features";

  let { projectId, open = $bindable(false) }: { projectId: string; open: boolean } = $props();

  interface Entry {
    key: string;
    label: string;
    hint?: string;
    icon: string;
    run: () => void;
    disabled?: boolean;
  }

  let dialog: HTMLDialogElement;
  let input: HTMLInputElement;
  let query = $state("");
  let results = $state<SearchResult[]>([]);
  let searching = $state(false);
  let searchFailed = $state(false);
  let active = $state(0);

  const base = $derived(`/app/${projectId}`);

  // pages disabled in features.ts are hidden
  const navigation: Entry[] = $derived([
    { key: "board", label: t("nav.board"), icon: "columns", run: () => go(base) },
    ...(isPageEnabled("notes") ? [{ key: "notes", label: t("nav.notes"), icon: "note", run: () => go(`${base}/notes`) }] : []),
    ...(isPageEnabled("whiteboard") ? [{ key: "whiteboard", label: t("nav.whiteboard"), icon: "board", run: () => go(`${base}/whiteboard`) }] : []),
    { key: "files", label: t("nav.files"), icon: "folder", run: () => go(`${base}/files`) },
    { key: "search", label: t("palette.advancedSearch"), hint: t("palette.advancedHint"), icon: "search", run: () => go(searchHref()) },
    { key: "settings", label: t("palette.projectSettings"), icon: "settings", run: () => go(`${base}/settings`) },
    { key: "projects", label: t("palette.allProjects"), icon: "folder", run: () => go("/app") },
    {
      key: "theme",
      label: t("palette.changeTheme"),
      hint: t(`theme.${theme.pref}`),
      icon: "sun",
      run: () => cycleTheme(),
    },
  ]);

  const trimmed = $derived(query.trim());

  function searchHref(): string {
    return trimmed ? `${base}/search?q=${encodeURIComponent(trimmed)}` : `${base}/search`;
  }

  const entries: Entry[] = $derived.by(() => {
    if (!trimmed) return navigation;
    const matching = navigation.filter((e) => e.key !== "search" && e.label.toLowerCase().includes(trimmed.toLowerCase()));
    const advanced: Entry = { key: "search", label: t("palette.allResults", { q: trimmed }), hint: t("palette.advancedSearch"), icon: "search", run: () => go(searchHref()) };
    const found: Entry[] = results.map((r) => ({
      key: `${r.entityType}:${r.entityId}`,
      label: r.title,
      hint: r.snippet,
      icon: r.entityType === "card" ? "columns" : r.entityType === "note" ? "note" : "folder",
      disabled: r.entityType === "note" && !isPageEnabled("notes"),
      run: () => {
        if (r.entityType === "card") go(`${base}?card=${r.entityId}`);
        else if (r.entityType === "note") go(`${base}/notes/${r.entityId}`);
        else go(r.folderId ? `${base}/files?folder=${r.folderId}` : `${base}/files`);
      },
    }));
    return [...found, advanced, ...matching];
  });

  function go(href: string): void {
    open = false;
    // the board opens the card without a reload
    if (href.startsWith(`${base}?card=`) && window.location.pathname === base) {
      history.replaceState(null, "", href);
      window.dispatchEvent(new CustomEvent("palette:card", { detail: new URL(href, location.origin).searchParams.get("card") }));
      return;
    }
    window.location.href = href;
  }

  $effect(() => {
    if (open && !dialog.open) {
      query = "";
      results = [];
      active = 0;
      dialog.showModal();
      input?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  // debounced search; ignore stale answers
  let timer: ReturnType<typeof setTimeout> | undefined;
  let searchId = 0;
  $effect(() => {
    const q = trimmed;
    clearTimeout(timer);
    active = 0;
    if (!q) {
      results = [];
      searching = false;
      return;
    }
    searching = true;
    const id = ++searchId;
    timer = setTimeout(async () => {
      try {
        const found = await searchProject(projectId, q);
        if (id === searchId) {
          results = found;
          searchFailed = false;
        }
      } catch {
        if (id === searchId) {
          results = [];
          searchFailed = true;
        }
      } finally {
        if (id === searchId) searching = false;
      }
    }, 200);
    return () => clearTimeout(timer);
  });

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      active = Math.min(active + 1, entries.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = entries[active];
      if (entry && !entry.disabled) entry.run();
    }
  }

  $effect(() => {
    if (open) document.getElementById(`pal-${active}`)?.scrollIntoView({ block: "nearest" });
  });
</script>

<dialog
  class="modal"
  bind:this={dialog}
  aria-label={t("palette.label")}
  onclose={() => (open = false)}
  onclick={(event) => {
    if (event.target === dialog) open = false;
  }}
>
  <div class="search">
    <Icon name="search" size={18} />
    <input
      bind:this={input}
      bind:value={query}
      onkeydown={onKeydown}
      placeholder={t("palette.placeholder")}
      aria-label={t("nav.search")}
      role="combobox"
      aria-expanded="true"
      aria-controls="pal-list"
      aria-activedescendant={`pal-${active}`}
      autocomplete="off"
      spellcheck="false"
    />
    {#if searching}<span class="spinner"></span>{:else}<kbd>{t("palette.esc")}</kbd>{/if}
  </div>

  <ul id="pal-list" role="listbox">
    {#each entries as entry, i (entry.key)}
      <li role="option" id={`pal-${i}`} aria-selected={i === active} aria-disabled={entry.disabled}>
        <button
          type="button"
          class:active={i === active}
          disabled={entry.disabled}
          onmousemove={() => (active = i)}
          onclick={() => entry.run()}
        >
          <Icon name={entry.icon} size={17} />
          <span class="label">{entry.label}</span>
          {#if entry.hint}<span class="hint">{entry.hint}</span>{/if}
        </button>
      </li>
    {/each}
    {#if trimmed && !searching && results.length === 0}
      <li class="empty" role="presentation">
        {searchFailed ? t("palette.failed") : t("palette.noResult", { q: trimmed })}
      </li>
    {/if}
  </ul>
</dialog>

<style>
  dialog {
    width: min(620px, calc(100vw - 24px));
    margin-top: 14vh;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    height: 54px;
    border-bottom: 1px solid var(--line);
    color: var(--text-faint);
  }
  input {
    flex: 1;
    height: 100%;
    border: none;
    background: transparent;
    outline: none;
    font-size: 1rem;
    color: var(--text);
  }
  input::placeholder {
    color: var(--text-faint);
  }
  ul {
    list-style: none;
    padding: 6px;
    max-height: min(380px, 55vh);
    overflow-y: auto;
  }
  li button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    text-align: left;
  }
  li button.active {
    background: var(--accent-soft);
  }
  li button:disabled {
    opacity: 0.6;
  }
  .label {
    flex-shrink: 0;
    max-width: 55%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 550;
  }
  .hint {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-faint);
    font-size: 0.85rem;
    text-align: right;
  }
  .empty {
    padding: 22px 12px;
    text-align: center;
    color: var(--text-faint);
    font-size: 0.9rem;
  }
</style>
