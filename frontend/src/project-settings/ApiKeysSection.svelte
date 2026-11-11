<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { onMount } from "svelte";
  import { createApiKey, listApiKeys, revokeApiKey } from "../api/projectsApi";
  import type { ApiKeyRow, Project } from "../api/types";
  import { confirmDialog } from "../shared/confirm.svelte";
  import { errorMessage } from "../shared/errors";
  import { formatDate } from "../shared/format";
  import { toast } from "../shared/toast.svelte";
  import CopyField from "../shared/ui/CopyField.svelte";
  import Icon from "../shared/ui/Icon.svelte";

  let { project, isAdmin }: { project: Project; isAdmin: boolean } = $props();

  let keys = $state<ApiKeyRow[] | null>(null);
  let loadFailed = $state(false);
  // a type="number" input binds a number (null when empty), never a string
  let rateLimit = $state<number | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let fresh = $state<string | null>(null);

  const example = $derived(
    `curl -H "X-API-Key: ${fresh ?? "tk_votre_cle"}" \\\n  ${location.origin}/api/projects/${project.id}/cards`
  );

  onMount(() => {
    if (isAdmin) void load();
  });

  async function load(): Promise<void> {
    loadFailed = false;
    try {
      keys = await listApiKeys(project.id);
    } catch {
      loadFailed = true;
    }
  }

  async function onCreate(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = null;
    const limit = rateLimit === null ? undefined : rateLimit;
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 10000)) {
      error = t("keys.rateInvalid");
      return;
    }
    busy = true;
    try {
      fresh = (await createApiKey(project.id, limit)).key;
      rateLimit = null;
      await load();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  async function revoke(key: ApiKeyRow): Promise<void> {
    const ok = await confirmDialog({
      title: t("keys.revokeTitle"),
      message: t("keys.revokeText"),
      confirmLabel: t("common.revoke"),
      danger: true,
    });
    if (!ok) return;
    try {
      await revokeApiKey(project.id, key.id);
      toast(t("keys.revoked"));
    } catch (err) {
      toast(errorMessage(err), { kind: "error" });
    }
    await load();
  }
</script>

<header class="section-head">
  <h2>{t("ps.apiKeys")}</h2>
  <p>{t("keys.intro")}</p>
</header>

{#if !isAdmin}
  <div class="panel"><p class="muted">{t("keys.adminOnly")}</p></div>
{:else}
  {#if fresh}
    <div class="panel fresh" role="status">
      <div class="row-between">
        <strong><Icon name="check" size={16} /> {t("keys.created")}</strong>
        <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={() => (fresh = null)}><Icon name="x" size={16} /></button>
      </div>
      <CopyField value={fresh} label={t("keys.key")} />
      <p class="hint warn">{t("keys.copyNow")}</p>
    </div>
  {/if}

  <form class="panel" onsubmit={onCreate}>
    <h3>{t("keys.new")}</h3>
    <div class="field narrow">
      <label for="rate">{t("keys.rate")}</label>
      <input id="rate" class="input" type="number" min="1" max="10000" step="1" inputmode="numeric" placeholder={t("keys.default")} bind:value={rateLimit} />
    </div>
    {#if error}<span class="field-error" role="alert">{error}</span>{/if}
    <div><button type="submit" class="btn btn-primary" disabled={busy}>{#if busy}<span class="spinner"></span>{:else}<Icon name="key" size={16} />{/if} {t("keys.create")}</button></div>
  </form>

  <div class="panel list">
    <h3>{t("keys.active")}</h3>
    {#if loadFailed}
      <p class="muted">{t("keys.loadFailed")} <button type="button" class="linklike" onclick={load}>{t("common.retry")}</button></p>
    {:else if keys === null}
      <div class="skeleton line"></div>
    {:else if keys.length === 0}
      <p class="muted">{t("keys.empty")}</p>
    {:else}
      {#each keys as key (key.id)}
        <div class="row">
          <Icon name="key" size={18} />
          <div class="info">
            <div>{t("keys.keyWord")} <code>…{key.id.slice(-6)}</code></div>
            <div class="sub">{t("card.createdOn", { date: formatDate(key.createdAt) })} · {t("keys.perMinute", { n: key.rateLimit })}</div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" onclick={() => revoke(key)}>{t("common.revoke")}</button>
        </div>
      {/each}
    {/if}
  </div>

  <div class="panel">
    <h3>{t("keys.example")}</h3>
    <pre><code>{example}</code></pre>
    <span class="hint">{t("keys.otherRoutes")} <code>POST</code>, <code>PUT</code> {t("git.and")} <code>DELETE</code> {t("keys.on")} <code>/api/projects/{"{id}"}/cards</code>. <a href="/api-docs" target="_blank" rel="noopener noreferrer">{t("keys.fullDocs")}</a>.</span>
  </div>
{/if}

<style>
  .narrow {
    max-width: 280px;
  }
  .fresh {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent-soft) 40%, var(--surface));
  }
  .fresh strong {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--accent-strong);
  }
  .hint.warn {
    color: var(--warn);
  }
  .muted {
    color: var(--text-soft);
  }
  .list {
    gap: 4px;
  }
  .list h3 {
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
    color: var(--text-soft);
  }
  .info {
    flex: 1;
    min-width: 0;
    color: var(--text);
    font-size: 0.92rem;
  }
  .sub {
    font-size: 0.8rem;
    color: var(--text-faint);
  }
  .line {
    height: 48px;
  }
  pre {
    margin: 0;
    padding: 14px 16px;
    border-radius: var(--radius);
    background: var(--bg-sunken);
    overflow-x: auto;
    font-size: 0.84rem;
  }
  .linklike {
    border: none;
    background: none;
    color: var(--accent);
    text-decoration: underline;
    padding: 0;
  }
</style>
