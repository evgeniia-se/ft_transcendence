<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { onMount } from "svelte";
  import { ApiError } from "../api/apiClient";
  import { getProject, listMembers } from "../api/projectsApi";
  import type { Member, Project } from "../api/types";
  import { getStoredUser } from "../auth/authClient";
  import { LoadGate } from "../shared/loadGate.svelte";
  import AppHeader from "../shared/ui/AppHeader.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import LoadStage from "../shared/ui/LoadStage.svelte";
  import { ensureUser } from "../shared/session";
  import ApiKeysSection from "./ApiKeysSection.svelte";
  import DangerSection from "./DangerSection.svelte";
  import GeneralSection from "./GeneralSection.svelte";
  import InvitesSection from "./InvitesSection.svelte";
  import MembersSection from "./MembersSection.svelte";

  let { projectId }: { projectId: string } = $props();

  const SECTIONS = [
    { key: "general", label: "ps.general", icon: "settings" },
    { key: "membres", label: "ps.members", icon: "users" },
    { key: "invitations", label: "ps.invites", icon: "link" },
    { key: "api", label: "ps.apiKeys", icon: "key" },
    { key: "danger", label: "ps.danger", icon: "alert" },
  ] as const;
  type SectionKey = (typeof SECTIONS)[number]["key"];

  let project = $state<Project | null>(null);
  let members = $state<Member[]>([]);
  let userId = $state<string | null>(getStoredUser()?.id ?? null);
  let phase = $state<"loading" | "ready" | "denied" | "error">("loading");
  let section = $state<SectionKey>(sectionFromHash());

  // skeleton only after 0.5 s (see LoadGate)
  const gate = new LoadGate({ delay: 500, enter: 600, leave: 380 });
  gate.start();
  $effect(() => {
    if (phase !== "loading") gate.resolve();
  });

  const me = $derived(members.find((m) => m.userId === userId) ?? null);
  const isAdmin = $derived(me?.role === "admin");
  const isOwner = $derived(!!project && project.ownerId === userId);

  function sectionFromHash(): SectionKey {
    const hash = window.location.hash.replace("#", "");
    return SECTIONS.some((s) => s.key === hash) ? (hash as SectionKey) : "general";
  }

  function go(key: SectionKey): void {
    section = key;
    history.replaceState(null, "", `#${key}`);
  }

  async function load(): Promise<void> {
    try {
      const [p, m, user] = await Promise.all([getProject(projectId), listMembers(projectId), ensureUser()]);
      project = p;
      members = m;
      userId = user?.id ?? userId;
      phase = "ready";
    } catch (err) {
      if (phase !== "ready") phase = err instanceof ApiError && (err.status === 403 || err.status === 404) ? "denied" : "error";
    }
  }

  onMount(() => {
    void load();
  });

  $effect(() => {
    document.title = project ? `${t("nav.settings")} · ${project.name} — Transcendance` : `${t("nav.settings")} — Transcendance`;
  });
</script>

<svelte:window onhashchange={() => (section = sectionFromHash())} />

<AppHeader project={project ?? undefined} active="settings" />

<main>
  <LoadStage {gate} label={t("ps.loading")}>
    {#snippet skeleton()}
      <div class="layout">
        <div class="sk-nav sk-enter" style:--i="0">
          <div class="sk-line sk-title"></div>
          {#each [0, 1, 2, 3, 4] as i (i)}<div class="skeleton sk-item"></div>{/each}
        </div>
        <div class="sk-content">
          <div class="sk-enter" style:--i="1"><div class="sk-line sk-h"></div><div class="sk-line sk-p"></div></div>
          {#each [2, 3] as i (i)}
            <div class="panel sk-enter" style:--i={i}>
              <div class="sk-line sk-label"></div>
              <div class="skeleton sk-input"></div>
              <div class="skeleton sk-btn"></div>
            </div>
          {/each}
        </div>
      </div>
    {/snippet}
    {#snippet children()}
    {#if phase === "denied"}
      <div class="center">
        <div class="state-icon"><Icon name="lock" size={26} /></div>
        <h2>{t("board.noAccessTitle")}</h2>
        <p>{t("ps.noAccessText")}</p>
        <a class="btn btn-primary" href="/app">{t("common.backToProjects")}</a>
      </div>
    {:else if phase === "error" || !project}
      <div class="center">
        <div class="state-icon"><Icon name="wifiOff" size={26} /></div>
        <h2>{t("ps.loadFailed")}</h2>
        <p>{t("common.checkConnection")}</p>
        <button type="button" class="btn btn-primary" onclick={load}>{t("common.retry")}</button>
      </div>
    {:else}
      <div class="layout">
        <nav aria-label={t("ps.sections")}>
          <h1>{t("nav.settings")}</h1>
          {#each SECTIONS as s (s.key)}
            <button type="button" class:active={section === s.key} class:danger={s.key === "danger"} aria-current={section === s.key ? "page" : undefined} onclick={() => go(s.key)}>
              <Icon name={s.icon} size={16} />
              <span>{t(s.label)}</span>
            </button>
          {/each}
        </nav>

        <div class="content">
          {#if !isAdmin}
            <div class="alert alert-info">
              <Icon name="info" size={17} />
              <span>{t("ps.youAre")} <strong>{(me?.role === "member" ? t("role.member") : t("role.viewer")).toLowerCase()}</strong> {t("ps.adminOnly")}</span>
            </div>
          {/if}

          {#if section === "general"}
            <GeneralSection {project} {members} {isAdmin} onchange={(p) => (project = p)} />
          {:else if section === "membres"}
            <MembersSection {project} bind:members {isAdmin} {userId} onchange={load} />
          {:else if section === "invitations"}
            <InvitesSection {project} {isAdmin} />
          {:else if section === "api"}
            <ApiKeysSection {project} {isAdmin} />
          {:else}
            <DangerSection {project} {members} {isOwner} {userId} onchange={(p) => ((project = p), void load())} />
          {/if}
        </div>
      </div>
    {/if}
    {/snippet}
  </LoadStage>
</main>

<style>
  main {
    max-width: 1000px;
    margin: 0 auto;
    padding: 36px 24px 90px;
  }
  .layout {
    display: grid;
    grid-template-columns: 210px minmax(0, 1fr);
    gap: 40px;
    align-items: start;
  }
  nav {
    position: sticky;
    top: calc(var(--header-h) + 24px);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  nav h1 {
    font-size: 1.5rem;
    margin-bottom: 14px;
  }
  nav button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--text-soft);
    font-size: 0.92rem;
    font-weight: 550;
    text-align: left;
    transition: background-color 0.15s var(--ease), color 0.15s var(--ease);
  }
  nav button:hover {
    background: var(--bg-sunken);
    color: var(--text);
  }
  nav button.active {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
  nav button.danger:not(.active) {
    color: var(--danger);
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-width: 0;
  }
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 80px 0;
    text-align: center;
  }
  .center p {
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
  .sk-nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sk-title {
    width: 60%;
    height: 22px;
    margin-bottom: 14px;
    background: var(--line-strong);
  }
  .sk-item {
    height: 38px;
    border-radius: 9px;
  }
  .sk-content {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .sk-h {
    width: 30%;
    height: 20px;
    background: var(--line-strong);
  }
  .sk-p {
    width: 62%;
    margin-top: 12px;
  }
  .sk-label {
    width: 24%;
  }
  .sk-input {
    height: 42px;
  }
  .sk-btn {
    width: 120px;
    height: 38px;
  }
  /* entrance animation */
  :global(.reveal) nav,
  :global(.reveal) .content > :global(*) {
    animation: reveal-in 0.5s var(--ease) backwards;
    animation-delay: var(--reveal-base, 0ms);
  }
  :global(.reveal) .content > :global(*:nth-child(2)) {
    animation-delay: calc(var(--reveal-base, 0ms) + 70ms);
  }
  :global(.reveal) .content > :global(*:nth-child(n + 3)) {
    animation-delay: calc(var(--reveal-base, 0ms) + 140ms);
  }
  @media (max-width: 760px) {
    main {
      padding: 20px 16px 70px;
    }
    .layout {
      grid-template-columns: 1fr;
      gap: 20px;
    }
    nav {
      position: static;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 4px;
    }
    nav h1 {
      width: 100%;
      margin-bottom: 6px;
    }
  }
</style>
