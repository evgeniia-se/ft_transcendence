<script lang="ts">
  import type { Snippet } from "svelte";
  import Logo from "./Logo.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";
  import LangSwitch from "./LangSwitch.svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div class="page">
  <header>
    <a class="brand" href="/"><Logo size={30} /><span>Transcendance</span></a>
    <div class="switches"><LangSwitch compact /><ThemeSwitch compact /></div>
  </header>
  <main>{@render children()}</main>
</div>

<style>
  .switches {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .page {
    min-height: calc(100vh - var(--footer-h, 0px));
    display: flex;
    flex-direction: column;
    padding: 20px 28px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 14px;
    padding: 40px 0 80px;
  }
</style>
