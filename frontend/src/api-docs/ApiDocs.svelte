<!-- Documentation of the public API, drawn from GET /api/openapi.json (the same description the tools read). -->
<script lang="ts">
  import { i18n, t } from "../shared/i18n.svelte";
  import { onMount } from "svelte";
  import { isAuthenticated } from "../auth/authClient";
  import AppHeader from "../shared/ui/AppHeader.svelte";
  import Logo from "../shared/ui/Logo.svelte";
  import ThemeSwitch from "../shared/ui/ThemeSwitch.svelte";
  import LangSwitch from "../shared/ui/LangSwitch.svelte";
  import Rich from "../shared/ui/Rich.svelte";

  interface Param { name: string; in: string; required: boolean; description: string }
  interface Operation {
    id: string;
    method: string;
    path: string;
    summary: string;
    description: string;
    params: Param[];
    body: { description: string; example: unknown } | null;
    success: { status: string; description: string; example: unknown } | null;
    errors: { status: string; description: string }[];
    curl: string;
  }

  const signedIn = isAuthenticated();
  let operations = $state<Operation[]>([]);
  let failed = $state(false);
  let loading = $state(true);

  // the number of the 429 limit is the one the admin sets, 10000 at most (see project settings)
  const MAX_RATE_LIMIT = 10000;

  function curlFor(method: string, path: string, body: unknown): string {
    return [
      `curl -X ${method.toUpperCase()} "${location.origin}${path.replace(/\{(\w+)\}/g, "<$1>")}"`,
      `  -H "X-API-Key: tk_..."`,
      ...(body ? [`  -H "Content-Type: application/json"`, `  -d '${JSON.stringify(body)}'`] : []),
    ].join(" \\\n");
  }

  onMount(async () => {
    try {
      const spec = await (await fetch("/api/openapi.json")).json();
      const list: Operation[] = [];
      for (const [path, methods] of Object.entries<Record<string, any>>(spec.paths)) {
        for (const [method, op] of Object.entries<any>(methods)) {
          const responses = Object.entries<any>(op.responses);
          const ok = responses.find(([status]) => status.startsWith("2"));
          const body = op.requestBody ? { description: op.requestBody.description, example: op.requestBody.content?.["application/json"]?.example } : null;
          list.push({
            id: `${method}-${path}`.replace(/[^\w]+/g, "-"),
            method,
            path,
            summary: op.summary,
            description: op.description,
            params: op.parameters ?? [],
            body,
            success: ok ? { status: ok[0], description: ok[1].description, example: ok[1].content?.["application/json"]?.example ?? null } : null,
            errors: responses.filter(([status]) => !status.startsWith("2")).map(([status, r]) => ({ status, description: r.description })),
            curl: curlFor(method, path, body?.example),
          });
        }
      }
      operations = list;
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  });

  const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

  $effect(() => {
    document.title = `${t("keys.fullDocs")} · Transcendance`;
  });
</script>

{#if signedIn}
  <AppHeader />
{:else}
  <header class="public-bar">
    <a class="brand" href="/"><Logo size={30} /><span>Transcendance</span></a>
    <div class="public-right">
      <a class="btn" href="/login?next=/api-docs">{t("login.submit")}</a>
      <LangSwitch compact />
      <ThemeSwitch compact />
    </div>
  </header>
{/if}

<div class="layout">
  <aside aria-label={t("apidocs.contents")}>
    <nav>
      <div class="label">{t("apidocs.guide")}</div>
      <a href="#authentification">{t("apidocs.auth")}</a>
      <a href="#limites">{t("apidocs.limits")}</a>
      <a href="#erreurs">{t("apidocs.errors")}</a>
      <div class="label">{t("apidocs.routes")}</div>
      {#each operations as op (op.id)}
        <a href={`#${op.id}`}><span class="m {op.method}">{op.method.toUpperCase()}</span> <span class="nav-text">{op.summary}</span></a>
      {/each}
    </nav>
  </aside>

  <main class="selectable">
    <header class="section-head">
      <h1>{t("apidocs.title")}</h1>
      <p>{t("apidocs.intro")} <a href="/api/openapi.json">/api/openapi.json</a> (OpenAPI 3.0).</p>
    </header>

    <section class="panel" id="authentification">
      <h2>{t("apidocs.auth")}</h2>
      <p><Rich text={t("apidocs.auth1")} /></p>
      <p><Rich text={t("apidocs.auth2")} /></p>
    </section>

    <section class="panel" id="limites">
      <h2>{t("apidocs.limits")}</h2>
      <p><Rich text={t("apidocs.limitsText", { max: MAX_RATE_LIMIT.toLocaleString(i18n.lang) })} /></p>
      <pre>{`429 Too Many Requests
Retry-After: 37
{ "error": "rate_limit_exceeded", "limit": 100, "retryAfter": 37 }`}</pre>
    </section>

    <section class="panel" id="erreurs">
      <h2>{t("apidocs.errors")}</h2>
      <p>{t("apidocs.errorsBefore")} <code>{`{ "error": "<code>", "details": [ … ] }`}</code> <Rich text={t("apidocs.errorsAfter")} /></p>
    </section>

    <h2 class="routes-title">{t("apidocs.routes")}</h2>

    {#if loading}
      <div class="panel"><span class="spinner"></span> {t("common.loading")}</div>
    {:else if failed}
      <div class="alert alert-warn">{t("apidocs.loadFailed")} <a href="/api/openapi.json">/api/openapi.json</a>.</div>
    {/if}

    {#each operations as op (op.id)}
      <section class="panel op" id={op.id}>
        <h3><span class="m {op.method}">{op.method.toUpperCase()}</span> <code>{op.path}</code></h3>
        <p><strong>{op.summary}.</strong> {op.description}</p>

        {#if op.params.length}
          <div class="table-wrap">
            <table>
              <thead><tr><th>{t("apidocs.param")}</th><th>{t("apidocs.in")}</th><th>{t("card.description")}</th></tr></thead>
              <tbody>
                {#each op.params as param (param.name)}
                  <tr><td><code>{param.name}</code>{param.required ? " *" : ""}</td><td>{param.in === "path" ? t("apidocs.inPath") : t("apidocs.inQuery")}</td><td>{param.description}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        {#if op.body}
          <div class="label">{t("apidocs.body")}</div>
          <p>{op.body.description}</p>
          <pre>{pretty(op.body.example)}</pre>
        {/if}

        {#if op.success}
          <div class="label">{t("apidocs.success")} <span class="chip chip-accent">{op.success.status}</span></div>
          <p>{op.success.description}</p>
          {#if op.success.example}<pre>{pretty(op.success.example)}</pre>{/if}
        {/if}

        <div class="label">{t("apidocs.errors")}</div>
        <ul class="errors">
          {#each op.errors as error (error.status)}
            <li><span class="chip chip-danger">{error.status}</span> {error.description}</li>
          {/each}
        </ul>

        <div class="label">{t("keys.example")}</div>
        <pre>{op.curl}</pre>
      </section>
    {/each}

    <nav class="foot"><a href="/app">← {t("userMenu.projects")}</a><a href="/legal/terms">{t("footer.terms")}</a></nav>
  </main>
</div>

<style>
  .public-bar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--header-h);
    padding: 6px 16px;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    text-decoration: none;
    font-family: var(--font-serif);
    font-size: 1.2rem;
    font-weight: 600;
  }
  .public-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .layout {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    gap: 40px;
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px 20px 80px;
  }
  aside nav {
    position: sticky;
    top: calc(var(--header-h) + 24px);
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: calc(100vh - var(--header-h) - 48px);
    overflow-y: auto;
    font-size: 0.88rem;
  }
  aside a {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    color: var(--text-soft);
    text-decoration: none;
    white-space: nowrap;
  }
  aside a:hover {
    background: var(--bg-sunken);
    color: var(--text);
  }
  .nav-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .label {
    margin: 14px 0 4px;
    color: var(--text-faint);
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  aside .label:first-child {
    margin-top: 0;
  }
  main {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  main :global(p) {
    color: var(--text-soft);
    line-height: 1.65;
  }
  .routes-title {
    margin-top: 16px;
  }
  .op h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    font-size: 1.05rem;
    word-break: break-all;
  }
  code,
  pre {
    border-radius: var(--radius-sm);
    background: var(--bg-sunken);
    font-family: var(--font-mono);
    font-size: 0.86rem;
  }
  code {
    padding: 1px 5px;
  }
  pre {
    margin: 4px 0 0;
    padding: 12px 14px;
    overflow-x: auto;
    color: var(--text);
    line-height: 1.5;
  }
  .m {
    display: inline-block;
    flex-shrink: 0;
    min-width: 56px;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    color: var(--accent-strong);
    font: 700 0.72rem var(--font-sans);
    text-align: center;
  }
  .m.post {
    background: color-mix(in srgb, var(--accent) 22%, var(--surface));
  }
  .m.put {
    background: var(--warn-soft);
    color: var(--warn);
  }
  .m.delete {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th,
  td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }
  th {
    color: var(--text-faint);
    font-size: 0.78rem;
    font-weight: 600;
  }
  .errors {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin: 0;
    padding: 0;
    color: var(--text-soft);
    font-size: 0.92rem;
    list-style: none;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--line);
    font-size: 0.9rem;
  }
  @media (max-width: 860px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }
    aside {
      display: none;
    }
  }
</style>
