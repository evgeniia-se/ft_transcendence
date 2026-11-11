<script lang="ts">
  import Logo from "../shared/ui/Logo.svelte";
  import ThemeSwitch from "../shared/ui/ThemeSwitch.svelte";
  import LangSwitch from "../shared/ui/LangSwitch.svelte";
  import { t, type MessageKey } from "../shared/i18n.svelte";
  import { currentVersion, renderLegalDoc, type LegalVersions } from "./legalDoc";

  let {
    versions,
    other,
  }: { versions: LegalVersions; other: { href: string; label: MessageKey } } = $props();

  let content: HTMLElement;

  // re-rendered when the interface language changes
  $effect(() => {
    const doc = currentVersion(versions);
    renderLegalDoc(content, doc);
    document.title = `${doc.title} · Transcendance`;
  });
</script>

<div class="page">
  <header>
    <a class="brand" href="/"><Logo size={30} /><span>Transcendance</span></a>
    <div class="switches"><LangSwitch compact /><ThemeSwitch compact /></div>
  </header>

  <main>
    <div class="content selectable" bind:this={content}></div>
    <nav>
      <a href="/">← {t("notFound.home")}</a>
      <a href={other.href}>{t(other.label)}</a>
    </nav>
  </main>
</div>

<style>
  .switches {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .page {
    min-height: 100vh;
    padding: 20px 28px 60px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1000px;
    margin: 0 auto;
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
  main {
    max-width: 700px;
    margin: 48px auto 0;
  }
  .content :global(h1) {
    font-size: 2.3rem;
    margin-bottom: 6px;
  }
  .content :global(.updated) {
    margin-bottom: 36px;
    color: var(--text-faint);
    font-size: 0.88rem;
  }
  .content :global(h2) {
    margin: 36px 0 10px;
    font-size: 1.2rem;
  }
  .content :global(p) {
    margin-bottom: 12px;
    color: var(--text-soft);
    line-height: 1.7;
  }
  nav {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 56px;
    padding-top: 22px;
    border-top: 1px solid var(--line);
    font-size: 0.9rem;
  }
</style>
