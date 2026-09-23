import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { isAllowedEmail } from "@/lib/allowlist";

// drive.file only reaches files this app created or that a user opened with it,
// not the rest of anyone's Drive.
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: `openid email profile ${DRIVE_SCOPE}`,
          // offline + consent so Google returns a refresh token for server-side Drive calls
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    signIn({ profile }) {
      return Boolean(profile?.email_verified) && isAllowedEmail(profile?.email);
    },
    async jwt({ token, account, profile }) {
      // `account` is only present on the sign-in request itself.
      if (account && profile?.email) {
        const email = profile.email.toLowerCase();
        const tokens = {
          googleAccessToken: account.access_token ?? null,
          googleTokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
          // Google omits the refresh token on some re-consents; keep the stored one then.
          ...(account.refresh_token ? { googleRefreshToken: account.refresh_token } : {}),
        };
        const user = await prisma.user.upsert({
          where: { email },
          create: { email, name: profile.name ?? null, image: profile.picture ?? null, ...tokens },
          update: { name: profile.name ?? null, image: profile.picture ?? null, ...tokens },
          select: { id: true },
        });
        token.uid = user.id;
        token.driveGranted = account.scope?.split(" ").includes(DRIVE_SCOPE) ?? false;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.driveGranted = Boolean(token.driveGranted);
      return session;
    },
  },
});
