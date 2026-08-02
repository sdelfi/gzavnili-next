// Legacy `Replace(template, "{token}", value, 'all')` — a literal, global (not regex)
// string replacement per token. See docs/decisions/0027-cron-notifications.md.
export function substituteTokens(template: string, tokens: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}
