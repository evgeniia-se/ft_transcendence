<!-- Owner: Track 2 (Person A — Kanban CRUD and UI)
     Responsible for: the kanban page shell: header, toolbar and board. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { onMount } from "svelte";
  import AppHeader from "../shared/ui/AppHeader.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import { LoadGate } from "../shared/loadGate.svelte";
  import LoadStage from "../shared/ui/LoadStage.svelte";
  import Board from "./Board.svelte";
  import BoardSkeleton from "./BoardSkeleton.svelte";
  import CardDetail from "./CardDetail.svelte";
  import GitLinkModal from "./GitLinkModal.svelte";
  import Participants from "./Participants.svelte";
  import type { BoardStore } from "./boardStore.svelte";

  let { store }: { store: BoardStore } = $props();

  // skeleton only after 0.5 s (see LoadGate)
  const gate = new LoadGate({ delay: 500, enter: 700, leave: 380 });
  gate.start();
  $effect(() => {
    if (store.loadState !== "loading") gate.resolve();
  });

  let wantedCard = $state<string | null>(new URLSearchParams(window.location.search).get("card"));

  onMount(() => {
    void store.start().then(() => {
      // deep link: open the card from the URL
      if (wantedCard && store.board?.lists.some((l) => l.cards.some((c) => c.id === wantedCard))) store.openCardId = wantedCard;
      wantedCard = null;
    });

    // the palette asks to open a card
    const onPaletteCard = (event: Event) => {
      const id = (event as CustomEvent<string | null>).detail;
      if (id) store.openCardId = id;
    };
    window.addEventListener("palette:card", onPaletteCard);
    return () => {
      window.removeEventListener("palette:card", onPaletteCard);
      store.stop();
      gate.destroy();
    };
  });

  // keep ?card= in the URL without adding history entries
  $effect(() => {
    if (store.loadState !== "ready" || wantedCard) return;
    const url = new URL(window.location.href);
    if (store.openCardId) url.searchParams.set("card", store.openCardId);
    else url.searchParams.delete("card");
    history.replaceState(null, "", url);
  });

  $effect(() => {
    document.title = store.project ? `${store.project.name} · ${t("nav.board")} — Transcendance` : `${t("nav.board")} — Transcendance`;
  });

  const cardCount = $derived(store.board?.lists.reduce((n, l) => n + l.cards.length, 0) ?? 0);
  const filtering = $derived(store.filter.trim().length > 0);
</script>

<div class="page">
  <AppHeader project={store.project} active="board">
    {#snippet extra()}
      <Participants {store} />
    {/snippet}
  </AppHeader>

  {#if store.actionError}
    <div class="banner error" role="alert">
      <Icon name="alert" size={16} />
      <span>{store.actionError}</span>
      <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={() => store.dismissError()}><Icon name="x" size={16} /></button>
    </div>
  {/if}

  {#if !store.connected && store.loadState === "ready" && !store.accessDenied}
    <div class="banner warn" role="status" aria-live="polite">
      <Icon name="wifiOff" size={16} />
      <span>{t("board.offline")}</span>
    </div>
  {/if}

  <LoadStage {gate} label={t("board.loading")}>
    {#snippet skeleton()}
      <BoardSkeleton />
    {/snippet}
    {#snippet children()}
      {#if store.accessDenied}
        <div class="state">
          <div class="state-icon"><Icon name="lock" size={26} /></div>
          {#if store.accessLostReason === "deleted"}
            <h2>{t("board.deletedTitle")}</h2>
            <p>{t("board.deletedText")}</p>
          {:else if store.accessLostReason === "removed"}
            <h2>{t("board.removedTitle")}</h2>
            <p>{t("board.removedText")}</p>
          {:else}
            <h2>{t("board.noAccessTitle")}</h2>
            <p>{t("board.noAccessText")}</p>
          {/if}
          <a class="btn btn-primary" href="/app">{t("common.backToProjects")}</a>
        </div>
      {:else if store.loadState === "error"}
        <div class="state">
          <div class="state-icon"><Icon name="wifiOff" size={26} /></div>
          <h2>{t("board.loadFailed")}</h2>
          <p>{t("common.checkConnection")}</p>
          <button type="button" class="btn btn-primary" onclick={() => void store.load()}>{t("common.retry")}</button>
        </div>
      {:else}
        <div class="toolbar">
          <div class="filter">
            <Icon name="search" size={16} />
            <input
              type="search"
              bind:value={store.filter}
              placeholder={t("board.filter")}
              aria-label={t("board.filterLabel")}
              onkeydown={(e) => e.key === "Escape" && (store.filter = "")}
            />
            {#if filtering}
              <button type="button" class="clear" aria-label={t("board.clearFilter")} onclick={() => (store.filter = "")}><Icon name="x" size={14} /></button>
            {/if}
          </div>
          {#if filtering}
            <span class="count">{t("board.dragDisabled")}</span>
          {:else}
            <span class="count">{cardCount > 1 ? t("board.cards", { n: cardCount }) : t("board.card", { n: cardCount })}</span>
          {/if}
          <span class="spacer"></span>
          {#if !store.canEdit}
            <span class="chip" title={t("board.readOnlyHint")}><Icon name="eye" size={13} /> {t("board.readOnly")}</span>
          {/if}
        </div>
        <Board {store} />
      {/if}
    {/snippet}
  </LoadStage>
</div>

<CardDetail {store} />
<GitLinkModal {store} />

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - var(--footer-h, 0px));
    height: calc(100dvh - var(--footer-h, 0px));
    overflow: hidden;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 20px 10px;
  }
  :global(.reveal) .toolbar {
    animation: reveal-in 0.5s var(--ease) backwards;
    animation-delay: var(--reveal-base, 0ms);
  }
  .filter {
    display: flex;
    align-items: center;
    gap: 8px;
    width: min(280px, 100%);
    height: 36px;
    padding: 0 8px 0 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text-faint);
    transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease);
  }
  .filter:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .filter input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    outline: none;
    color: var(--text);
    font-size: 0.9rem;
  }
  .clear {
    display: inline-flex;
    padding: 5px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-faint);
  }
  .clear:hover {
    background: var(--bg-sunken);
    color: var(--text);
  }
  .count {
    font-size: 0.84rem;
    color: var(--text-faint);
  }
  .spacer {
    flex: 1;
  }
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    font-size: 0.86rem;
  }
  .banner.warn {
    background: var(--warn-soft);
    color: var(--warn);
  }
  .banner.error {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .banner span {
    flex: 1;
  }
  .banner .icon-btn {
    width: 28px;
    height: 28px;
    color: inherit;
  }
  .state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
  }
  .state p {
    max-width: 42ch;
    color: var(--text-soft);
  }
  .state-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: var(--bg-sunken);
    color: var(--text-soft);
  }
  @media (max-width: 600px) {
    .toolbar {
      padding: 12px 12px 8px;
    }
    .count {
      display: none;
    }
  }
</style>
