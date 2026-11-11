<script lang="ts">
  import AuthLayout from "../auth/AuthLayout.svelte";
  import PasswordField from "../auth/PasswordField.svelte";
  import { signup, storeAuthSession, AuthApiError } from "../auth/authClient";
  import { startOAuthLogin } from "../auth/oauthFlow";
  import { MAX_NAME_LENGTH, validateEmail, validateName, validateNewPassword } from "../auth/validation";
  import Icon from "../shared/ui/Icon.svelte";
  import { t } from "../shared/i18n.svelte";
  import { loginUrl, nextFromUrl } from "../shared/session";

  const next = nextFromUrl();

  let name = $state("");
  let email = $state("");
  let password = $state("");
  let errors = $state<{ name: string | null; email: string | null; password: string | null }>({ name: null, email: null, password: null });
  let formError = $state<string | null>(null);
  let emailTaken = $state(false);
  let busy = $state(false);

  async function onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    formError = null;
    emailTaken = false;
    errors = { name: validateName(name), email: validateEmail(email), password: validateNewPassword(password) };
    const firstInvalid = (["name", "email", "password"] as const).find((field) => errors[field]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    busy = true;
    try {
      storeAuthSession(await signup({ name: name.trim(), email: email.trim().toLowerCase(), password }));
      window.location.href = next;
    } catch (err) {
      busy = false;
      if (err instanceof AuthApiError && err.status === 409) {
        emailTaken = true;
        errors.email = t("signup.emailTaken");
        document.getElementById("email")?.focus();
      } else if (err instanceof AuthApiError && err.status === 0) {
        formError = err.message;
      } else if (err instanceof AuthApiError && err.status === 403 && err.code === "signup_disabled") {
        formError = t("signup.closed");
      } else if (err instanceof AuthApiError && err.status === 429) {
        formError = t("auth.tooManyAttempts");
      } else {
        formError = t("signup.failed");
      }
    }
  }
  $effect(() => {
    document.title = `${t("login.toSignup")} · Transcendance`;
  });
</script>

<AuthLayout>
  <form class="form" onsubmit={onSubmit} novalidate>
    <header>
      <h1>{t("signup.title")}</h1>
      <p class="sub">{t("signup.subtitle")}</p>
    </header>

    {#if formError}
      <div class="alert" role="alert"><Icon name="alert" size={17} /> <span>{formError}</span></div>
    {/if}

    <div class="field">
      <label for="name">{t("signup.name")}</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="name"
        class="input"
        bind:value={name}
        maxlength={MAX_NAME_LENGTH}
        autocomplete="name"
        autofocus
        aria-invalid={errors.name ? "true" : undefined}
        aria-describedby={errors.name ? "name-error" : undefined}
        onblur={() => name && (errors.name = validateName(name))}
      />
      {#if errors.name}<span class="field-error" id="name-error">{errors.name}</span>{/if}
    </div>

    <div class="field">
      <label for="email">{t("auth.email")}</label>
      <input
        id="email"
        class="input"
        type="email"
        bind:value={email}
        autocomplete="email"
        aria-invalid={errors.email ? "true" : undefined}
        aria-describedby={errors.email ? "email-error" : undefined}
        oninput={() => (emailTaken = false)}
        onblur={() => email && (errors.email = validateEmail(email))}
      />
      {#if errors.email}
        <span class="field-error" id="email-error">
          {errors.email}
          {#if emailTaken}<a href={loginUrl(next)}>{t("signup.toLogin")}</a>{/if}
        </span>
      {/if}
    </div>

    <PasswordField
      id="password"
      bind:value={password}
      autocomplete="new-password"
      error={errors.password}
      showRules
      onblur={() => password && (errors.password = validateNewPassword(password))}
    />

    <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
      {#if busy}<span class="spinner"></span> {t("signup.busy")}{:else}{t("signup.submit")}{/if}
    </button>

    <div class="or"><span>{t("auth.or")}</span></div>

    <button type="button" class="btn btn-block" disabled={busy} onclick={() => startOAuthLogin(next === "/app" ? undefined : next)}>
      <Icon name="github" size={18} /> {t("auth.github")}
    </button>

    <p class="legal">
      {t("signup.legalBefore")} <a href="/legal/terms">{t("signup.legalTerms")}</a> {t("signup.legalAnd")}
      <a href="/legal/privacy">{t("signup.legalPrivacy")}</a>.
    </p>
    <p class="switch">{t("signup.hasAccount")} <a href={loginUrl(next)}>{t("signup.toLogin")}</a></p>
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
  .legal {
    font-size: 0.8rem;
    color: var(--text-faint);
    text-align: center;
  }
  .switch {
    text-align: center;
    color: var(--text-soft);
    font-size: 0.92rem;
  }
</style>
