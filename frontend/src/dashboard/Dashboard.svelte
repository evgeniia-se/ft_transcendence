<!-- Owner: Track 1 (Foundation, Auth, and API infrastructure)
     Responsible for: the /app page: project list and project creation. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { onMount } from "svelte";
  import { createProject, listMyProjects } from "../api/projectsApi";
  import type { Project } from "../api/types";
  import { getStoredUser } from "../auth/authClient";
  import { errorMessage } from "../shared/errors";
  import { formatDateShort, greeting } from "../shared/format";
  import { ensureUser } from "../shared/session";
  import { LoadGate } from "../shared/loadGate.svelte";
  import AppHeader from "../shared/ui/AppHeader.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import LoadStage from "../shared/ui/LoadStage.svelte";

  $effect(() => {
    document.title = `${t("userMenu.projects")} · Transcendance`;
  });

  let projects = $state<Project[] | null>(null);
  let loadFailed = $state(false);
  let user = $state(getStoredUser());
  let filter = $state("");

  // skeleton only after 0.5 s (see LoadGate)
  const gate = new LoadGate({ delay: 500, enter: 650, leave: 380 });
  gate.start();
  $effect(() => {
    if (projects !== null || loadFailed) gate.resolve();
  });

  let dialog: HTMLDialogElement;
  let name = $state("");
  let busy = $state(false);
  let formError = $state<string | null>(null);

  const sorted = $derived([...(projects ?? [])].sort((a, b) => a.name.localeCompare(b.name, "fr")));
  const visible = $derived(
    filter.trim() ? sorted.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase())) : sorted
  );

  onMount(() => {
    void ensureUser().then((u) => (user = u));
    void load();
    // opened by the #nouveau link
    if (window.location.hash === "#nouveau") openCreate();
  });

  async function load(): Promise<void> {
    loadFailed = false;
    try {
      projects = await listMyProjects();
    } catch {
      loadFailed = true;
    }
  }

  function openCreate(): void {
    name = "";
    formError = null;
    dialog.showModal();
  }

  function closeCreate(): void {
    if (busy) return;
    dialog.close();
    if (window.location.hash === "#nouveau") history.replaceState(null, "", window.location.pathname);
  }

  async function onCreate(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const wanted = name.trim();
    if (!wanted || busy) return;
    busy = true;
    formError = null;
    try {
      const project = await createProject(wanted);
      // open the new project right away
      window.location.href = `/app/${project.id}`;
    } catch (err) {
      busy = false;
      formError = errorMessage(err, t("dash.createFailed"));
    }
  }

  const HUES = [150, 28, 205, 340, 262, 48, 180];
  function hueFor(id: string): number {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return HUES[hash % HUES.length];
  }
</script>

<svelte:window onhashchange={() => window.location.hash === "#nouveau" && openCreate()} />

<AppHeader />

<main>
  <header class="intro">
    <div>
      <h1>{user ? greeting(user.name) : t("userMenu.projects")}</h1>
      <p class="sub">
        {#if projects === null && !loadFailed}
          {t("dash.loading")}
        {:else if projects && projects.length > 0}
          {projects.length === 1 ? t("dash.oneProject") : t("dash.manyProjects", { n: projects.length })}
        {:else if !loadFailed}
          {t("dash.startFirst")}
        {/if}
      </p>
    </div>
    <div class="tools">
      {#if projects && projects.length > 5}
        <div class="filter">
          <Icon name="search" size={16} />
          <input type="search" bind:value={filter} placeholder={t("dash.filter")} aria-label={t("dash.filterLabel")} />
        </div>
      {/if}
      <button type="button" class="btn btn-primary" onclick={openCreate}><Icon name="plus" size={17} /> {t("switcher.newProject")}</button>
    </div>
  </header>

  <LoadStage {gate} label={t("dash.loading")}>
    {#snippet skeleton()}
      <div class="grid">
        {#each [0, 1, 2, 3] as i (i)}
          <div class="tile sk-tile sk-enter" style:--i={i}>
            <div class="skeleton sk-badge"></div>
            <div class="sk-meta">
              <div class="sk-line sk-name" style:width="{[62, 48, 70, 54][i]}%"></div>
              <div class="sk-line sk-sub"></div>
            </div>
          </div>
        {/each}
      </div>
    {/snippet}
    {#snippet children()}
    {#if loadFailed}
      <div class="empty surface">
        <Icon name="wifiOff" size={26} />
        <h2>{t("dash.loadFailed")}</h2>
        <p>{t("common.checkConnection")}</p>
        <button type="button" class="btn" onclick={load}>{t("common.retry")}</button>
      </div>
    {:else if projects && projects.length === 0}
      <div class="empty surface">
        <span class="empty-icon"><Icon name="folder" size={26} /></span>
        <h2>{t("dash.emptyTitle")}</h2>
        <p>{t("dash.emptyText")}</p>
        <button type="button" class="btn btn-primary" onclick={openCreate}><Icon name="plus" size={17} /> {t("dash.createFirst")}</button>
      </div>
    {:else}
      <div class="grid">
        {#each visible as project, i (project.id)}
          <a class="tile project" style:--i={Math.min(i, 10)} href={`/app/${project.id}`}>
            <span class="badge" style:--hue={hueFor(project.id)}>{project.name.trim().slice(0, 2).toUpperCase()}</span>
            <span class="meta">
              <span class="title">{project.name}</span>
              <span class="detail">
                {#if user && project.ownerId === user.id}<span class="chip chip-accent">{t("dash.owner")}</span>{/if}
                <span class="date">{t("dash.createdOn", { date: formatDateShort(project.createdAt) })}</span>
              </span>
            </span>
            <span class="go"><Icon name="arrowRight" size={18} /></span>
          </a>
        {/each}
      </div>

      {#if filter.trim() && visible.length === 0}
        <p class="no-match">{t("dash.noMatch", { q: filter.trim() })}</p>
      {/if}
    {/if}
    {/snippet}
  </LoadStage>
</main>

<dialog class="modal" bind:this={dialog} aria-labelledby="create-title" onclose={() => (formError = null)} onclick={(e) => e.target === dialog && closeCreate()}>
  <form onsubmit={onCreate}>
    <h2 id="create-title">{t("switcher.newProject")}</h2>
    <div class="field">
      <label for="project-name">{t("dash.projectName")}</label>
      <input
        id="project-name"
        class="input"
        bind:value={name}
        maxlength="100"
        placeholder={t("dash.projectNamePlaceholder")}
        autocomplete="off"
        aria-invalid={formError ? "true" : undefined}
        aria-describedby={formError ? "create-error" : undefined}
      />
      {#if formError}<span class="field-error" id="create-error" role="alert">{formError}</span>{/if}
    </div>
    <div class="actions">
      <button type="button" class="btn btn-ghost" onclick={closeCreate}>{t("common.cancel")}</button>
      <button type="submit" class="btn btn-primary" disabled={!name.trim() || busy}>
        {#if busy}<span class="spinner"></span>{/if} {t("dash.createOpen")}
      </button>
    </div>
  </form>
</dialog>

<style>
  main {
    max-width: 1040px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }
  .intro {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px 24px;
    flex-wrap: wrap;
    margin-bottom: 28px;
  }
  .sub {
    margin-top: 6px;
    color: var(--text-soft);
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .filter {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 12px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-raised);
    color: var(--text-faint);
  }
  .filter:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .filter input {
    width: 160px;
    border: none;
    background: transparent;
    outline: none;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 14px;
  }
  .tile {
    display: flex;
    min-height: 92px;
    border-radius: var(--radius-lg);
  }
  .sk-tile {
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-sm);
  }
  .sk-badge {
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    border-radius: 13px;
  }
  .sk-meta {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }
  .sk-name {
    height: 12px;
    background: var(--line-strong);
  }
  .sk-sub {
    width: 38%;
  }
  /* entrance animation */
  :global(.reveal) .project {
    animation: reveal-in 0.5s var(--ease) backwards;
    animation-delay: calc(var(--reveal-base, 0ms) + var(--i, 0) * 60ms);
  }
  :global(.reveal) .empty {
    animation: reveal-in 0.5s var(--ease) backwards;
    animation-delay: var(--reveal-base, 0ms);
  }
  .project {
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    text-decoration: none;
    box-shadow: var(--shadow-sm);
    transition: transform 0.18s var(--ease), box-shadow 0.18s var(--ease), border-color 0.18s var(--ease);
  }
  .project:hover {
    transform: translateY(-2px);
    border-color: var(--line-strong);
    box-shadow: var(--shadow-md);
    color: var(--text);
  }
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    border-radius: 13px;
    background: hsl(var(--hue) 30% 87%);
    color: hsl(var(--hue) 42% 24%);
    font-family: var(--font-serif);
    font-size: 1.05rem;
    font-weight: 700;
  }
  :global(:root[data-theme="dark"]) .badge {
    background: hsl(var(--hue) 22% 25%);
    color: hsl(var(--hue) 45% 86%);
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme="light"])) .badge {
      background: hsl(var(--hue) 22% 25%);
      color: hsl(var(--hue) 45% 86%);
    }
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-width: 0;
  }
  .title {
    font-family: var(--font-serif);
    font-size: 1.12rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    flex-wrap: wrap;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: var(--text-faint);
  }
  .date {
    white-space: nowrap;
  }
  .go {
    color: var(--text-faint);
    opacity: 0;
    transform: translateX(-4px);
    transition: opacity 0.18s var(--ease), transform 0.18s var(--ease);
  }
  .project:hover .go {
    opacity: 1;
    transform: none;
    color: var(--accent);
  }
  dialog {
    width: min(440px, calc(100vw - 24px));
  }
  dialog form {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 24px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .empty-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    border-radius: 18px;
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 56px 24px;
    text-align: center;
    color: var(--text-soft);
  }
  .no-match {
    margin-top: 24px;
    text-align: center;
    color: var(--text-faint);
  }
  @media (max-width: 560px) {
    main {
      padding: 24px 16px 60px;
    }
    h1 {
      font-size: 1.55rem;
    }
  }
</style>
