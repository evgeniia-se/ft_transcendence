// Owner: Track 2 (Person A — Kanban CRUD and UI)
// initials turns "John Smith" into "JS" (two letters max), used for avatars

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}
