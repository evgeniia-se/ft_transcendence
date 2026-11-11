<!-- Staggered entrance: the `enter` of the board's LoadGate must be longer than the last delay. -->
<script lang="ts">
  // lines per placeholder card, per column
  const COLUMNS = [
    [2, 1, 2, 1],
    [3, 2, 1],
    [1, 2],
  ];
</script>

<div class="sk-board">
  <div class="toolbar sk-enter" style:--i="0">
    <div class="skeleton filter"></div>
    <div class="sk-line count"></div>
  </div>
  <div class="cols">
    {#each COLUMNS as cards, c (c)}
      <div class="col sk-enter" style:--i={c + 1}>
        <div class="head"><div class="sk-line title" style:width="{[52, 40, 46][c]}%"></div><div class="sk-line pill"></div></div>
        {#each cards as lines, j (j)}
          <div class="card sk-enter" style:--i={c + 2 + j * 0.7}>
            <div class="sk-line first" style:width="{[88, 72, 80, 64][(c + j) % 4]}%"></div>
            {#if lines > 1}<div class="sk-line" style:width="{[60, 74][(c + j) % 2]}%"></div>{/if}
            {#if lines > 2}<div class="sk-line chip"></div>{/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .sk-board {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 20px 10px;
  }
  .filter {
    width: min(280px, 60vw);
    height: 36px;
    border-radius: 10px;
  }
  .count {
    width: 56px;
  }
  .cols {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 4px 20px;
    overflow: hidden;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 300px;
    flex-shrink: 0;
    padding: 10px 8px 12px;
    border-radius: var(--radius-lg);
    background: var(--bg-sunken);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 24px;
    padding: 0 6px;
  }
  .title {
    height: 11px;
    background: var(--line-strong);
  }
  .pill {
    width: 22px;
    height: 18px;
    border-radius: 999px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 14px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-raised);
    box-shadow: var(--shadow-sm);
  }
  .card .first {
    height: 11px;
    background: var(--line-strong);
  }
  .chip {
    width: 64px;
    height: 16px;
    border-radius: 8px;
  }
  @media (max-width: 600px) {
    .toolbar {
      padding: 12px 12px 8px;
    }
    .cols {
      padding: 4px 12px;
    }
    .col {
      width: min(300px, 84vw);
    }
  }
</style>
