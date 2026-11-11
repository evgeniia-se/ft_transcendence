<script lang="ts">
  import type { Component } from "svelte";
  import ConfirmHost from "./ConfirmHost.svelte";
  import SiteFooter from "./SiteFooter.svelte";
  import Toaster from "./Toaster.svelte";

  let { page: Page, props = {}, footer = true }: { page: Component<any>; props?: Record<string, unknown>; footer?: boolean } = $props();
</script>

{#if footer}
  <div class="shell">
    <Page {...props} />
    <SiteFooter />
  </div>
{:else}
  <Page {...props} />
{/if}
<Toaster />
<ConfirmHost />

<style>
  .shell {
    --footer-h: 40px;
    position: relative;
    min-height: 100vh;
    min-height: 100dvh;
    padding-bottom: var(--footer-h);
  }
</style>
