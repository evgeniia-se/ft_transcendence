<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import CenterPage from "../shared/ui/CenterPage.svelte";
  import { getStoredToken } from "../auth/authClient";
  $effect(() => {
    document.title = `${t("notFound.pageTitle")} · Transcendance`;
  });
</script>

<CenterPage>
  <div class="code" aria-hidden="true">404</div>
  <h1>{t("notFound.title")}</h1>
  <p>{t("notFound.text")}</p>
  <div class="actions">
    <a class="btn btn-primary" href={getStoredToken() ? "/app" : "/"}>{getStoredToken() ? t("userMenu.projects") : t("notFound.home")}</a>
    <button type="button" class="btn" onclick={() => history.back()}>{t("notFound.back")}</button>
  </div>
</CenterPage>

<style>
  .code {
    font-family: var(--font-serif);
    font-size: clamp(4rem, 14vw, 7.5rem);
    line-height: 1;
    color: var(--line-strong);
    letter-spacing: -0.04em;
  }
  p {
    color: var(--text-soft);
    max-width: 38ch;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }
</style>
