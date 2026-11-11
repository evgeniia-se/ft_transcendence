<script lang="ts">
  let { tilt = true }: { tilt?: boolean } = $props();
</script>

<div class="art" class:tilt aria-hidden="true">
  <div class="tray">
    <div class="head"><span></span><i>3</i></div>
    <div class="slip"><b style:width="82%"></b><b style:width="55%"></b></div>
    <div class="slip"><b style:width="68%"></b><em class="chip-a"></em></div>
    <div class="slip"><b style:width="90%"></b></div>
  </div>
  <div class="tray">
    <div class="head"><span style:width="46%"></span><i>2</i></div>
    <div class="slip lift"><b style:width="74%"></b><b style:width="40%"></b><em class="chip-b"></em></div>
    <div class="slip"><b style:width="60%"></b></div>
  </div>
  <div class="tray">
    <div class="head"><span style:width="38%"></span><i>2</i></div>
    <div class="slip done"><b style:width="70%"></b></div>
    <div class="slip done"><b style:width="52%"></b></div>
  </div>
</div>

<style>
  .art {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 14px;
    background: var(--bg-sunken);
    border: 1px solid var(--line);
    border-radius: 20px;
    box-shadow: var(--shadow-lg);
  }
  .tilt {
    transform: perspective(1200px) rotateY(-9deg) rotateX(3deg);
  }
  .tray {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 10px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg) 70%, var(--bg-sunken));
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 14px;
    margin-bottom: 2px;
  }
  .head span {
    display: block;
    width: 62%;
    height: 8px;
    border-radius: 4px;
    background: var(--text-faint);
    opacity: 0.55;
  }
  .head i {
    font-style: normal;
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--text-faint);
  }
  .slip {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-radius: 9px;
    background: var(--surface-raised);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-sm);
  }
  .slip b {
    display: block;
    height: 7px;
    border-radius: 4px;
    background: var(--line-strong);
  }
  .slip b:first-child {
    background: var(--text-faint);
    opacity: 0.6;
  }
  .slip em {
    display: block;
    width: 34px;
    height: 12px;
    border-radius: 6px;
  }
  .chip-a {
    background: var(--accent-soft);
  }
  .chip-b {
    background: var(--warn-soft);
  }
  .lift {
    transform: translateY(-4px) rotate(-1.5deg);
    box-shadow: var(--shadow-md);
    border-color: var(--accent);
  }
  .done {
    opacity: 0.6;
  }
  @media (prefers-reduced-motion: no-preference) {
    .lift {
      animation: hover 5s ease-in-out infinite;
    }
    @keyframes hover {
      50% {
        transform: translateY(-9px) rotate(-2.5deg);
      }
    }
  }
</style>
