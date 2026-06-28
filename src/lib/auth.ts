import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    async sendResetPassword(data, request) {
      console.log("Mock sending reset password email to:", data.user.email);
      console.log("Reset link:", data.url);
    }
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
    },
    // LINE OAuth is not built-in by default in standard better-auth, 
    // but if it uses generic providers or is supported via plugin:
    // (We add it just in case, but actual implementation might need custom config)
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      isApproved: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "TEACHER",
      },
      position: {
        type: "string",
        required: false,
      },
      subjectGroup: {
        type: "string",
        required: false,
      },
      lineUserId: {
        type: "string",
        required: false,
      },
      username: {
        type: "string",
        required: false,
      },
      signatureUrl: {
        type: "string",
        required: false,
      },
      address: {
        type: "string",
        required: false,
      },
      phoneNumber: {
        type: "string",
        required: false,
      },
      level: {
        type: "string",
        required: false,
      },
    },
  },
});
