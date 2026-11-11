// Owner: Track 2 (Person A — Kanban CRUD and UI)
// Responsible for: frontend API calls backing the /app/:id kanban board. Everything goes through
// apiRequest (api/apiClient.ts), which adds the JWT and logs the user out on an expired session.
import { apiRequest } from "../api/apiClient";
import type { Board, Card, CardMoved, List, Member, Project, Tag } from "./types";

type ListRow = Omit<List, "cards">;

export async function fetchProject(projectId: string): Promise<Project> {
  const { project } = await apiRequest<{ project: Project }>({ method: "GET", path: `/projects/${encodeURIComponent(projectId)}` });
  return project;
}

export function fetchBoardForProject(projectId: string): Promise<Board> {
  return apiRequest<Board>({ method: "GET", path: `/projects/${encodeURIComponent(projectId)}/board` });
}

export async function fetchMembers(projectId: string): Promise<Member[]> {
  const { members } = await apiRequest<{ members: Member[] }>({ method: "GET", path: `/projects/${encodeURIComponent(projectId)}/members` });
  return members;
}

export function createList(boardId: string, title: string, position: number): Promise<ListRow> {
  return apiRequest<ListRow>({ method: "POST", path: "/lists", body: { boardId, title, position } });
}

export function renameList(listId: string, title: string): Promise<ListRow> {
  return apiRequest<ListRow>({ method: "PUT", path: `/lists/${encodeURIComponent(listId)}`, body: { title } });
}

export function deleteList(listId: string): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: `/lists/${encodeURIComponent(listId)}` });
}

export function reorderLists(boardId: string, orderedListIds: string[]): Promise<void> {
  return apiRequest<void>({ method: "PUT", path: `/boards/${encodeURIComponent(boardId)}/lists/reorder`, body: { orderedListIds } });
}

export function createCard(listId: string, title: string, position: number): Promise<Card> {
  return apiRequest<Card>({ method: "POST", path: "/cards", body: { listId, title, position } });
}

export function updateCard(cardId: string, patch: { title?: string; description?: string }): Promise<Card> {
  return apiRequest<Card>({ method: "PUT", path: `/cards/${encodeURIComponent(cardId)}`, body: patch });
}

export function moveCard(cardId: string, listId: string, position: number): Promise<CardMoved> {
  return apiRequest<CardMoved>({ method: "PUT", path: `/cards/${encodeURIComponent(cardId)}/move`, body: { listId, position } });
}

export function deleteCard(cardId: string, keepalive = false): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: `/cards/${encodeURIComponent(cardId)}`, keepalive });
}

export function fetchTags(projectId: string): Promise<Tag[]> {
  return apiRequest<Tag[]>({ method: "GET", path: `/projects/${encodeURIComponent(projectId)}/tags` });
}

export function createTag(projectId: string, name: string, color: string): Promise<Tag> {
  return apiRequest<Tag>({ method: "POST", path: `/projects/${encodeURIComponent(projectId)}/tags`, body: { name, color } });
}

export function updateTag(tagId: string, patch: { name?: string; color?: string }): Promise<Tag> {
  return apiRequest<Tag>({ method: "PUT", path: `/tags/${encodeURIComponent(tagId)}`, body: patch });
}

export function deleteTag(tagId: string): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: `/tags/${encodeURIComponent(tagId)}` });
}

export function setCardTags(cardId: string, tagIds: string[]): Promise<Card> {
  return apiRequest<Card>({ method: "PUT", path: `/cards/${encodeURIComponent(cardId)}/tags`, body: { tagIds } });
}

// ---- Git integration

export async function fetchGitStatus(): Promise<boolean> {
  const { connected } = await apiRequest<{ connected: boolean }>({ method: "GET", path: "/git/status" });
  return connected;
}

export async function fetchBranches(projectId: string, repoUrl: string): Promise<string[]> {
  const { branches } = await apiRequest<{ branches: string[] }>({
    method: "GET",
    path: `/projects/${encodeURIComponent(projectId)}/git/branches?repoUrl=${encodeURIComponent(repoUrl)}`,
  });
  return branches;
}

export function linkBranch(cardId: string, repoUrl: string, branchName: string, createBranch: boolean): Promise<Card> {
  return apiRequest<Card>({ method: "POST", path: `/cards/${encodeURIComponent(cardId)}/git`, body: { repoUrl, branchName, createBranch } });
}

export function unlinkBranch(cardId: string): Promise<Card> {
  return apiRequest<Card>({ method: "DELETE", path: `/cards/${encodeURIComponent(cardId)}/git` });
}
