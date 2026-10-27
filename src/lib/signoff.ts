import "server-only";
import { emailList } from "@/lib/activity";

/**
 * Who may formally sign a module off: SIGNOFF_USERS, a comma-separated email list.
 * Unset means nobody can — sign-off is deliberate, so it is never granted by default.
 */
export const signOffUsers = () => emailList(process.env.SIGNOFF_USERS);

export const canSignOff = (email: string | null | undefined) =>
  Boolean(email) && signOffUsers().includes(email!.toLowerCase());
