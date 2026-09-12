import { pool } from "@/db/client";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  createdAt: string;
  lastSeen: string | null;
  copies: number;
  /** AI identifications in the last 24 hours, the window of the daily limit (D31). */
  aiToday: number;
  aiCost30d: number;
};

/** Every account, with its copies and what its AI identifications cost (D34). */
export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const { rows } = await pool.query<AdminUserRow>(`
    select u.id, u.name, u.email, u.role, u.banned, u.created_at::text as "createdAt",
           (select max(s.updated_at)::text from session s where s.user_id = u.id) as "lastSeen",
           (select coalesce(sum(i.quantity), 0)::int from items i where i.owner_id = u.id) as copies,
           (select count(*)::int from ai_identifications a
            where a.owner_id = u.id and a.created_at > now() - interval '1 day') as "aiToday",
           (select coalesce(sum(a.cost_usd), 0)::float8 from ai_identifications a
            where a.owner_id = u.id and a.created_at > now() - interval '30 days') as "aiCost30d"
    from "user" u
    order by u.created_at`);
  return rows;
}
