<!-- Owner: Track 1 (Foundation, Auth, and API infrastructure)
     Responsible for: the public landing page. -->
<script lang="ts">
  import { getStoredToken } from "../auth/authClient";
  import BoardArt from "../shared/ui/BoardArt.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import Logo from "../shared/ui/Logo.svelte";
  import ThemeSwitch from "../shared/ui/ThemeSwitch.svelte";
  import LangSwitch from "../shared/ui/LangSwitch.svelte";
  import { t } from "../shared/i18n.svelte";

  const signedIn = getStoredToken() !== null;

  $effect(() => {
    document.title = t("landing.pageTitle");
  });

  const FEATURES = [
    { icon: "columns", key: "board" },
    { icon: "branch", key: "git" },
    { icon: "note", key: "notes" },
    { icon: "search", key: "search" },
    { icon: "users", key: "roles" },
    { icon: "key", key: "api" },
  ] as const;
</script>

<div class="page">
  <header>
    <a class="brand" href="/"><Logo size={32} /><span>Transcendance</span></a>
    <nav class:signed={signedIn}>
      <a class="link" href="#fonctionnalites">{t("landing.features")}</a>
      <div class="switches"><LangSwitch compact /><ThemeSwitch compact /></div>
      {#if signedIn}
        <a class="btn btn-primary btn-sm" href="/app">{t("userMenu.projects")}</a>
      {:else}
        <a class="btn btn-ghost btn-sm" href="/login">{t("landing.login")}</a>
        <a class="btn btn-primary btn-sm" href="/signup">{t("login.toSignup")}</a>
      {/if}
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="copy">
        <p class="eyebrow">{t("landing.eyebrow")}</p>
        <h1>{t("landing.titleLine1")}<br /><em>{t("landing.titleLine2")}</em></h1>
        <p class="lead">{t("landing.lead")}</p>
        <div class="cta">
          {#if signedIn}
            <a class="btn btn-primary" href="/app">{t("landing.openProjects")} <Icon name="arrowRight" size={17} /></a>
          {:else}
            <a class="btn btn-primary" href="/signup">{t("landing.start")} <Icon name="arrowRight" size={17} /></a>
            <a class="btn" href="/login">{t("landing.haveAccount")}</a>
          {/if}
        </div>
      </div>
      <div class="art"><BoardArt /></div>
    </section>

    <section id="fonctionnalites" class="features">
      <h2>{t("landing.featuresTitle")}</h2>
      <div class="grid">
        {#each FEATURES as feature (feature.key)}
          <article>
            <span class="icon"><Icon name={feature.icon} size={20} /></span>
            <h3>{t(`landing.feature.${feature.key}.title`)}</h3>
            <p>{t(`landing.feature.${feature.key}.text`)}</p>
          </article>
        {/each}
      </div>
    </section>

    <section class="closing">
      <h2>{t("landing.closingTitle")}</h2>
      <p>{t("landing.closingText")}</p>
      <a class="btn btn-primary" href={signedIn ? "/app" : "/signup"}>{signedIn ? t("landing.openProjects") : t("login.toSignup")}</a>
    </section>
  </main>

  <footer>
    <span class="links"><a href="/legal/terms">{t("auth.terms")}</a><a href="/legal/privacy">{t("auth.privacy")}</a></span>
  </footer>
</div>

<style>
  .page {
    max-width: 1120px;
    margin: 0 auto;
    padding: 0 28px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px 16px;
    padding: 22px 0;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    text-decoration: none;
    font-family: var(--font-serif);
    font-size: 1.3rem;
    font-weight: 600;
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
  .switches {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .link {
    margin-right: 8px;
    color: var(--text-soft);
    font-size: 0.92rem;
    text-decoration: none;
  }
  .link:hover {
    color: var(--text);
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    align-items: center;
    gap: 56px;
    padding: 72px 0 96px;
  }
  .eyebrow {
    margin-bottom: 18px;
    color: var(--accent);
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  h1 {
    font-size: clamp(2.5rem, 5.4vw, 4rem);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.035em;
  }
  h1 em {
    color: var(--accent);
    font-style: normal;
  }
  .lead {
    max-width: 46ch;
    margin: 22px 0 32px;
    color: var(--text-soft);
    font-size: 1.1rem;
    line-height: 1.65;
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .cta .btn {
    min-height: 46px;
    padding: 0 22px;
  }
  .art {
    padding: 0 8px;
  }
  .features {
    padding: 40px 0 80px;
    border-top: 1px solid var(--line);
  }
  .features h2 {
    max-width: 18ch;
    margin-bottom: 40px;
    font-size: clamp(1.7rem, 3.4vw, 2.3rem);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
    gap: 36px 40px;
  }
  article .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    margin-bottom: 14px;
    border-radius: 12px;
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
  article p {
    margin-top: 6px;
    color: var(--text-soft);
  }
  .closing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 24px;
    border-radius: 28px;
    background: var(--bg-sunken);
    text-align: center;
  }
  .closing p {
    margin-bottom: 8px;
    color: var(--text-soft);
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 0 32px;
    font-size: 0.84rem;
    color: var(--text-faint);
  }
  .links {
    display: flex;
    gap: 18px;
  }
  .links a {
    color: var(--text-faint);
  }
  @media (max-width: 860px) {
    .hero {
      grid-template-columns: 1fr;
      gap: 40px;
      padding: 40px 0 64px;
    }
    .switches {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .link {
      display: none;
    }
  }
  @media (max-width: 520px) {
    .page {
      padding: 0 16px;
    }
    /* second row: language and theme switches on the left, buttons on the right (wraps again on very narrow screens) */
    nav {
      width: 100%;
      justify-content: space-between;
      padding-bottom: 6px;
    }
    /* signed in: the hero already has an "Ouvrir mes projets" button, so the switches sit next to the logo */
    nav.signed {
      width: auto;
      padding-bottom: 0;
    }
    nav.signed .btn {
      display: none;
    }
  }
  @media (max-width: 380px) {
    nav .btn-ghost {
      display: none;
    }
  }
</style>
