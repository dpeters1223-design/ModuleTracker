import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    /** Whether the user granted the Drive permission at sign-in */
    driveGranted: boolean;
  }
}
