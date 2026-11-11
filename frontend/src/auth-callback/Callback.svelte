<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import AuthLayout from "../auth/AuthLayout.svelte";
  import { readOAuthResult } from "../auth/oauthFlow";
  import { clearAuthSession } from "../auth/authClient";
  import Icon from "../shared/ui/Icon.svelte";
  import { ensureUser } from "../shared/session";

  // read once: the fragment is cleared after the first read
  const result = readOAuthResult();
  let message = $state<string | null>(result.ok ? null : result.message);

  if (result.ok) {
    // OAuth gives only a token: load the profile now
    void ensureUser().then((user) => {
      if (user) {
        window.location.replace(result.next);
      } else {
        clearAuthSession();
        message = t("callback.profileFailed");
      }
    });
  }
  $effect(() => {
    document.title = `${t("callback.pageTitle")} · Transcendance`;
  });
</script>

<AuthLayout>
  <div class="box" role="status" aria-live="polite">
    {#if message}
      <h1>{t("callback.failed")}</h1>
      <div class="alert" role="alert"><Icon name="alert" size={17} /> <span>{message}</span></div>
      <a class="btn btn-primary btn-block" href="/login">{t("auth.backToLogin")}</a>
    {:else}
      <span class="spinner big"></span>
      <h1>{t("callback.inProgress")}</h1>
      <p class="sub">{t("callback.sub")}</p>
    {/if}
  </div>
</AuthLayout>

<style>
  .box {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    width: min(400px, 100%);
  }
  .box :global(.spinner.big) {
    width: 28px;
    height: 28px;
    border-width: 3px;
  }
  .sub {
    color: var(--text-soft);
  }
</style>
