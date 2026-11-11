import { apiRequest } from "./apiClient";
import type { ApiKeyRow, Invite, Member, Project, Role } from "./types";

export async function listMyProjects(): Promise<Project[]> {
  const { projects } = await apiRequest<{ projects: Project[] }>({ method: "GET", path: "/projects" });
  return projects;
}

export async function createProject(name: string): Promise<Project> {
  const { project } = await apiRequest<{ project: Project }>({ method: "POST", path: "/projects", body: { name } });
  return project;
}

export async function getProject(projectId: string): Promise<Project> {
  const { project } = await apiRequest<{ project: Project }>({ method: "GET", path: `/projects/${projectId}` });
  return project;
}

export async function renameProject(projectId: string, name: string): Promise<Project> {
  const { project } = await apiRequest<{ project: Project }>({ method: "PUT", path: `/projects/${projectId}`, body: { name } });
  return project;
}

export function deleteProject(projectId: string): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: `/projects/${projectId}` });
}

export async function listMembers(projectId: string): Promise<Member[]> {
  const { members } = await apiRequest<{ members: Member[] }>({ method: "GET", path: `/projects/${projectId}/members` });
  return members;
}

// also changes the role of an existing member
export function setMemberRole(projectId: string, userId: string, role: Role): Promise<void> {
  return apiRequest<void>({ method: "PUT", path: `/projects/${projectId}/members/${userId}`, body: { role } });
}

export function addMemberByEmail(projectId: string, email: string, role: Role): Promise<void> {
  return apiRequest<void>({ method: "POST", path: `/projects/${projectId}/members`, body: { email, role } });
}

export function removeMember(projectId: string, userId: string): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: `/projects/${projectId}/members/${userId}` });
}

export async function transferOwnership(projectId: string, newOwnerId: string): Promise<Project> {
  const { project } = await apiRequest<{ project: Project }>({
    method: "POST",
    path: `/projects/${projectId}/transfer-ownership`,
    body: { newOwnerId },
  });
  return project;
}

export async function listInvites(projectId: string): Promise<Invite[]> {
  const { invites } = await apiRequest<{ invites: Invite[] }>({ method: "GET", path: `/projects/${projectId}/invites` });
  return invites;
}

// the token is only returned here, never by listInvites
export function createInvite(
  projectId: string,
  input: { role: Role; maxUses?: number; expiresAt?: string }
): Promise<{ invite: Invite; token: string }> {
  return apiRequest({ method: "POST", path: `/projects/${projectId}/invites`, body: input });
}

export function revokeInvite(projectId: string, inviteId: string): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: `/projects/${projectId}/invites/${inviteId}` });
}

export function joinInvite(token: string): Promise<void> {
  return apiRequest<void>({ method: "POST", path: `/projects/invites/${encodeURIComponent(token)}/join` });
}

export async function listApiKeys(projectId: string): Promise<ApiKeyRow[]> {
  const { apiKeys } = await apiRequest<{ apiKeys: ApiKeyRow[] }>({ method: "GET", path: `/projects/${projectId}/api-keys` });
  return apiKeys;
}

// the key is only returned here
export function createApiKey(projectId: string, rateLimit?: number): Promise<{ apiKey: ApiKeyRow; key: string }> {
  return apiRequest({ method: "POST", path: `/projects/${projectId}/api-keys`, body: rateLimit ? { rateLimit } : {} });
}

export function revokeApiKey(projectId: string, keyId: string): Promise<void> {
  return apiRequest<void>({ method: "DELETE", path: `/projects/${projectId}/api-keys/${keyId}` });
}
