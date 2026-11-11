<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import AuthLayout from "../auth/AuthLayout.svelte";
  import { getStoredToken, getStoredUser, logout } from "../auth/authClient";
  import { ApiError } from "../api/apiClient";
  import { joinInvite, listMyProjects } from "../api/projectsApi";
  import Avatar from "../shared/ui/Avatar.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import { errorMessage } from "../shared/errors";
  import { currentPath, ensureUser, loginUrl, signupUrl } from "../shared/session";

  const token = window.location.pathname.split("/")[2] ?? "";
  const signedIn = getStoredToken() !== null;

  let user = $state(getStoredUser());
  let busy = $state(false);
  let error = $state<string | null>(null);
  let alreadyMember = $state(false);
  let joined = $state(false);

  $effect(() => {
    if (signedIn) void ensureUser().then((u) => (user = u));
  });

  async function projectIds(): Promise<Set<string> | null> {
    try {
      return new Set((await listMyProjects()).map((p) => p.id));
    } catch {
      return null;
    }
  }

  async function onJoin(): Promise<void> {
    busy = true;
    error = null;
    const before = await projectIds();
    try {
      await joinInvite(token);
      joined = true;
      // the join returns no project id: find it by comparing the two project lists
      const after = await projectIds();
      const added = before && after ? [...after].filter((id) => !before.has(id)) : [];
      window.location.replace(added.length === 1 ? `/app/${added[0]}` : "/app");
    } catch (err) {
      busy = false;
      if (err instanceof ApiError && err.code === "already_member") alreadyMember = true;
      error = errorMessage(err);
    }
  }

  async function switchAccount(): Promise<void> {
    await logout();
    window.location.href = loginUrl(currentPath());
  }
  $effect(() => {
    document.title = `${t("invite.pageTitle")} · Transcendance`;
  });
</script>

<AuthLayout>
  <div class="box">
    <div class="envelope"><Icon name="users" size={26} /></div>
    <header>
      <h1>{t("invite.title")}</h1>
      <p class="sub">
        {#if signedIn}
          {t("invite.signedIn")}
        {:else}
          {t("invite.signedOut")}
        {/if}
      </p>
    </header>

    {#if error}
      <div class="alert" role="alert"><Icon name="alert" size={17} /> <span>{error}</span></div>
    {/if}

    {#if signedIn}
      {#if user}
        <div class="who">
          <Avatar name={user.name} id={user.id} src={user.avatar} size={34} />
          <div class="who-text">
            <div class="who-name selectable">{user.name}</div>
            <div class="who-email selectable">{user.email}</div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" onclick={switchAccount}>{t("invite.switch")}</button>
        </div>
      {/if}
      {#if alreadyMember}
        <a class="btn btn-primary btn-block" href="/app">{t("landing.openProjects")}</a>
      {:else}
        <button type="button" class="btn btn-primary btn-block" disabled={busy || joined} onclick={onJoin}>
          {#if busy}<span class="spinner"></span> {t("invite.wait")}{:else}{t("invite.join")}{/if}
        </button>
        <a class="btn btn-ghost btn-block" href="/app">{t("invite.notNow")}</a>
      {/if}
    {:else}
      <a class="btn btn-primary btn-block" href={loginUrl(currentPath())}>{t("login.submit")}</a>
      <a class="btn btn-block" href={signupUrl(currentPath())}>{t("login.toSignup")}</a>
    {/if}
  </div>
</AuthLayout>

<style>
  .box {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: min(400px, 100%);
  }
  .envelope {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
  .sub {
    margin-top: 8px;
    color: var(--text-soft);
  }
  .who {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .who-text {
    flex: 1;
    min-width: 0;
  }
  .who-name {
    font-weight: 650;
  }
  .who-email {
    font-size: 0.82rem;
    color: var(--text-faint);
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
