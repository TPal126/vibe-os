/**
 * Approximate token count using chars / 3.5 heuristic.
 * Anthropic's guidance: 1 token ~= 3.5 English characters.
 * For code, this is within ~15% of actual tokenizer output.
 * Labeled as "~X tokens" in the UI to signal approximation.
 */
export function estimateTokens(text: string): number {
  return Math.round(text.length / 3.5);
}

/**
 * Format token count for display: "1.2k", "850", "12.4k"
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Token budget thresholds for the budget bar.
 * Soft limit: 20,000 tokens.
 */
export const TOKEN_BUDGET = {
  softLimit: 20_000,
  thresholds: {
    normal: 0.75, // accent blue: 0-75%
    warn: 0.9, // orange: 75-90%
    danger: 1.0, // red: 90%+
  },
} as const;

/**
 * Get the Tailwind bg class for the budget bar based on usage ratio.
 */
export function getBudgetColor(ratio: number): string {
  if (ratio > TOKEN_BUDGET.thresholds.warn) return "bg-v-red";
  if (ratio > TOKEN_BUDGET.thresholds.normal) return "bg-v-orange";
  return "bg-v-accent";
}

/**
 * Get the Tailwind text class for the budget bar label based on usage ratio.
 */
export function getBudgetTextColor(ratio: number): string {
  if (ratio > TOKEN_BUDGET.thresholds.warn) return "text-v-red";
  if (ratio > TOKEN_BUDGET.thresholds.normal) return "text-v-orange";
  return "text-v-accent";
}
