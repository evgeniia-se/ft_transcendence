// Mirrors backend auth.validation.ts, with one message per field.
import { t } from "../shared/i18n.svelte";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return t("auth.emailRequired");
  if (!EMAIL_RE.test(email.trim())) return t("auth.emailInvalid");
  return null;
}

export const MAX_NAME_LENGTH = 60;

export function validateName(name: string): string | null {
  if (!name.trim()) return t("auth.nameRequired");
  if (name.trim().length > MAX_NAME_LENGTH) return t("auth.nameTooLong", { max: MAX_NAME_LENGTH });
  return null;
}

export interface PasswordChecks {
  length: boolean;
  letter: boolean;
  digit: boolean;
}

export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    letter: /[a-zA-Z]/.test(password),
    digit: /[0-9]/.test(password),
  };
}

export function validateNewPassword(password: string): string | null {
  const checks = passwordChecks(password);
  if (!password) return t("auth.passwordRequired");
  if (!checks.length) return t("auth.passwordTooShort", { min: MIN_PASSWORD_LENGTH });
  if (!checks.letter || !checks.digit) return t("auth.passwordLetterDigit");
  return null;
}
