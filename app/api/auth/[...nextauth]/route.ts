import GoogleProvider from "next-auth/providers/google";
import NextAuth, {
  DefaultSession,
  NextAuthOptions,
  Session,
  User,
} from "next-auth";
import { JWT } from "next-auth/jwt";
import prisma from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: number;
  }
}

export const authentication: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    jwt: async ({ user, token }: { user?: User; token: JWT }) => {
      if (user) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });
          if (dbUser) {
            token.uid = dbUser.id;
          }
        } catch (error) {
          console.error("Error fetching user in JWT callback:", error);
        }
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async signIn({ user }: { user: User }) {
      if (!user?.email) return false;

      try {
        await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name },
          create: {
            email: user.email,
            name: user.name,
          },
        });
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    session: async ({ session, token }: { session: Session; token: JWT }) => {
      if (session.user) {
        session.user.id = token.uid;
      }
      return session;
    },
    async redirect() {
      return "/chat";
    },
  },
};

const handler = NextAuth(authentication);
export { handler as GET, handler as POST };
