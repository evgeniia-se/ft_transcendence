import { apiRequest } from "./apiClient";
import type { NotificationRow, SearchFilters, SearchPage, SearchResult } from "./types";

// the newest notifications, and how many are unread in total (not only in the returned page)
export async function listNotifications(limit = 30): Promise<{ notifications: NotificationRow[]; unreadCount: number }> {
  return apiRequest<{ notifications: NotificationRow[]; unreadCount: number }>({ method: "GET", path: `/notifications?limit=${limit}` });
}

// edits the display name of the signed-in user; the e-mail is the login identity and cannot be changed
export function updateProfile(name: string): Promise<{ id: string; email: string; name: string }> {
  return apiRequest({ method: "PATCH", path: "/users/me", body: { name } });
}

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

// uploads the profile picture (the server checks the real content and the 2 MiB cap again)
export function uploadAvatar(file: File): Promise<{ avatar: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiRequest({ method: "PUT", path: "/users/me/avatar", body: form });
}

// back to the default avatar (coloured initials)
export function removeAvatar(): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: "/users/me/avatar" });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiRequest<void>({ method: "PUT", path: "/users/me/password", body: { currentPassword, newPassword } });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest<{ updated: number }>({ method: "PUT", path: "/notifications/read-all" });
}

// removes every notification of the signed-in user
export function deleteAllNotifications(): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: "/notifications" });
}

// removes one notification
export function deleteNotification(id: string): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: `/notifications/${id}` });
}

export function markNotificationRead(id: string): Promise<void> {
  return apiRequest<void>({ method: "PUT", path: `/notifications/${id}/read` });
}

export async function searchProject(projectId: string, query: string): Promise<SearchResult[]> {
  const { results } = await apiRequest<{ results: SearchResult[] }>({
    method: "GET",
    path: `/search/${projectId}?q=${encodeURIComponent(query)}`,
  });
  return results;
}

export function searchProjectPage(projectId: string, filters: SearchFilters): Promise<SearchPage> {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.types.length > 0 && filters.types.length < 3) params.set("type", filters.types.join(","));
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.author) params.set("author", filters.author);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  params.set("limit", String(filters.limit));
  return apiRequest<SearchPage>({ method: "GET", path: `/search/${projectId}?${params.toString()}` });
}

// transferTo is needed when you are the only admin of a shared project
export function deleteAccount(userId: string, transferTo?: string): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: `/users/${userId}`, body: transferTo ? { transferTo } : {} });
}
