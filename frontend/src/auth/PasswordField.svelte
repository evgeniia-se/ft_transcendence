<script lang="ts">
  import Icon from "../shared/ui/Icon.svelte";
  import { passwordChecks, MIN_PASSWORD_LENGTH } from "./validation";
  import { t } from "../shared/i18n.svelte";

  let {
    id,
    label,
    value = $bindable(""),
    autocomplete,
    error = null,
    showRules = false,
    onblur,
  }: {
    id: string;
    label?: string;
    value: string;
    autocomplete: "current-password" | "new-password";
    error?: string | null;
    showRules?: boolean;
    onblur?: () => void;
  } = $props();

  let visible = $state(false);
  const checks = $derived(passwordChecks(value));
  const rules = $derived([
    { ok: checks.length, text: t("password.ruleLength", { min: MIN_PASSWORD_LENGTH }) },
    { ok: checks.letter, text: t("password.ruleLetter") },
    { ok: checks.digit, text: t("password.ruleDigit") },
  ]);
</script>

<div class="field">
  <label for={id}>{label ?? t("password.label")}</label>
  <div class="wrap">
    <input
      {id}
      class="input"
      type={visible ? "text" : "password"}
      bind:value
      {autocomplete}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error ? `${id}-error` : showRules ? `${id}-rules` : undefined}
      {onblur}
    />
    <button
      type="button"
      class="toggle"
      aria-label={visible ? t("password.hide") : t("password.show")}
      aria-pressed={visible}
      onclick={() => (visible = !visible)}
    >
      <Icon name={visible ? "eyeOff" : "eye"} size={17} />
    </button>
  </div>
  {#if error}<span class="field-error" id={`${id}-error`}>{error}</span>{/if}
  {#if showRules}
    <ul class="rules" id={`${id}-rules`}>
      {#each rules as rule (rule.text)}
        <li class:ok={rule.ok}><Icon name={rule.ok ? "check" : "plus"} size={13} /> {rule.text}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
  }
  .wrap .input {
    padding-right: 44px;
  }
  .toggle {
    position: absolute;
    top: 3px;
    right: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-faint);
  }
  .toggle:hover {
    color: var(--text);
    background: var(--bg-sunken);
  }
  .rules {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    list-style: none;
    padding: 0;
    margin-top: 2px;
  }
  .rules li {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    color: var(--text-faint);
    transition: color 0.15s var(--ease);
  }
  .rules li.ok {
    color: var(--accent-strong);
  }
</style>
