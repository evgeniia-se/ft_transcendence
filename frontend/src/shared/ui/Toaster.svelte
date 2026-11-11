<script lang="ts">
  import { t } from "../i18n.svelte";
  import Icon from "./Icon.svelte";
  import { toasts, dismissToast } from "../toast.svelte";
</script>

<div class="toaster" role="status" aria-live="polite">
  {#each toasts as item (item.id)}
    <div class="toast {item.kind}">
      <span class="msg">{item.message}</span>
      {#if item.action}
        <button
          type="button"
          class="action"
          onclick={() => {
            item.action?.run();
            dismissToast(item.id);
          }}
        >
          {item.action.label}
        </button>
      {/if}
      <button type="button" class="close" aria-label={t("common.close")} onclick={() => dismissToast(item.id)}>
        <Icon name="x" size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: min(460px, calc(100vw - 24px));
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 10px 10px 16px;
    border-radius: var(--radius);
    background: var(--text);
    color: var(--bg);
    box-shadow: var(--shadow-lg);
    font-size: 0.9rem;
    animation: rise 0.22s var(--ease);
  }
  .toast.error {
    background: var(--danger);
    color: var(--surface-raised);
  }
  .msg {
    flex: 1;
  }
  .action {
    border: none;
    background: transparent;
    color: inherit;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .action:hover {
    background: color-mix(in srgb, currentColor 16%, transparent);
  }
  .close {
    display: inline-flex;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.65;
    padding: 6px;
    border-radius: 6px;
  }
  .close:hover {
    opacity: 1;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
</style>
