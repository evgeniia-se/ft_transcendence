<script lang="ts">
  import { t } from "../i18n.svelte";
  import Icon from "./Icon.svelte";
  import { toast } from "../toast.svelte";

  let { value, label }: { value: string; label: string } = $props();

  let copied = $state(false);
  let input: HTMLInputElement;

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
      toast(t("copy.done"), { kind: "success", duration: 2000 });
      setTimeout(() => (copied = false), 2000);
    } catch {
      // clipboard blocked: select the text instead
      input.select();
      toast(t("copy.selected"));
    }
  }
</script>

<div class="copy">
  <input bind:this={input} class="input" readonly {value} aria-label={label} onfocus={(e) => e.currentTarget.select()} />
  <button type="button" class="btn" onclick={copy}>
    <Icon name={copied ? "check" : "copy"} size={16} />
    {copied ? t("copy.copied") : t("copy.copy")}
  </button>
</div>

<style>
  .copy {
    display: flex;
    gap: 8px;
  }
  input {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 0.84rem;
  }
</style>
