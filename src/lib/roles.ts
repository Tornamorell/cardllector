// Roles (D34), kept by Better Auth's admin plugin in user.role: "admin" manages accounts and
// moderates shared photos; everyone else is "user". Pure, for pages, actions and components.

export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = { user: "Usuario", admin: "Administrador" };

/** Whether a user is an admin. The plugin allows several roles, comma-separated. */
export function isAdmin(user: { role?: string | null } | null | undefined) {
  return !!user?.role
    ?.split(",")
    .map((r) => r.trim())
    .includes("admin");
}
