import { describe, expect, it } from "vitest";
import { isAdmin } from "./roles";

describe("isAdmin", () => {
  it("is true for admins, also among several roles", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
    expect(isAdmin({ role: "user, admin" })).toBe(true);
  });

  it("is false for users, accounts without a role and no one", () => {
    expect(isAdmin({ role: "user" })).toBe(false);
    expect(isAdmin({ role: null })).toBe(false);
    expect(isAdmin({})).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("doesn't take a role that merely contains the word", () => {
    expect(isAdmin({ role: "notadmin" })).toBe(false);
  });
});
