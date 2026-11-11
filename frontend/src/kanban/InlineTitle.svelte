<!-- Owner: Track 2 (Person A — Kanban CRUD and UI)
     Responsible for: titles edited in place. Enter or blur saves, Escape cancels. -->
<script lang="ts">
  let {
    value,
    editable,
    label,
    onsave,
    large = false,
    maxlength = 100,
  }: {
    value: string;
    editable: boolean;
    label: string;
    // false if the server refused: the old title comes back
    onsave: (title: string) => Promise<boolean>;
    large?: boolean;
    maxlength?: number;
  } = $props();

  let field: HTMLTextAreaElement;
  let draft = $state("");
  let focused = $state(false);

  $effect(() => {
    if (!focused) draft = value;
  });

  // grow with the content
  $effect(() => {
    void draft;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  });

  export function focus(): void {
    field.focus();
    field.select();
  }

  async function commit(): Promise<void> {
    focused = false;
    const title = draft.trim();
    if (!title || title === value) {
      draft = value;
      return;
    }
    if (!(await onsave(title))) draft = value;
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      field.blur();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      draft = value;
      field.blur();
    }
  }
</script>

<textarea
  bind:this={field}
  bind:value={draft}
  class:large
  rows="1"
  {maxlength}
  readonly={!editable}
  aria-label={label}
  spellcheck="false"
  onfocus={() => (focused = true)}
  onblur={commit}
  {onkeydown}
></textarea>

<style>
  textarea {
    display: block;
    flex: 1;
    width: 100%;
    min-width: 0;
    resize: none;
    overflow: hidden;
    /* serif text looks low in its box: lift it 2px */
    padding: 1px 6px 5px;
    margin: -3px -6px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    font: inherit;
    font-weight: 650;
    color: var(--text);
    line-height: 1.35;
  }
  textarea.large {
    font-family: var(--font-serif);
    font-size: 1.45rem;
    font-weight: 600;
    line-height: 1.25;
  }
  textarea:not(:read-only):hover {
    background: var(--bg-sunken);
  }
  textarea:focus {
    outline: none;
    background: var(--surface-raised);
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  textarea:read-only {
    cursor: default;
  }
</style>
