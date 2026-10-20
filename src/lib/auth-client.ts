"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { orgAccessControl, orgRoles } from "@/lib/org-access";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac: orgAccessControl,
      roles: orgRoles,
    }),
  ],
});

type SignUpEmail = Parameters<typeof authClient.signUp.email>[0];

export function signUpEmailWithPhone(input: {
  name: string;
  email: string;
  password: string;
  phone: string;
}) {
  return authClient.signUp.email(input as SignUpEmail);
}
