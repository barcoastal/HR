import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
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
        email: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await ensureAdminExists();

        const user = await db.user.findUnique({
          where: { email: credentials.email },
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
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const email = profile?.email;
      if (!email) return false;

      // Only allow @coastaldebt.com emails
      if (!email.endsWith("@coastaldebt.com")) {
        return "/login?error=domain";
      }

      // Ensure seeded admins exist before checking
      await ensureAdminExists();

      // Only allow pre-invited users (no auto-creation)
      const dbUser = await db.user.findUnique({
        where: { email },
        include: { employee: true },
      });

      if (!dbUser) {
        return "/login?error=not-invited";
      }

      // Auto-create employee profile if missing
      if (!dbUser.employeeId) {
        const googleName = (profile as { name?: string })?.name || email.split("@")[0];
        const nameParts = googleName.split(" ");
        const firstName = nameParts[0] || email.split("@")[0];
        const lastName = nameParts.slice(1).join(" ") || "";

        const employee = await db.employee.create({
          data: {
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

      // Persist Google OAuth tokens to RecruitmentPlatform for calendar access
      if (account?.provider === "google") {
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
