import * as argon2 from 'argon2';

/**
 * Hash a password using Argon2
 * @param plainPassword The plain text password to hash
 * @returns Promise that resolves to the hashed password
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  try {
    return await argon2.hash(plainPassword, {
      type: argon2.argon2id, // Recommended hybrid version
      memoryCost: 65536,    // Memory usage in KiB (64MB)
      timeCost: 3,          // Number of iterations
      parallelism: 1,       // Number of parallel threads
      hashLength: 32        // Output length in bytes
    });
  } catch (err) {
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a password against a stored hash
 * @param hashedPassword The stored hashed password
 * @param plainPassword The plain text password to verify
 * @returns Promise that resolves to true if passwords match
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return await argon2.verify(hashedPassword, plainPassword);
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}