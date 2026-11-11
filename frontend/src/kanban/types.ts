// Owner: Track 2 (Person A — Kanban CRUD and UI)
// Responsible for: the shapes the kanban backend sends over HTTP and Socket.IO.

export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface GitLink {
  cardId: string;
  repoUrl: string;
  branchName: string;
  // none | open | merged, kept up to date by the Git webhook
  prStatus: string;
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  position: number;
  status?: string;
  linkedBranch?: string | null;
  linkedPrUrl?: string | null;
  tags?: Tag[];
  // set while the card is linked to a GitHub branch (null otherwise)
  gitLink?: GitLink | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface List {
  id: string;
  boardId: string;
  title: string;
  position: number;
  cards: Card[];
}

export interface Board {
  id: string;
  projectId: string;
  title: string;
  lists: List[];
}

export type { Project, Member, Role } from "../api/types";

// payload of the "card_moved" event and of the PUT /cards/:id/move response: the new card order of
// both lists (identical when the card stays in its list), so clients don't have to replay the shift
export interface CardMoved {
  cardId: string;
  fromListId: string;
  toListId: string;
  fromOrder: string[];
  toOrder: string[];
}
