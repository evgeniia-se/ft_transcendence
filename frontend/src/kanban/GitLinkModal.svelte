<!-- Owner: Track 3 (Git integration)
     Responsible for: the dialog that links a card to a GitHub branch — an existing one or a new one created
     from the repository's default branch. The webhook (backend git/) then moves the card as the PR progresses. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { toast } from "../shared/toast.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import * as api from "./boardApi";
  import type { BoardStore } from "./boardStore.svelte";
  import { errorMessage } from "../shared/errors";
  import { startOAuthLink } from "../auth/oauthFlow";

  let { store }: { store: BoardStore } = $props();

  // same shapes the backend accepts: owner/repo, a github.com URL or an ssh address
  const REPO = /^(?:https?:\/\/github\.com\/|git@github\.com:)?(?!\.+\/)[\w.-]+\/(?!\.+(?:\.git)?\/?$)[\w.-]+?(?:\.git)?\/?$/;
  const BRANCH = /^(?!-)(?!.*\.\.)(?!.*\/\/)(?!.*\.lock$)(?!\/)(?!.*\/$)[A-Za-z0-9._/-]{1,200}$/;

  let dialog: HTMLDialogElement;
  const card = $derived(store.board?.lists.flatMap((l) => l.cards).find((c) => c.id === store.gitCardId) ?? null);
  const open = $derived(card !== null);

  let repoUrl = $state("");
  let mode = $state<"existing" | "new">("existing");
  let branch = $state("");
  let branches = $state<string[]>([]);
  let loadedFor = $state("");
  let loading = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  // whether the signed-in user has a GitHub account linked; null while unknown
  let connected = $state<boolean | null>(null);
  // card the form was filled for
  let formFor: string | null = null;

  const repoKey = () => `ft_git_repo:${store.project?.id ?? ""}`;
  const repoValid = $derived(REPO.test(repoUrl.trim()));
  const branchValid = $derived(BRANCH.test(branch.trim()));
  const canLoad = $derived(connected === true && repoValid && !loading);

  // sends the user through GitHub to add it to their account, then back to this page
  async function connectGithub(): Promise<void> {
    try {
      await startOAuthLink(window.location.pathname + window.location.search);
    } catch {
      error = t("git.unavailable");
    }
  }

  function slug(text: string): string {
    const base = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return base.slice(0, 40) || t("search.card").toLowerCase();
  }

  // open or close the dialog with the selected card, and fill the form once per card
  $effect(() => {
    if (card && !dialog.open) dialog.showModal();
    else if (!card && dialog.open) dialog.close();

    if (card && card.id !== formFor) {
      formFor = card.id;
      let remembered = "";
      try {
        remembered = localStorage.getItem(repoKey()) ?? "";
      } catch {
        // storage unavailable: the field starts empty
      }
      repoUrl = card.gitLink?.repoUrl ?? remembered;
      branch = card.gitLink?.branchName ?? "";
      mode = "existing";
      branches = [];
      loadedFor = "";
      error = null;
      connected = null;
      api
        .fetchGitStatus()
        .then((ok) => {
          connected = ok;
          if (ok && REPO.test(repoUrl.trim())) void loadBranches();
        })
        .catch(() => (connected = false));
    } else if (!card) {
      formFor = null;
    }
  });

  async function loadBranches(): Promise<void> {
    const url = repoUrl.trim();
    if (!store.project || !REPO.test(url) || loading) return;
    loading = true;
    error = null;
    try {
      branches = await api.fetchBranches(store.project.id, url);
      loadedFor = url;
    } catch (err) {
      branches = [];
      error = gitMessage(err);
    } finally {
      loading = false;
    }
  }

  function gitMessage(err: unknown): string {
    const payload = (err as { payload?: { message?: unknown } }).payload;
    if (typeof payload?.message === "string") return payload.message;
    if ((err as { code?: string }).code === "github_not_linked") return t("git.notConnected");
    return errorMessage(err);
  }

  function switchMode(next: "existing" | "new"): void {
    mode = next;
    error = null;
    if (next === "new" && card && (!branch || branch === card.gitLink?.branchName)) branch = `feature/${slug(card.title)}`;
    if (next === "existing" && card) branch = card.gitLink?.branchName ?? "";
  }

  const exists = $derived(branches.includes(branch.trim()));

  async function submit(): Promise<void> {
    if (!card || busy || !repoValid || !branchValid) return;
    if (mode === "new" && exists) {
      error = t("git.branchExists");
      return;
    }
    busy = true;
    error = null;
    const failure = await store.linkBranch(card.id, repoUrl.trim(), branch.trim(), mode === "new");
    busy = false;
    if (failure) {
      error = failure;
      return;
    }
    try {
      localStorage.setItem(repoKey(), repoUrl.trim());
    } catch {
      // not remembered, nothing else to do
    }
    toast(mode === "new" ? t("git.createdLinked") : t("git.linked"), { kind: "success" });
    store.gitCardId = null;
  }

  const webhookUrl = `${location.origin}/api/webhooks/git`;
</script>

<dialog
  class="modal"
  bind:this={dialog}
  aria-label={t("git.cardBranch")}
  onclose={() => (store.gitCardId = null)}
  onclick={(event) => {
    if (event.target === dialog) store.gitCardId = null;
  }}
>
  {#if open && card}
    <form class="wrap" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div class="head">
        <h2><Icon name="branch" size={18} /> {t("git.branchTitle")}</h2>
        <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={() => (store.gitCardId = null)}><Icon name="x" size={18} /></button>
      </div>
      <p class="card-title">{card.title}</p>

      {#if connected === false}
        <p class="notice">
          {t("git.notConnectedNotice")}
          <button type="button" class="btn btn-ghost btn-sm" onclick={connectGithub}><Icon name="github" size={15} /> {t("git.connect")}</button>
        </p>
      {/if}

      <div class="field">
        <label for="git-repo">{t("git.repo")}</label>
        <div class="row">
          <input
            id="git-repo"
            class="input"
            bind:value={repoUrl}
            placeholder={t("git.repoPlaceholder")}
            autocomplete="off"
            aria-invalid={repoUrl.trim() !== "" && !repoValid}
            onblur={() => canLoad && loadedFor !== repoUrl.trim() && void loadBranches()}
          />
          <button type="button" class="btn btn-ghost btn-sm" disabled={!canLoad} onclick={loadBranches}>
            {loading ? t("common.loading") : t("git.loadBranches")}
          </button>
        </div>
      </div>

      <div class="modes" role="radiogroup" aria-label={t("git.branchType")}>
        <button type="button" role="radio" aria-checked={mode === "existing"} class:on={mode === "existing"} onclick={() => switchMode("existing")}>{t("git.existing")}</button>
        <button type="button" role="radio" aria-checked={mode === "new"} class:on={mode === "new"} disabled={connected !== true} title={connected === true ? "" : t("git.needsAccount")} onclick={() => switchMode("new")}>
          {t("git.new")}
        </button>
      </div>

      <div class="field">
        <label for="git-branch">{mode === "new" ? t("git.newName") : t("git.branch")}</label>
        <input
          id="git-branch"
          class="input mono"
          bind:value={branch}
          list="git-branches"
          placeholder={mode === "new" ? t("git.newPlaceholder") : "main"}
          autocomplete="off"
          aria-invalid={branch.trim() !== "" && !branchValid}
        />
        {#if mode === "existing"}<datalist id="git-branches">{#each branches as name (name)}<option value={name}></option>{/each}</datalist>{/if}
        <span class="hint">
          {#if mode === "new"}{t("git.fromDefault")}{:else if branches.length}{branches.length > 1 ? t("git.availableMany", { n: branches.length }) : t("git.availableOne")}{:else}{t("git.typeName")}{/if}
        </span>
      </div>

      {#if error}<p class="field-error" role="alert">{error}</p>{/if}

      <details class="webhook">
        <summary>{t("git.autoTitle")}</summary>
        <p>
          {t("git.autoText1")}
          {t("git.autoText2")} <code class="selectable">{webhookUrl}</code>,
          {t("git.autoType")} <code>application/json</code>, {t("git.autoEvents")} <em>Pushes</em> {t("git.and")} <em>Pull requests</em>, {t("git.autoSecret")} <code>GIT_WEBHOOK_SECRET</code> {t("git.autoServer")}
        </p>
      </details>

      <div class="actions">
        {#if card.gitLink}
          <button type="button" class="btn btn-danger btn-sm" disabled={busy} onclick={async () => { if (await store.unlinkBranch(card.id)) store.gitCardId = null; }}>
            {t("git.removeLink")}
          </button>
        {/if}
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost btn-sm" onclick={() => (store.gitCardId = null)}>{t("common.cancel")}</button>
        <button type="submit" class="btn btn-primary btn-sm" disabled={busy || !repoValid || !branchValid}>
          {busy ? "…" : mode === "new" ? t("git.createLink") : t("git.linkTheBranch")}
        </button>
      </div>
    </form>
  {/if}
</dialog>

<style>
  dialog {
    width: min(520px, calc(100vw - 24px));
    max-height: calc(100vh - 32px);
    overflow: auto;
  }
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 22px 20px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-family: var(--font-serif);
    font-size: 1.2rem;
  }
  .card-title {
    margin: -6px 0 0;
    color: var(--text-soft);
    font-size: 0.88rem;
    overflow-wrap: anywhere;
  }
  .notice {
    margin: 0;
    padding: 10px 12px;
    border-radius: var(--radius);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 0.84rem;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row .input {
    flex: 1;
    min-width: 0;
  }
  .row .btn {
    flex-shrink: 0;
  }
  .modes {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: var(--bg-sunken);
  }
  .modes button {
    flex: 1;
    padding: 6px 10px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text-soft);
    font-size: 0.86rem;
    font-weight: 550;
  }
  .modes button.on {
    background: var(--surface-raised);
    color: var(--text);
    box-shadow: var(--shadow-sm);
  }
  .modes button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .mono {
    font-family: var(--font-mono);
  }
  .hint {
    font-size: 0.78rem;
    color: var(--text-faint);
  }
  .webhook {
    font-size: 0.82rem;
    color: var(--text-soft);
  }
  .webhook summary {
    cursor: pointer;
    font-weight: 600;
  }
  .webhook p {
    margin: 8px 0 0;
    line-height: 1.5;
  }
  .webhook code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .spacer {
    flex: 1;
  }
</style>
