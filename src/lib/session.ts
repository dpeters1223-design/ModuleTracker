import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/allowlist";

/**
 * For Server Actions: returns the signed-in, allowlisted user or throws.
 * Actions are reachable by direct POST, so every one must call this.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id || !isAllowedEmail(session.user.email)) {
    throw new Error("Not signed in.");
  }
  return { id: session.user.id, email: session.user.email!, driveGranted: session.driveGranted };
}
