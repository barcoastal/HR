import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

async function ensureAdminExists() {
  // Ensure Google OAuth super admin exists
  await db.user.upsert({
    where: { email: "bar@coastaldebt.com" },
    update: { role: "SUPER_ADMIN" },
    create: { email: "bar@coastaldebt.com", role: "SUPER_ADMIN" },
  });
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        // Find user by username (stored in email field for credential users)
        const user = await db.user.findFirst({
          where: { email: credentials.username },
          include: { employee: true },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.employee
            ? `${user.employee.firstName} ${user.employee.lastName}`
            : user.email,
          role: user.role,
          employeeId: user.employeeId,
          profilePhoto: user.employee?.profilePhoto || null,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.events",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Allow credentials login (already validated in authorize)
        if (account?.provider === "credentials") return true;

        const email = profile?.email;
        if (!email) return false;

        // Only allow @coastaldebt.com emails
        if (!email.endsWith("@coastaldebt.com")) {
          return "/login?error=domain";
        }

        // Ensure seeded admins exist before checking
        await ensureAdminExists();

        // Only allow pre-invited users (no auto-creation)
        // Case-insensitive lookup since Google may return different casing
        const emailLower = email.toLowerCase();
        let dbUser = await db.user.findUnique({
          where: { email: emailLower },
          include: { employee: true },
        });
        // Fallback: try original casing
        if (!dbUser) {
          dbUser = await db.user.findUnique({
            where: { email },
            include: { employee: true },
          });
        }
        // Fallback: try finding by employee email
        if (!dbUser) {
          const emp = await db.employee.findFirst({
            where: { email: { equals: emailLower, mode: "insensitive" } },
          });
          if (emp) {
            dbUser = await db.user.findFirst({
              where: { employeeId: emp.id },
              include: { employee: true },
            });
          }
        }

        if (!dbUser) {
          return "/login?error=not-invited";
        }

        // Auto-link or create the employee profile if the User row has none.
        // Use upsert so a pre-existing Employee with the same email is reused
        // instead of triggering a unique-constraint failure.
        if (!dbUser.employeeId) {
          const profileName = (profile as { name?: string })?.name || email.split("@")[0];
          const nameParts = profileName.split(" ");
          const firstName = nameParts[0] || email.split("@")[0];
          const lastName = nameParts.slice(1).join(" ") || "";

          const employee = await db.employee.upsert({
            where: { email },
            update: {},
            create: {
              firstName,
              lastName,
              email,
              jobTitle: "",
              startDate: new Date(),
              status: "ACTIVE",
            },
          });

          await db.user.update({
            where: { id: dbUser.id },
            data: { employeeId: employee.id },
          });

          dbUser.employeeId = employee.id;
          dbUser.employee = employee;
        }

        // Populate the user object so the jwt callback can read it
        user.id = dbUser.id;
        user.role = dbUser.role;
        user.employeeId = dbUser.employeeId;
        user.profilePhoto = dbUser.employee?.profilePhoto || null;
        user.name = dbUser.employee
          ? `${dbUser.employee.firstName} ${dbUser.employee.lastName}`
          : dbUser.email;

        return true;
      } catch (err) {
        console.error("[auth] signIn callback failed:", err);
        return "/login?error=signin-failed";
      }
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.profilePhoto = user.profilePhoto;
      }

      // Refresh profile photo from DB on each token refresh
      if (token.employeeId) {
        const emp = await db.employee.findUnique({
          where: { id: token.employeeId as string },
          select: { profilePhoto: true },
        });
        token.profilePhoto = emp?.profilePhoto || null;
      }

      // Persist Google OAuth tokens to RecruitmentPlatform for calendar access.
      // Fail-soft: never block sign-in if the token write fails.
      if (account?.provider === "google") {
        try {
          await db.recruitmentPlatform.upsert({
            where: { name: "Google Calendar" },
            update: {
              apiKey: account.access_token,
              refreshToken: account.refresh_token ?? undefined,
              tokenExpiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              oauthProvider: "google_calendar",
              status: "ACTIVE",
            },
            create: {
              name: "Google Calendar",
              type: "PREMIUM",
              apiKey: account.access_token,
              refreshToken: account.refresh_token,
              tokenExpiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              oauthProvider: "google_calendar",
              status: "ACTIVE",
            },
          });
        } catch (err) {
          console.error("[auth] Failed to persist Google Calendar tokens:", err);
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.employeeId = token.employeeId;
      session.user.profilePhoto = token.profilePhoto;
      return session;
    },
  },
};
