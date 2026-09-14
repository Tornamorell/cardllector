// What the assistant (D37) costs: tokens → dollars, and each user's monthly allowance. Pure.

export const ASSISTANT_MODEL = "claude-sonnet-5";

/**
 * Its price in $ per million tokens (platform.claude.com/docs/en/about-claude/pricing,
 * 2026-09-14): input, output, and the prompt cache — writes (5 minutes) at 1,25× the input
 * price, reads at 0,1×.
 */
export const ASSISTANT_PRICE = { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 };

/** Each user's allowance per calendar month, in $ (~5 €). AI_ASSISTANT_MONTHLY_USD overrides it. */
export const MONTHLY_LIMIT_USD = 5;

export type ChatUsage = { input: number; output: number; cacheWrite: number; cacheRead: number };

export const NO_USAGE: ChatUsage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

/** Adds one API response's usage (its `usage` field) to a running total. */
export function addUsage(
  total: ChatUsage,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  },
): ChatUsage {
  return {
    input: total.input + usage.input_tokens,
    output: total.output + usage.output_tokens,
    cacheWrite: total.cacheWrite + (usage.cache_creation_input_tokens ?? 0),
    cacheRead: total.cacheRead + (usage.cache_read_input_tokens ?? 0),
  };
}

export function chatCostUsd(u: ChatUsage): number {
  const p = ASSISTANT_PRICE;
  return (u.input * p.input + u.output * p.output + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead) / 1e6;
}
