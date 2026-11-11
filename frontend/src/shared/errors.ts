// Turns API errors into messages for the user.
import { ApiError } from "../api/apiClient";
import { t, type MessageKey } from "./i18n.svelte";

// API error codes that have their own message (key "error.<code>" in the dictionaries)
const KNOWN_CODES = new Set([
  "network_error", "invalid_credentials", "email_already_registered", "forbidden", "owner_required", "last_admin",
  "owner_role_immutable", "cannot_remove_owner", "not_a_project_member", "project_not_found", "user_not_found",
  "invite_not_found", "invite_revoked", "invite_expired", "invite_exhausted", "already_member", "already_revoked",
  "api_key_not_found", "tag_name_taken", "wrong_password", "invalid_avatar", "avatar_too_large", "rate_limit_exceeded",
]);

export function errorMessage(err: unknown, fallback?: string): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return t("auth.tooManyAttempts");
    if (err.status >= 500) return t("error.server");
    if (KNOWN_CODES.has(err.code)) return t(`error.${err.code}` as MessageKey);
    if (err.status === 403) return t("error.forbidden");
    if (err.details.length > 0) return err.details.join(" ");
  }
  return fallback ?? t("error.generic");
}
