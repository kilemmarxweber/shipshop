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
