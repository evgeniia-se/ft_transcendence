<script lang="ts">
  import { t } from "../i18n.svelte";
  const year = new Date().getFullYear();
</script>

<footer class="site-footer">
  <span>© {year} Transcendance · {t("footer.student")}</span>
  <nav aria-label={t("footer.legal")}>
    <a href="/legal/terms">{t("footer.terms")}</a>
    <a href="/legal/privacy">{t("footer.privacy")}</a>
  </nav>
</footer>

<style>
  .site-footer {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px 16px;
    min-height: var(--footer-h);
    padding: 0 16px;
    border-top: 1px solid var(--line);
    background: var(--surface);
    color: var(--text-faint);
    font-size: 0.78rem;
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
  }
  a {
    color: var(--text-soft);
    text-decoration: none;
  }
  a:hover {
    color: var(--accent);
    text-decoration: underline;
  }
  @media (max-width: 560px) {
    span {
      display: none;
    }
    .site-footer {
      justify-content: center;
    }
  }
</style>
