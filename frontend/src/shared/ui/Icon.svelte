<script lang="ts">
  const PATHS: Record<string, string> = {
    plus: "M12 5v14M5 12h14",
    x: "M6 6l12 12M18 6L6 18",
    check: "M5 12.5l4.5 4.5L19 7.5",
    search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
    bell: "M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 21h4",
    chevronDown: "M6 9l6 6 6-6",
    chevronLeft: "M15 6l-6 6 6 6",
    chevronRight: "M9 6l6 6-6 6",
    arrowLeft: "M19 12H5M11 6l-6 6 6 6",
    arrowRight: "M5 12h14M13 6l6 6-6 6",
    columns: "M4 5h4.5v14H4zM9.75 5h4.5v9h-4.5zM15.5 5H20v12h-4.5z",
    note: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
    board: "M3 6c3-2 5 2 9 0s6 2 9 0v12c-3 2-5-2-9 0s-6-2-9 0z",
    settings: "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6",
    sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
    moon: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
    monitor: "M3 5h18v11H3zM8 20h8M12 16v4",
    globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9s1.2-6.4 3.7-9z",
    copy: "M9 9h11v11H9zM5 15V4h11",
    cut: "M6 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM8.1 7.9L20 20M8.1 16.1L20 4",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
    users: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6M16 4.3a3.5 3.5 0 010 6.4M18 14.4c2 .8 3.5 2.7 3.5 5.6",
    key: "M15.5 4.5a4 4 0 110 8 4 4 0 010-8zM12.7 10.3L4 19v2.5h3V20h1.5v-1.5H10L12 16.5M16 7.5h.01",
    logout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
    branch: "M7 4v10M7 18a2 2 0 100-4 2 2 0 000 4zM17 10a2 2 0 100-4 2 2 0 000 4zM17 10c0 4-4 4-10 6",
    external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
    tag: "M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9zM8 8h.01",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
    eyeOff: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.2 3.9M6.6 7.6A16 16 0 002 12s3.6 6 10 6a9.5 9.5 0 004.3-1M9.9 9.9a3 3 0 004.2 4.2",
    lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3",
    clock: "M12 4a8 8 0 100 16 8 8 0 000-16zM12 8v4l3 2",
    grip: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
    pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
    alert: "M12 4l9.5 16h-19zM12 10v4M12 17.5h.01",
    info: "M12 4a8 8 0 100 16 8 8 0 000-16zM12 11v5M12 8h.01",
    github: "M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.2 4.2 0 00-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 00-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 00-.1 3.2A4.6 4.6 0 004 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21",
    folder: "M3 6.5h6l2 2.5h10V19H3z",
    sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z",
    wifiOff: "M12 20h.01M8.5 16.43a5 5 0 017 0M5 12.86a10 10 0 0114 0M2 8.82a15 15 0 0120 0M2 2l20 20",
  };

  // "Mx yh.01" dots are tiny when stroked: draw them as filled circles
  const DOT = /M([\d.]+) ([\d.]+)h\.01/g;
  const DOT_RADIUS: Record<string, number> = { more: 1.8, grip: 1.6 };

  let { name, size = 18 }: { name: keyof typeof PATHS | (string & {}); size?: number } = $props();

  const path = $derived(PATHS[name] ?? "");
  const dots = $derived([...path.matchAll(DOT)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) })));
  const outline = $derived(path.replace(DOT, ""));
  const radius = $derived(DOT_RADIUS[name] ?? 1.15);
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if outline}<path d={outline} />{/if}
  {#each dots as dot, i (i)}<circle cx={dot.x} cy={dot.y} r={radius} fill="currentColor" stroke="none" />{/each}
</svg>
