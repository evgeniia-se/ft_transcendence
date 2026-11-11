export type Role = "admin" | "member" | "viewer";

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  projectId?: string;
  userId: string;
  role: Role;
  user: { id: string; name: string; email: string; avatar: string | null; createdAt?: string };
}

export interface Invite {
  id: string;
  projectId: string;
  role: Role;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface ApiKeyRow {
  id: string;
  projectId: string | null;
  rateLimit: number;
  createdAt: string;
  userId: string | null;
}

export interface NotificationRow {
  id: string;
  type: string;
  // url is an in-app path ("/app/<project>/notes/<note>") or an absolute http(s) address (a GitHub pull request)
  payload: { message?: string; url?: string | null; projectName?: string | null; cardId?: string } & Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export type SearchType = "card" | "note" | "attachment";
export type SearchSort = "relevance" | "date" | "title";

export interface SearchResult {
  entityType: SearchType;
  entityId: string;
  title: string;
  snippet: string;
  date: string;
  author: { id: string; name: string } | null;
  tags: { id: string; name: string; color: string }[];
  folderId?: string | null;
}

export interface SearchFilters {
  q: string;
  types: SearchType[];
  tag: string;
  author: string;
  from: string;
  to: string;
  sort: SearchSort;
  page: number;
  limit: number;
}

export interface SearchPage {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
}
