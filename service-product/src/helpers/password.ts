import bcrypt from 'bcrypt';
import { z } from 'zod';

/**
 * Password validation regex:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one number
 * - Special characters allowed but limited to common safe ones: !@#$%^&*()_+-=[]{}|;:,.<>?
 * - No characters that could lead to XSS or SQL injection (e.g., ', ", `, \, /)
 */
const PASSWORD_REGEX = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{}|;:,.<>?]{8,}$/;

/**
 * Zod schema for password validation
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    PASSWORD_REGEX,
    'Password contains invalid characters or does not meet complexity requirements'
  );

/**
 * Hashes a password using bcrypt with a salt round of 10.
 *
 * @param password - The plain text password to hash
 * @returns The hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate password before hashing (optional but recommended for internal consistency)
  PasswordSchema.parse(password);
  return bcrypt.hash(password, 10);
}

/**
 * Compares a plain text password with a hashed password.
 *
 * @param plainPassword - The plain text password
 * @param hashedPassword - The hashed password from the database
 * @returns True if the passwords match, false otherwise
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
