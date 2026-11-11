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
// Simple check for email format to catch obviously malformed input that passed the frontend form
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
// validateSignupInput checks required fields, email format, and password strength.
export function validateSignupInput(input) {
    const errors = [];
    if (!input.email || !EMAIL_RE.test(input.email)) {
        errors.push("email must be a valid email address");
    }
    if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
        errors.push(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (!/[a-zA-Z]/.test(input.password) || !/[0-9]/.test(input.password)) {
        errors.push("password must contain at least one letter and one number");
    }
    if (!input.name || input.name.trim().length === 0) {
        errors.push("name is required");
    }
    return errors;
}
//# sourceMappingURL=auth.validation.js.map