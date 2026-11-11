<script lang="ts">
  import { t } from "../i18n.svelte";
  import Icon from "./Icon.svelte";
  import Popover from "./Popover.svelte";
  import { listMyProjects } from "../../api/projectsApi";
  import type { Project } from "../../api/types";

  let { current }: { current: { id: string; name: string } } = $props();

  let projects = $state<Project[] | null>(null);
  let failed = $state(false);

  // skeleton only after 0.5 s
  let slow = $state(false);
  $effect(() => {
    if (projects !== null || failed) return;
    const timer = setTimeout(() => (slow = true), 500);
    return () => clearTimeout(timer);
  });

  async function load(): Promise<void> {
    try {
      projects = await listMyProjects();
      failed = false;
    } catch {
      failed = true;
    }
  }
</script>

<Popover align="start" width={280} onopen={() => void load()}>
  {#snippet trigger({ open, toggle })}
    <button type="button" class="name" aria-expanded={open} aria-haspopup="menu" onclick={toggle} title={t("switcher.change")}>
      <span class="text">{current.name}</span>
      <Icon name="chevronDown" size={15} />
    </button>
  {/snippet}
  {#snippet children({ close })}
    <div class="label">{t("userMenu.projects")}</div>
    {#if failed}
      <p class="note">{t("switcher.loadFailed")}</p>
    {:else if projects === null}
      {#if slow}
        <div class="skeleton row-skel sk-enter" style:--i="0"></div>
        <div class="skeleton row-skel sk-enter" style:--i="1"></div>
      {/if}
    {:else}
      {#each projects as project (project.id)}
        <a class="item" class:current={project.id === current.id} href={`/app/${project.id}`} onclick={close}>
          <span class="text">{project.name}</span>
          {#if project.id === current.id}<Icon name="check" size={15} />{/if}
        </a>
      {/each}
    {/if}
    <div class="divider"></div>
    <a class="item" href="/app#nouveau" onclick={close}><Icon name="plus" size={15} /> {t("switcher.newProject")}</a>
  {/snippet}
</Popover>

<style>
  .name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: min(280px, 38vw);
    min-width: 0;
    padding: 6px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-family: var(--font-serif);
    font-size: 1.08rem;
    font-weight: 600;
    color: var(--text);
  }
  .name:hover {
    background: var(--bg-sunken);
  }
  .name :global(svg) {
    flex: none;
  }
  .text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label {
    padding: 6px 10px 4px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 8px;
    color: var(--text);
    text-decoration: none;
    font-size: 0.92rem;
  }
  .item:hover {
    background: var(--bg-sunken);
    color: var(--text);
  }
  .item.current {
    color: var(--accent-strong);
    font-weight: 600;
  }
  .divider {
    height: 1px;
    background: var(--line);
    margin: 4px 2px;
  }
  .note {
    padding: 10px;
    color: var(--text-faint);
    font-size: 0.88rem;
  }
  .row-skel {
    height: 34px;
    margin: 4px;
  }
</style>
