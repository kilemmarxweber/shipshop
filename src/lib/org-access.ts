import type { AccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/** Owner et admin : toutes les options plateforme. Seul l'owner peut supprimer l'org. */
export const PLATFORM_ROLES = ["owner", "admin"] as const;

export function isPlatformRole(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

/** Vendeur : peut inviter d'autres vendeurs (role forcé à member côté serveur). */
export const sellerMemberAc = defaultAc.newRole({
  organization: [],
  member: [],
  invitation: ["create"],
  team: [],
  ac: ["read"],
});

export const orgAccessControl = defaultAc as unknown as AccessControl;

export const orgRoles = {
  owner: ownerAc,
  admin: adminAc,
  member: sellerMemberAc,
};
