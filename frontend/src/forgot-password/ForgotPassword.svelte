<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import AuthLayout from "../auth/AuthLayout.svelte";
  import { startOAuthLogin } from "../auth/oauthFlow";
  import Icon from "../shared/ui/Icon.svelte";
  $effect(() => {
    document.title = `${t("forgot.title")} · Transcendance`;
  });
</script>

<AuthLayout>
  <div class="box">
    <header>
      <h1>{t("forgot.title")}</h1>
      <p class="sub">{t("forgot.sub")}</p>
    </header>

    <div class="alert alert-info">
      <Icon name="info" size={17} />
      <span>{t("forgot.info")}</span>
    </div>

    <p class="help">{t("forgot.help")}</p>
    <ul>
      <li>{t("forgot.github")}</li>
      <li>{t("forgot.admin")}</li>
    </ul>

    <button type="button" class="btn btn-block" onclick={() => startOAuthLogin()}>
      <Icon name="github" size={18} /> {t("auth.github")}
    </button>
    <a class="btn btn-ghost btn-block" href="/login"><Icon name="arrowLeft" size={16} /> {t("auth.backToLogin")}</a>
  </div>
</AuthLayout>

<style>
  .box {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: min(400px, 100%);
  }
  .sub {
    margin-top: 6px;
    color: var(--text-soft);
  }
  .help {
    color: var(--text-soft);
    margin-bottom: -8px;
  }
  ul {
    padding-left: 20px;
    color: var(--text-soft);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>
