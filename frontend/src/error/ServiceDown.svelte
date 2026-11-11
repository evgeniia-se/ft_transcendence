<!-- Polls /api/health and reloads when the backend is back. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import CenterPage from "../shared/ui/CenterPage.svelte";

  let attempts = $state(0);
  let checking = $state(false);

  async function check(): Promise<void> {
    if (checking) return;
    checking = true;
    try {
      const res = await fetch("/api/health", { headers: { accept: "application/json" } });
      if (res.ok) {
        window.location.reload();
        return;
      }
    } catch {
      // still down
    }
    attempts++;
    checking = false;
  }

  $effect(() => {
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  });
  $effect(() => {
    document.title = `${t("down.pageTitle")} · Transcendance`;
  });
</script>

<CenterPage>
  <div class="mark" aria-hidden="true"><span class="pulse"></span></div>
  <h1>{t("down.title")}</h1>
  <p>{t("down.text")}</p>
  <div class="actions">
    <button type="button" class="btn btn-primary" disabled={checking} onclick={check}>
      {#if checking}<span class="spinner"></span> {t("down.checking")}{:else}{t("down.retry")}{/if}
    </button>
  </div>
  {#if attempts > 0}<p class="faint">{t("down.attempt", { n: attempts })}</p>{/if}
</CenterPage>

<style>
  .mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--warn-soft);
  }
  .pulse {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--warn);
    animation: breathe 2.2s ease-in-out infinite;
  }
  @keyframes breathe {
    50% {
      transform: scale(1.5);
      opacity: 0.5;
    }
  }
  p {
    color: var(--text-soft);
    max-width: 44ch;
  }
  .faint {
    color: var(--text-faint);
    font-size: 0.85rem;
  }
  .actions {
    margin-top: 6px;
  }
</style>
