<script lang="ts">
  import type { Snippet } from "svelte";
  import BoardArt from "../shared/ui/BoardArt.svelte";
  import Logo from "../shared/ui/Logo.svelte";
  import ThemeSwitch from "../shared/ui/ThemeSwitch.svelte";
  import LangSwitch from "../shared/ui/LangSwitch.svelte";
  import { t } from "../shared/i18n.svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div class="auth">
  <aside class="story">
    <a class="brand" href="/"><Logo size={34} /><span>Transcendance</span></a>
    <div class="pitch">
      <h2>{t("auth.pitchTitle")}</h2>
      <p>{t("auth.pitchText")}</p>
    </div>
    <BoardArt />
  </aside>

  <main class="pane">
    <div class="top">
      <a class="brand small" href="/"><Logo size={28} /><span>Transcendance</span></a>
      <div class="switches"><LangSwitch compact /><ThemeSwitch compact /></div>
    </div>
    <div class="form-wrap">
      {@render children()}
    </div>
    <footer>
      <a href="/legal/terms">{t("auth.terms")}</a>
      <a href="/legal/privacy">{t("auth.privacy")}</a>
    </footer>
  </main>
</div>

<style>
  .auth {
    display: grid;
    grid-template-columns: minmax(360px, 5fr) minmax(0, 6fr);
    min-height: 100vh;
  }
  .story {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 40px;
    padding: 36px 48px 48px;
    background: var(--bg-sunken);
    border-right: 1px solid var(--line);
    overflow: hidden;
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
  .brand:hover {
    color: var(--accent);
  }
  .brand.small {
    display: none;
  }
  .pitch {
    max-width: 30ch;
  }
  .pitch h2 {
    font-size: 2rem;
    margin-bottom: 14px;
  }
  .pitch p {
    color: var(--text-soft);
  }
  .pane {
    display: flex;
    flex-direction: column;
    padding: 20px 28px 24px;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
  .switches {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .form-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 0;
  }
  footer {
    display: flex;
    justify-content: center;
    gap: 20px;
    font-size: 0.82rem;
  }
  footer a {
    color: var(--text-faint);
  }
  @media (max-width: 860px) {
    .auth {
      grid-template-columns: 1fr;
    }
    .story {
      display: none;
    }
    .top {
      justify-content: space-between;
    }
    .brand.small {
      display: inline-flex;
    }
  }
</style>
