<script lang="ts">
  import AuthLayout from "../auth/AuthLayout.svelte";
  import PasswordField from "../auth/PasswordField.svelte";
  import { login, storeAuthSession, AuthApiError } from "../auth/authClient";
  import { startOAuthLogin } from "../auth/oauthFlow";
  import { validateEmail } from "../auth/validation";
  import Icon from "../shared/ui/Icon.svelte";
  import { t } from "../shared/i18n.svelte";
  import { nextFromUrl, signupUrl } from "../shared/session";

  const next = nextFromUrl();

  let email = $state("");
  let password = $state("");
  let emailError = $state<string | null>(null);
  let passwordError = $state<string | null>(null);
  let formError = $state<string | null>(null);
  let busy = $state(false);

  async function onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    formError = null;
    emailError = validateEmail(email);
    passwordError = password ? null : t("login.passwordRequired");
    if (emailError || passwordError) {
      document.getElementById(emailError ? "email" : "password")?.focus();
      return;
    }

    busy = true;
    try {
      storeAuthSession(await login({ email: email.trim().toLowerCase(), password }));
      window.location.href = next;
    } catch (err) {
      busy = false;
      if (err instanceof AuthApiError && err.status === 401) {
        formError = t("login.wrongCredentials");
        password = "";
        document.getElementById("password")?.focus();
      } else if (err instanceof AuthApiError && err.status === 429) {
        formError = t("auth.tooManyAttempts");
      } else if (err instanceof AuthApiError && err.status === 0) {
        formError = err.message;
      } else {
        formError = t("login.failed");
      }
    }
  }
  $effect(() => {
    document.title = `${t("landing.login")} · Transcendance`;
  });
</script>

<AuthLayout>
  <form class="form" onsubmit={onSubmit} novalidate>
    <header>
      <h1>{t("login.title")}</h1>
      <p class="sub">{t("login.subtitle")}</p>
    </header>

    {#if formError}
      <div class="alert" role="alert"><Icon name="alert" size={17} /> <span>{formError}</span></div>
    {/if}

    <div class="field">
      <label for="email">{t("auth.email")}</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="email"
        class="input"
        type="email"
        bind:value={email}
        autocomplete="email"
        autofocus
        aria-invalid={emailError ? "true" : undefined}
        aria-describedby={emailError ? "email-error" : undefined}
        onblur={() => email && (emailError = validateEmail(email))}
      />
      {#if emailError}<span class="field-error" id="email-error">{emailError}</span>{/if}
    </div>

    <PasswordField id="password" bind:value={password} autocomplete="current-password" error={passwordError} />

    <div class="row">
      <a href="/forgot-password">{t("login.forgot")}</a>
    </div>

    <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
      {#if busy}<span class="spinner"></span> {t("login.busy")}{:else}{t("login.submit")}{/if}
    </button>

    <div class="or"><span>{t("auth.or")}</span></div>

    <button type="button" class="btn btn-block" disabled={busy} onclick={() => startOAuthLogin(next === "/app" ? undefined : next)}>
      <Icon name="github" size={18} /> {t("auth.github")}
    </button>

    <p class="switch">{t("login.noAccount")} <a href={signupUrl(next)}>{t("login.toSignup")}</a></p>
  </form>
</AuthLayout>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: min(400px, 100%);
  }
  .sub {
    margin-top: 6px;
    color: var(--text-soft);
  }
  .row {
    display: flex;
    justify-content: flex-end;
    margin-top: -8px;
    font-size: 0.86rem;
  }
  .or {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text-faint);
    font-size: 0.82rem;
  }
  .or::before,
  .or::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--line);
  }
  .switch {
    text-align: center;
    color: var(--text-soft);
    font-size: 0.92rem;
    margin-top: 4px;
  }
</style>
