// Owner: Track 2 (Person A — Kanban CRUD and UI)
// Responsible for: the reactive state of the kanban page (project, board, members, who is online) and
// every way it changes — user actions (optimistic, rolled back by a reload on failure) and the live
// Socket.IO events sent by the other participants.
//
// Every event handler is idempotent: our own mutations update the state as soon as the HTTP call
// returns AND come back as a broadcast, in either order, so applying one twice must change nothing.
import { SvelteSet } from "svelte/reactivity";
import { ApiError } from "../api/apiClient";
import { getStoredUser } from "../auth/authClient";
import { errorMessage } from "../shared/errors";
import { toast } from "../shared/toast.svelte";
import { listAttachments } from "../files/attachmentsApi";
import { listNotes } from "../notes/notesApi";
import * as api from "./boardApi";
import { connectKanbanSocket } from "./wsClient";
import type { Board, Card, CardMoved, List, Member, Project, Tag } from "./types";
import { t } from "../shared/i18n.svelte";

type LoadState = "loading" | "ready" | "error";

const byPosition = (a: { position: number; id: string }, b: { position: number; id: string }): number =>
  a.position - b.position || a.id.localeCompare(b.id);

// ms a deleted card can be restored before the server is told
const UNDO_MS = 6000;
// ms a card changed by someone else stays highlighted
const FLASH_MS = 1800;

// created in the interface language
const DEFAULT_LISTS = ["board.defaultTodo", "board.defaultDoing", "board.defaultDone"] as const;

interface PendingDelete {
  card: Card;
  listId: string;
  index: number;
  timer: ReturnType<typeof setTimeout>;
}

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function hasUnsafeKey(value: unknown, depth = 0): boolean {
  if (typeof value !== "object" || value === null || depth > 6) return false;
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key)) return true;
    if (hasUnsafeKey((value as Record<string, unknown>)[key], depth + 1)) return true;
  }
  return false;
}

export class BoardStore {
  project = $state<Project | null>(null);
  board = $state<Board | null>(null);
  members = $state<Member[]>([]);
  tags = $state<Tag[]>([]);
  docCounts = $state<Record<string, number>>({});
  online = new SvelteSet<string>();
  loadState = $state<LoadState>("loading");
  // the logged-in user's role in this project: viewers get a read-only board
  myRole = $derived(this.members.find((m) => m.userId === getStoredUser()?.id)?.role ?? null);
  canEdit = $derived(this.myRole === "admin" || this.myRole === "member");
  // the server refused the room: the user is not a member of this project
  accessDenied = $state(false);
  // why the board was closed while it was open: the user was removed, or the project was deleted
  accessLostReason = $state<"removed" | "deleted" | null>(null);
  // last failed user action, shown by the page until dismissed
  actionError = $state<string | null>(null);
  // the live connection is up
  connected = $state(true);
  // toolbar filter: hides other cards and turns dragging off
  filter = $state("");
  // cards changed by someone else, highlighted for a moment
  flashed = new SvelteSet<string>();
  // what is being dragged right now (drag data can't be read during dragover, so the store keeps it)
  drag = $state<{ kind: "card" | "list"; id: string } | null>(null);
  // the card whose detail dialog is open; the dialog follows live updates and closes if the card is deleted
  openCardId = $state<string | null>(null);
  // card whose Git link dialog is open
  gitCardId = $state<string | null>(null);
  openCard = $derived.by(() => {
    for (const list of this.board?.lists ?? []) {
      const card = list.cards.find((c) => c.id === this.openCardId);
      if (card) return { card, list };
    }
    return null;
  });

  readonly #projectId: string;
  #disconnect: (() => void) | null = null;
  // deleted cards waiting for the undo delay: hidden here, still on the server
  #pendingDeletes = new Map<string, PendingDelete>();
  // cards this user just changed: no highlight when the broadcast comes back
  #mine = new Set<string>();
  // cards with a tag change in flight: other updates must not overwrite their tags
  #tagsPending = new Map<string, number>();
  #docTimer: ReturnType<typeof setTimeout> | undefined;
  readonly #flushDeletes = (): void => this.#commitAllDeletes();

  #offlineTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(projectId: string) {
    this.#projectId = projectId;
  }

  // start loads the page data, then listens to the project room
  async start(): Promise<void> {
    await this.load();
    window.addEventListener("pagehide", this.#flushDeletes);
    this.#disconnect = connectKanbanSocket(this.#projectId, {
      onEvent: (event, payload) => this.applyEvent(event, payload),
      onReconnect: () => void this.load(),
      onStatus: (connected) => {
        clearTimeout(this.#offlineTimer);
        if (connected) this.connected = true;
        else this.#offlineTimer = setTimeout(() => (this.connected = false), 2000);
        // who is online is unknown while offline: the server sends a fresh snapshot when the connection is back
        if (!connected) this.online.clear();
      },
    });
  }

  stop(): void {
    clearTimeout(this.#offlineTimer);
    clearTimeout(this.#docTimer);
    window.removeEventListener("pagehide", this.#flushDeletes);
    this.#commitAllDeletes();
    this.#disconnect?.();
    this.#disconnect = null;
  }

  // load (re)fetches everything. Also used to resync after a reconnect or a failed action.
  async load(): Promise<void> {
    try {
      const [project, board, members, tags] = await Promise.all([
        api.fetchProject(this.#projectId),
        api.fetchBoardForProject(this.#projectId),
        api.fetchMembers(this.#projectId),
        api.fetchTags(this.#projectId),
      ]);
      this.project = project;
      this.board = board;
      this.members = members;
      this.tags = tags;
      for (const id of this.#pendingDeletes.keys()) this.#dropCard(id);
      this.loadState = "ready";
      void this.loadDocCounts();
    } catch (err) {
      // a failed reload keeps showing the board we already have
      if (this.loadState !== "ready") {
        this.loadState = "error";
        this.accessDenied = err instanceof ApiError && (err.status === 403 || err.status === 404);
      }
    }
  }

  async loadDocCounts(): Promise<void> {
    try {
      const [notes, files] = await Promise.all([listNotes(this.#projectId), listAttachments(this.#projectId)]);
      const counts: Record<string, number> = {};
      for (const cardId of [...notes, ...files].flatMap((doc) => doc.cardIds)) counts[cardId] = (counts[cardId] ?? 0) + 1;
      this.docCounts = counts;
    } catch {
      // keep the previous counts
    }
  }

  // ---- user actions. They return false when the server refused, so a form can keep what was typed.

  async addList(title: string): Promise<boolean> {
    const board = this.board;
    if (!board) return false;
    return this.#run(async () => {
      const row = await api.createList(board.id, title, board.lists.length);
      this.#upsertList(row);
    });
  }

  async renameList(listId: string, title: string): Promise<boolean> {
    return this.#run(async () => this.#upsertList(await api.renameList(listId, title)));
  }

  async removeList(listId: string): Promise<boolean> {
    return this.#run(async () => {
      await api.deleteList(listId);
      this.#dropList(listId);
    });
  }

  // moveList puts a list at `toIndex`, shifting the others (drag-and-drop on the list headers)
  async moveList(listId: string, toIndex: number): Promise<void> {
    const board = this.board;
    if (!board) return;
    const ids = board.lists.map((l) => l.id).filter((id) => id !== listId);
    if (!board.lists.some((l) => l.id === listId)) return;
    ids.splice(Math.min(toIndex, ids.length), 0, listId);

    this.#applyListOrder(ids);
    const ok = await this.#run(() => api.reorderLists(board.id, ids));
    if (!ok) await this.load();
  }

  // gives an empty board the three usual lists
  async addDefaultLists(): Promise<boolean> {
    for (const key of DEFAULT_LISTS) {
      if (!(await this.addList(t(key)))) return false;
    }
    return true;
  }

  async addCard(listId: string, title: string): Promise<boolean> {
    const list = this.#findList(listId);
    if (!list) return false;
    return this.#run(async () => {
      const card = await api.createCard(listId, title, list.cards.length);
      this.#mine.add(card.id);
      this.#upsertCard(card);
    });
  }

  async editCard(cardId: string, patch: { title?: string; description?: string }): Promise<boolean> {
    this.#mine.add(cardId);
    return this.#run(async () => this.#upsertCard(await api.updateCard(cardId, patch)));
  }

  async setCardTags(cardId: string, tagIds: string[]): Promise<void> {
    const card = this.#findCardList(cardId)?.cards.find((c) => c.id === cardId);
    if (!card) return;
    this.#mine.add(cardId);
    card.tags = tagIds.flatMap((id) => this.tags.find((t) => t.id === id) ?? []);
    this.#tagsPending.set(cardId, (this.#tagsPending.get(cardId) ?? 0) + 1);
    const ok = await this.#run(async () => {
      const saved = await api.setCardTags(cardId, tagIds);
      const left = (this.#tagsPending.get(cardId) ?? 1) - 1;
      if (left > 0) this.#tagsPending.set(cardId, left);
      else this.#tagsPending.delete(cardId);
      if (left === 0) this.#upsertCard(saved);
    });
    if (!ok) {
      this.#tagsPending.delete(cardId);
      await this.load();
    }
  }

  // Links the card to a branch (creating it on GitHub when asked). Returns an error message, or null when it worked.
  async linkBranch(cardId: string, repoUrl: string, branchName: string, createBranch: boolean): Promise<string | null> {
    this.#mine.add(cardId);
    try {
      this.#upsertCard(await api.linkBranch(cardId, repoUrl, branchName, createBranch));
      return null;
    } catch (err) {
      if (err instanceof ApiError && err.code === "github_error" && typeof err.payload.message === "string") return err.payload.message;
      if (err instanceof ApiError && err.code === "github_not_linked") return t("git.notLinked");
      return errorMessage(err);
    }
  }

  async unlinkBranch(cardId: string): Promise<boolean> {
    this.#mine.add(cardId);
    return this.#run(async () => this.#upsertCard(await api.unlinkBranch(cardId)));
  }

  // the tag methods return an error message for the tag dialog (null or no error when it worked)
  async addTag(name: string, color: string): Promise<{ tag?: Tag; error?: string }> {
    try {
      const tag = await api.createTag(this.#projectId, name, color);
      this.#upsertTag(tag);
      return { tag };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }

  async editTag(tagId: string, patch: { name?: string; color?: string }): Promise<string | null> {
    try {
      this.#upsertTag(await api.updateTag(tagId, patch));
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  async removeTag(tagId: string): Promise<string | null> {
    try {
      await api.deleteTag(tagId);
      this.#dropTag(tagId);
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  // hides the card now and deletes it on the server after UNDO_MS (the toast offers undo)
  removeCard(cardId: string): void {
    const list = this.#findCardList(cardId);
    const card = list?.cards.find((c) => c.id === cardId);
    if (!list || !card) return;

    const index = list.cards.indexOf(card);
    const snapshot = $state.snapshot(card) as Card;
    this.#dropCard(cardId);
    if (this.openCardId === cardId) this.openCardId = null;

    const timer = setTimeout(() => void this.#commitDelete(cardId), UNDO_MS);
    this.#pendingDeletes.set(cardId, { card: snapshot, listId: list.id, index, timer });
    toast(t("card.deleted"), { duration: UNDO_MS, action: { label: t("common.undo"), run: () => this.#undoDelete(cardId) } });
  }

  #undoDelete(cardId: string): void {
    const pending = this.#pendingDeletes.get(cardId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pendingDeletes.delete(cardId);
    const list = this.#findList(pending.listId);
    if (!list) {
      void this.load();
      return;
    }
    list.cards.splice(Math.min(pending.index, list.cards.length), 0, pending.card);
  }

  async #commitDelete(cardId: string, keepalive = false): Promise<void> {
    const pending = this.#pendingDeletes.get(cardId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pendingDeletes.delete(cardId);
    try {
      await api.deleteCard(cardId, keepalive);
    } catch (err) {
      // already deleted elsewhere is fine; otherwise restore the card and show the error
      if (err instanceof ApiError && err.status === 404) return;
      this.actionError = errorMessage(err);
      await this.load();
    }
  }

  #commitAllDeletes(): void {
    for (const id of [...this.#pendingDeletes.keys()]) void this.#commitDelete(id, true);
  }

  // moveCard puts a card at `toIndex` of a list (maybe another one): the UI updates right away, and a
  // reload puts things back if the server refuses
  async moveCard(cardId: string, toListId: string, toIndex: number): Promise<void> {
    const from = this.#findCardList(cardId);
    const to = this.#findList(toListId);
    if (!from || !to) return;

    const toOrder = from === to ? from.cards.map((c) => c.id).filter((id) => id !== cardId) : to.cards.map((c) => c.id);
    toOrder.splice(Math.min(toIndex, toOrder.length), 0, cardId);
    const fromOrder = from === to ? toOrder : from.cards.map((c) => c.id).filter((id) => id !== cardId);

    this.#mine.add(cardId);
    this.#applyMove({ cardId, fromListId: from.id, toListId, fromOrder, toOrder });
    const ok = await this.#run(() => api.moveCard(cardId, toListId, toIndex));
    if (!ok) await this.load();
  }

  dismissError(): void {
    this.actionError = null;
  }

  // ---- live events from the project room

  applyEvent(event: string, payload: unknown): void {
    if (hasUnsafeKey(payload)) return;
    switch (event) {
      case "presence": {
        const { userId, status } = payload as { userId: string; status: "joined" | "left" };
        if (status === "joined") this.online.add(userId);
        else this.online.delete(userId);
        return;
      }
      case "presence_snapshot": {
        // the whole truth at join time: replaces what we knew, so nobody who left meanwhile stays "online"
        const { userIds } = payload as { userIds: string[] };
        this.online.clear();
        for (const userId of userIds) this.online.add(userId);
        return;
      }
      case "members_changed":
        // the member list decides who may edit: a promoted or demoted viewer sees the board change at once
        void this.#refreshMembers();
        return;
      case "project_updated": {
        const { name } = payload as { id: string; name: string };
        if (this.project) this.project = { ...this.project, name };
        return;
      }
      case "removed_from_project":
        if ((payload as { projectId: string }).projectId === this.#projectId) this.#lose("removed");
        return;
      case "project_deleted":
        if ((payload as { projectId: string }).projectId === this.#projectId) this.#lose("deleted");
        return;
      case "join_denied":
        this.accessDenied = true;
        return;
    }

    if (!this.board) return;
    switch (event) {
      case "list_created":
      case "list_updated":
        this.#upsertList(payload as Omit<List, "cards">);
        break;
      case "list_deleted":
        this.#dropList((payload as { id: string }).id);
        break;
      case "lists_reordered":
        this.#applyListOrder((payload as { orderedListIds: string[] }).orderedListIds);
        break;
      case "card_created":
      case "card_updated":
        this.#upsertCard(payload as Card);
        this.#flash((payload as Card).id);
        break;
      case "tag_created":
      case "tag_updated":
        this.#upsertTag(payload as Tag);
        break;
      case "tag_deleted":
        this.#dropTag((payload as { id: string }).id);
        break;
      case "card_deleted":
        this.#dropCard((payload as { id: string }).id);
        break;
      case "documents_changed":
        // debounce bursts of link changes
        clearTimeout(this.#docTimer);
        this.#docTimer = setTimeout(() => void this.loadDocCounts(), 300);
        break;
      case "card_moved":
        this.#applyMove(payload as CardMoved);
        this.#flash((payload as CardMoved).cardId);
        break;
      // board_created / board_deleted: nothing to show, the page has a single board per project
    }
  }

  // ---- state helpers

  async #refreshMembers(): Promise<void> {
    try {
      this.members = await api.fetchMembers(this.#projectId);
    } catch (err) {
      // the list is refused once we are no longer a member
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) this.#lose("removed");
    }
  }

  #lose(reason: "removed" | "deleted"): void {
    this.accessLostReason = reason;
    this.accessDenied = true;
  }

  async #run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
      return true;
    } catch (err) {
      this.actionError = errorMessage(err);
      return false;
    }
  }

  #flash(cardId: string): void {
    if (this.#mine.delete(cardId)) return;
    this.flashed.add(cardId);
    setTimeout(() => this.flashed.delete(cardId), FLASH_MS);
  }

  #findList(listId: string): List | undefined {
    return this.board?.lists.find((l) => l.id === listId);
  }

  #findCardList(cardId: string): List | undefined {
    return this.board?.lists.find((l) => l.cards.some((c) => c.id === cardId));
  }

  // upsert: add the list if it's new, otherwise update its title/position
  #upsertList(row: Omit<List, "cards">): void {
    const board = this.board;
    if (!board) return;
    const existing = board.lists.find((l) => l.id === row.id);
    if (existing) {
      existing.title = row.title;
      existing.position = row.position;
    } else {
      board.lists.push({ id: row.id, boardId: row.boardId, title: row.title, position: row.position, cards: [] });
    }
    board.lists.sort(byPosition);
  }

  #dropList(listId: string): void {
    if (this.board) this.board.lists = this.board.lists.filter((l) => l.id !== listId);
  }

  // applyListOrder reorders the lists following `orderedIds` (lists missing from it keep their relative order, last)
  #applyListOrder(orderedIds: string[]): void {
    const board = this.board;
    if (!board) return;
    const rank = new Map(orderedIds.map((id, index) => [id, index]));
    const ordered = [...board.lists].sort(
      (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || byPosition(a, b)
    );
    ordered.forEach((list, index) => (list.position = index));
    board.lists = ordered;
  }

  #upsertCard(card: Card): void {
    if (this.#pendingDeletes.has(card.id)) return;
    const list = this.#findList(card.listId);
    if (!list) return;
    const existing = this.#findCardList(card.id)?.cards.find((c) => c.id === card.id);
    if (existing) {
      const { tags, ...rest } = card;
      Object.assign(existing, rest);
      if (tags && !this.#tagsPending.has(card.id)) existing.tags = tags;
    } else {
      list.cards.push(card);
    }
    list.cards.sort(byPosition);
  }

  #upsertTag(tag: Tag): void {
    const existing = this.tags.find((t) => t.id === tag.id);
    if (existing) {
      Object.assign(existing, tag);
      for (const list of this.board?.lists ?? []) {
        for (const card of list.cards) {
          const used = card.tags?.find((t) => t.id === tag.id);
          if (used) Object.assign(used, tag);
        }
      }
    } else {
      this.tags.push(tag);
    }
  }

  #dropTag(tagId: string): void {
    this.tags = this.tags.filter((t) => t.id !== tagId);
    for (const list of this.board?.lists ?? []) {
      for (const card of list.cards) {
        if (card.tags?.some((t) => t.id === tagId)) card.tags = card.tags.filter((t) => t.id !== tagId);
      }
    }
  }

  #dropCard(cardId: string): void {
    const list = this.#findCardList(cardId);
    if (list) list.cards = list.cards.filter((c) => c.id !== cardId);
  }

  // applyMove sets the card order of both lists from the ids the server (or moveCard) computed. If it
  // mentions a card we don't know, we missed an event: resync instead of guessing.
  #applyMove(move: CardMoved): void {
    const board = this.board;
    if (!board) return;
    const known = new Map(board.lists.flatMap((l) => l.cards).map((c) => [c.id, c]));
    const pick = (ids: string[]): Card[] | null => {
      const cards = ids.map((id) => known.get(id));
      return cards.every((c) => c !== undefined) ? (cards as Card[]) : null;
    };

    const from = this.#findList(move.fromListId);
    const to = this.#findList(move.toListId);
    const fromCards = pick(move.fromOrder);
    const toCards = pick(move.toOrder);
    const moved = known.get(move.cardId);
    if (!from || !to || !fromCards || !toCards || !moved) {
      void this.load();
      return;
    }

    moved.listId = move.toListId;
    from.cards = fromCards;
    to.cards = toCards;
    for (const list of from === to ? [to] : [from, to]) {
      list.cards.forEach((card, index) => (card.position = index));
    }
  }
}
