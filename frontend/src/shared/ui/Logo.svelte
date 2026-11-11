<!-- 42 logo traced as vector paths, filled with currentColor. size = nominal height in px. -->
<script lang="ts">
  let { size = 28 }: { size?: number } = $props();

  const height = $derived(size * 0.8);
</script>

<svg
  class="logo"
  viewBox="32 149 896 629"
  width={(height * 896) / 629}
  {height}
  fill="currentColor"
  role="img"
  aria-label="42"
>
  <path d="M362 149H527L197 479H527V778H362V613H32V479Z" />
  <path d="M598 149H763L598 314Z" />
  <path d="M763 149H928V314L763 479V644H598V479L763 314Z" />
  <path d="M928 479V644H763Z" />
</svg>

<style>
  .logo {
    display: inline-block;
    flex-shrink: 0;
  }
</style>
