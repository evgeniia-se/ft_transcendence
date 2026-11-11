<script lang="ts">
  import { t, type MessageKey } from "../shared/i18n.svelte";
  import { onMount } from "svelte";
  import { ApiError } from "../api/apiClient";
  import { searchProjectPage } from "../api/accountApi";
  import { getProject, listMembers } from "../api/projectsApi";
  import type { Member, Project, SearchFilters, SearchResult, SearchSort, SearchType } from "../api/types";
  import { fetchTags } from "../kanban/boardApi";
  import TagChip from "../kanban/TagChip.svelte";
  import type { Tag } from "../kanban/types";
  import { errorMessage } from "../shared/errors";
  import { formatDate } from "../shared/format";
  import { isPageEnabled } from "../shared/features";
  import AppHeader from "../shared/ui/AppHeader.svelte";
  import Icon from "../shared/ui/Icon.svelte";

  let { projectId }: { projectId: string } = $props();

  const TYPES: { key: SearchType; label: MessageKey; one: MessageKey; icon: string }[] = [
    { key: "card", label: "search.cards", one: "search.card", icon: "columns" },
    { key: "note", label: "nav.notes", one: "notes.note", icon: "note" },
    { key: "attachment", label: "nav.files", one: "search.file", icon: "folder" },
  ];
  const SORTS: { key: SearchSort; label: MessageKey }[] = [
    { key: "relevance", label: "search.relevance" },
    { key: "date", label: "search.newest" },
    { key: "title", label: "search.titleAz" },
  ];
  const LIMITS = [10, 20, 50];
  const MAX_QUERY = 200;

  let project = $state<Project | null>(null);
  let members = $state<Member[]>([]);
  let tags = $state<Tag[]>([]);

  const initial = fromUrl();
  let filters = $state<SearchFilters>(initial);
  let draft = $state(initial.q);

  let results = $state<SearchResult[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let problem = $state<string | null>(null);

  const pages = $derived(Math.max(1, Math.ceil(total / filters.limit)));
  const dateError = $derived(filters.from && filters.to && filters.from > filters.to ? t("search.dateOrder") : null);
  const queryError = $derived(draft.trim().length > MAX_QUERY ? t("search.tooLong", { max: MAX_QUERY }) : null);
  const active = $derived(
    filters.types.length < TYPES.length || !!filters.tag || !!filters.author || !!filters.from || !!filters.to
  );

  function fromUrl(): SearchFilters {
    const params = new URL(window.location.href).searchParams;
    const types = (params.get("type") ?? "").split(",").filter((t): t is SearchType => TYPES.some((x) => x.key === t));
    const sort = params.get("sort") as SearchSort | null;
    const page = Number(params.get("page"));
    const limit = Number(params.get("limit"));
    return {
      q: params.get("q") ?? "",
      types: types.length > 0 ? types : TYPES.map((t) => t.key),
      tag: params.get("tag") ?? "",
      author: params.get("author") ?? "",
      from: params.get("from") ?? "",
      to: params.get("to") ?? "",
      sort: sort && SORTS.some((s) => s.key === sort) ? sort : "relevance",
      page: Number.isInteger(page) && page > 0 ? page : 1,
      limit: LIMITS.includes(limit) ? limit : 20,
    };
  }

  function toUrl(): void {
    const url = new URL(window.location.href);
    url.search = "";
    const p = url.searchParams;
    if (filters.q) p.set("q", filters.q);
    if (filters.types.length < TYPES.length) p.set("type", filters.types.join(","));
    if (filters.tag) p.set("tag", filters.tag);
    if (filters.author) p.set("author", filters.author);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (filters.sort !== "relevance") p.set("sort", filters.sort);
    if (filters.page > 1) p.set("page", String(filters.page));
    if (filters.limit !== 20) p.set("limit", String(filters.limit));
    history.replaceState(null, "", url);
  }

  let requestId = 0;
  async function run(): Promise<void> {
    toUrl();
    if (dateError || filters.types.length === 0) {
      results = [];
      total = 0;
      return;
    }
    const id = ++requestId;
    loading = true;
    problem = null;
    try {
      const page = await searchProjectPage(projectId, filters);
      if (id !== requestId) return;
      results = page.results;
      total = page.total;
      if (filters.page > 1 && page.results.length === 0 && page.total > 0) {
        filters.page = Math.ceil(page.total / filters.limit);
        void run();
      }
    } catch (err) {
      if (id !== requestId) return;
      results = [];
      total = 0;
      problem = err instanceof ApiError && err.status === 400 ? err.details.join(" ") || errorMessage(err) : errorMessage(err);
    } finally {
      if (id === requestId) loading = false;
    }
  }

  function update(patch: Partial<SearchFilters>): void {
    filters = { ...filters, page: 1, ...patch };
    void run();
  }

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    if (queryError) return;
    update({ q: draft.trim() });
  }

  function toggleType(key: SearchType): void {
    const has = filters.types.includes(key);
    if (has && filters.types.length === 1) return;
    update({ types: has ? filters.types.filter((t) => t !== key) : [...filters.types, key] });
  }

  function reset(): void {
    update({ types: TYPES.map((t) => t.key), tag: "", author: "", from: "", to: "" });
  }

  function goTo(page: number): void {
    filters = { ...filters, page };
    void run();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function hrefFor(result: SearchResult): string | null {
    const base = `/app/${projectId}`;
    if (result.entityType === "card") return `${base}?card=${result.entityId}`;
    if (result.entityType === "note") return isPageEnabled("notes") ? `${base}/notes/${result.entityId}` : null;
    return result.folderId ? `${base}/files?folder=${result.folderId}` : `${base}/files`;
  }

  function typeOf(result: SearchResult): (typeof TYPES)[number] {
    return TYPES.find((t) => t.key === result.entityType) ?? TYPES[0];
  }

  $effect(() => {
    document.title = project ? `${t("search.title")} · ${project.name} — Transcendance` : `${t("search.title")} — Transcendance`;
  });

  onMount(() => {
    void getProject(projectId)
      .then((p) => (project = p))
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) window.location.replace("/app");
      });
    void listMembers(projectId)
      .then((m) => (members = m))
      .catch(() => {});
    void fetchTags(projectId)
      .then((t) => (tags = t))
      .catch(() => {});
    void run();
  });
</script>

<AppHeader project={project ?? undefined} />

<main class="page">
  <header class="title">
    <span class="badge"><Icon name="search" size={20} /></span>
    <h1>{t("palette.advancedSearch")}</h1>
  </header>

  <form class="bar" role="search" onsubmit={submit}>
    <label class="sr-only" for="search-q">{t("search.inProject")}</label>
    <div class="query" class:invalid={!!queryError}>
      <Icon name="search" size={18} />
      <input
        id="search-q"
        type="search"
        bind:value={draft}
        placeholder={t("search.placeholder")}
        autocomplete="off"
        maxlength={MAX_QUERY}
        aria-invalid={queryError ? "true" : undefined}
        aria-describedby={queryError ? "q-err" : undefined}
      />
    </div>
    <button type="submit" class="btn btn-primary" disabled={!!queryError}>{t("nav.search")}</button>
  </form>
  {#if queryError}<p class="field-error" id="q-err" role="alert">{queryError}</p>{/if}

  <section class="panel filters" aria-label={t("search.filters")}>
    <fieldset class="types">
      <legend class="label">{t("search.type")}</legend>
      {#each TYPES as type (type.key)}
        <label class="toggle" class:on={filters.types.includes(type.key)}>
          <input type="checkbox" checked={filters.types.includes(type.key)} onchange={() => toggleType(type.key)} />
          <Icon name={type.icon} size={15} />
          <span>{t(type.label)}</span>
        </label>
      {/each}
    </fieldset>

    <div class="grid">
      <div class="field">
        <label for="f-tag">{t("search.tag")}</label>
        <select id="f-tag" class="input" value={filters.tag} onchange={(e) => update({ tag: e.currentTarget.value })}>
          <option value="">{t("search.allTags")}</option>
          {#each tags as tag (tag.id)}<option value={tag.id}>{tag.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="f-author">{t("search.author")}</label>
        <select id="f-author" class="input" value={filters.author} onchange={(e) => update({ author: e.currentTarget.value })}>
          <option value="">{t("search.everyone")}</option>
          {#each members as member (member.userId)}<option value={member.userId}>{member.user.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="f-from">{t("search.after")}</label>
        <input id="f-from" class="input" type="date" value={filters.from} max={filters.to || undefined} aria-invalid={dateError ? "true" : undefined} onchange={(e) => update({ from: e.currentTarget.value })} />
      </div>
      <div class="field">
        <label for="f-to">{t("search.before")}</label>
        <input id="f-to" class="input" type="date" value={filters.to} min={filters.from || undefined} aria-invalid={dateError ? "true" : undefined} onchange={(e) => update({ to: e.currentTarget.value })} />
      </div>
    </div>
    {#if dateError}<p class="field-error" role="alert">{dateError}</p>{/if}
    {#if filters.tag}<p class="hint">{t("search.tagHint")}</p>{/if}
    {#if active}<div><button type="button" class="btn btn-ghost btn-sm" onclick={reset}><Icon name="x" size={14} /> {t("search.clear")}</button></div>{/if}
  </section>

  <div class="summary">
    <p aria-live="polite">
      {#if loading}
        {t("search.searching")}
      {:else if total === 0}
        {t("search.none")}
      {:else}
        {total > 1 ? t("search.results", { n: total }) : t("search.result", { n: total })}{filters.q ? ` ${t("search.for", { q: filters.q })}` : ""}
      {/if}
    </p>
    <div class="sort">
      <label for="f-sort" class="label">{t("search.sortBy")}</label>
      <select id="f-sort" class="input" value={filters.sort} onchange={(e) => update({ sort: e.currentTarget.value as SearchSort })}>
        {#each SORTS as sort (sort.key)}<option value={sort.key}>{t(sort.label)}</option>{/each}
      </select>
    </div>
  </div>

  {#if problem}
    <p class="alert" role="alert"><Icon name="alert" size={17} /> {problem}</p>
  {:else if !loading && results.length === 0}
    <p class="empty">{filters.q || active ? t("search.tryOther") : t("search.emptyProject")}</p>
  {:else}
    <ul class="results" class:dim={loading}>
      {#each results as result (`${result.entityType}:${result.entityId}`)}
        {@const type = typeOf(result)}
        {@const href = hrefFor(result)}
        <li>
          <svelte:element this={href ? "a" : "div"} class="result" {href}>
            <span class="kind" title={t(type.label)}><Icon name={type.icon} size={17} /></span>
            <div class="body">
              <div class="head">
                <span class="name">{result.title}</span>
                <span class="chip">{t(type.one)}</span>
              </div>
              {#if result.snippet && result.snippet !== result.title}<p class="snippet">{result.snippet}</p>{/if}
              <div class="meta">
                {#each result.tags as tag (tag.id)}<TagChip {tag} small />{/each}
                <span>{result.author?.name ?? t("search.unknownAuthor")}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDate(result.date)}</span>
              </div>
            </div>
          </svelte:element>
        </li>
      {/each}
    </ul>
  {/if}

  {#if total > 0}
    <nav class="pager" aria-label={t("search.pagination")}>
      <button type="button" class="btn btn-sm" disabled={filters.page <= 1 || loading} onclick={() => goTo(filters.page - 1)}>
        <Icon name="chevronLeft" size={15} /> {t("search.prev")}
      </button>
      <span>{t("search.page", { n: filters.page, m: pages })}</span>
      <button type="button" class="btn btn-sm" disabled={filters.page >= pages || loading} onclick={() => goTo(filters.page + 1)}>
        {t("search.next")} <Icon name="chevronRight" size={15} />
      </button>
      <label class="per-page">
        <span class="label">{t("search.perPage")}</span>
        <select class="input" value={filters.limit} onchange={(e) => update({ limit: Number(e.currentTarget.value) })}>
          {#each LIMITS as limit (limit)}<option value={limit}>{limit}</option>{/each}
        </select>
      </label>
    </nav>
  {/if}
</main>

<style>
  .page {
    max-width: 56rem;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    margin-bottom: 1.25rem;
  }
  .badge {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: var(--radius);
    background: var(--accent-soft);
    color: var(--accent);
  }
  h1 {
    margin: 0;
    font-size: 1.6rem;
  }
  .bar {
    display: flex;
    gap: 10px;
    margin-bottom: 8px;
  }
  .query {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 0 12px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-raised);
    color: var(--text-faint);
  }
  .query:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .query.invalid {
    border-color: var(--danger);
  }
  .query input {
    flex: 1;
    min-width: 0;
    min-height: 42px;
    border: none;
    background: transparent;
    outline: none;
    color: var(--text);
  }
  .filters {
    margin: 14px 0 18px;
    gap: 14px;
  }
  .types {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    border: none;
    padding: 0;
    margin: 0;
  }
  .types legend {
    float: left;
    margin-right: 6px;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    color: var(--text-soft);
    font-size: 0.88rem;
    font-weight: 550;
    cursor: pointer;
  }
  .toggle.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
  .toggle input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .toggle:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 12px;
  }
  .summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 10px;
    color: var(--text-soft);
  }
  .sort,
  .per-page {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sort select {
    width: auto;
    min-height: 36px;
  }
  .per-page select {
    width: auto;
    min-height: 32px;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .results {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0;
    transition: opacity 0.15s var(--ease);
  }
  .results.dim {
    opacity: 0.55;
  }
  .result {
    display: flex;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
  }
  a.result:hover {
    border-color: var(--line-strong);
    box-shadow: var(--shadow-md);
    color: var(--text);
  }
  .kind {
    flex: none;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--text-soft);
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .snippet {
    margin: 2px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-soft);
    font-size: 0.88rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    color: var(--text-faint);
    font-size: 0.8rem;
  }
  .empty {
    padding: 2rem 0;
    text-align: center;
    color: var(--text-faint);
  }
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 18px;
    color: var(--text-soft);
    font-size: 0.9rem;
  }
  @media (max-width: 560px) {
    .bar {
      flex-direction: column;
    }
    .summary {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
