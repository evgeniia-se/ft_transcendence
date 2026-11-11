// Owner: Track 2 (Person A — Kanban CRUD and UI)
// Responsible for: the geometry behind drag-and-drop on the board.

// insertionIndex tells where a dragged item would land among the items of `container` (the elements
// matching `selector`, each carrying a data-id), given the pointer position along the axis. The dragged
// item itself is ignored, so the result is its index once it has been taken out — the same meaning as
// the `toIndex` of BoardStore.moveCard / moveList.
export function insertionIndex(
  container: HTMLElement,
  selector: string,
  pointer: number,
  axis: "x" | "y",
  draggedId: string
): number {
  let index = 0;
  for (const item of container.querySelectorAll<HTMLElement>(selector)) {
    if (item.dataset.id === draggedId) continue;
    const rect = item.getBoundingClientRect();
    const middle = axis === "y" ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    if (pointer > middle) index++;
  }
  return index;
}

// othersBefore counts the items before position `i` of `ids`, not counting the dragged one
export function othersBefore(ids: string[], i: number, draggedId: string | undefined): number {
  return ids.slice(0, i).filter((id) => id !== draggedId).length;
}
