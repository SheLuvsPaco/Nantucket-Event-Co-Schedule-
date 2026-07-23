import { roles, type Role } from "@/db/schema";

export const crewRoles = ["STAFF", "LEAD"] as const satisfies readonly Role[];
export type CrewRole = (typeof crewRoles)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    (roles as readonly string[]).includes(value)
  );
}

export function isCrewRole(role: Role): role is CrewRole {
  return (crewRoles as readonly Role[]).includes(role);
}

export function roleLabel(role: Role) {
  return role === "LEAD"
    ? "Lead"
    : role.charAt(0) + role.slice(1).toLowerCase();
}
