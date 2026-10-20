"use client";

import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { orgAccessControl, orgRoles } from "@/lib/org-access";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        phone: {
          type: "string",
          required: false,
        },
      },
    }),
    organizationClient({
      ac: orgAccessControl,
      roles: orgRoles,
    }),
  ],
});
