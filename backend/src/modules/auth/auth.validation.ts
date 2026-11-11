/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   auth.validation.ts                                 :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/07 21:44:43 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/08 20:39:47 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: backend-side validation rules for signup/login fields, per the mandatory dual frontend+backend validation requirement. TS equivalent of the ValidateSignupInput portion of backend/internal/auth/handlers.go (Go skeleton, removed).

export interface SignupInput {
	email: string;
	password: string;
	name: string;
}

// Simple check for email format to catch obviously malformed input that passed the frontend form
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NAME_LENGTH = 60;

// validateDisplayName returns what is wrong with a display name (signup and profile edit share the rule)
export function validateDisplayName(name: unknown): string | null {
	if (typeof name !== "string" || name.trim().length === 0) return "name is required";
	if (name.trim().length > MAX_NAME_LENGTH) return `name must be at most ${MAX_NAME_LENGTH} characters`;
	return null;
}

// validateNewPassword returns what is wrong with a password being chosen (signup and password change share the rule)
export function validateNewPassword(password: string): string[] {
	const errors: string[] = [];
	if (!password || password.length < MIN_PASSWORD_LENGTH) {
		errors.push(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
	}
	if (password && password.length > MAX_PASSWORD_LENGTH) {
		errors.push(`password must be at most ${MAX_PASSWORD_LENGTH} characters`);
	}
	if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
		errors.push("password must contain at least one letter and one number");
	}
	return errors;
}

// validateSignupInput checks required fields, email format, and password strength.
export function validateSignupInput(input: SignupInput): string[] {
	const errors: string[] = [];

	if (!input.email || !EMAIL_RE.test(input.email)) {
		errors.push("email must be a valid email address");
	}
	errors.push(...validateNewPassword(input.password));
	const nameError = validateDisplayName(input.name);
	if (nameError) {
		errors.push(nameError);
	}
	return errors;
}
