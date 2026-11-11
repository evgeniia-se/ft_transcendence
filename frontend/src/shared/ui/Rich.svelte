<!-- Renders a translated sentence with light markup, without HTML: `code`, **strong**, *em*. -->
<script lang="ts">
  let { text }: { text: string } = $props();

  const parts = $derived(
    text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/).filter(Boolean).map((part) => {
      if (part.startsWith("`")) return { kind: "code", value: part.slice(1, -1) };
      if (part.startsWith("**")) return { kind: "strong", value: part.slice(2, -2) };
      if (part.startsWith("*") && part.length > 2) return { kind: "em", value: part.slice(1, -1) };
      return { kind: "text", value: part };
    })
  );
</script>

{#each parts as part, i (i)}{#if part.kind === "code"}<code>{part.value}</code>{:else if part.kind === "strong"}<strong>{part.value}</strong>{:else if part.kind === "em"}<em>{part.value}</em>{:else}{part.value}{/if}{/each}
