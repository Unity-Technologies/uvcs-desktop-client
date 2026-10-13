const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A user named by an email address, spaces and case aside. Gravatar knows people by theirs: a user named otherwise has
 * no picture to ask for, and nothing is sent.
 */
export function isEmailAddress(user: string): boolean {
  return EMAIL.test(user.trim().toLowerCase());
}
