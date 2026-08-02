// Shared "unique dublicate messages" loop, appearing near-verbatim in `cron/sendMessages.cfm`,
// `cron/sendOnholdSMS.cfm`, and `cron/sendCustomerSMS.cfm`: group a run's accumulated
// phone/message pairs by *exact-matching* text, comma-joining every phone that shares one, so
// one gateway call is made per unique message instead of one per recipient. See
// docs/decisions/0027-cron-notifications.md.
export function dedupeSmsBatch(entries: { phone: string; text: string }[]): { phones: string; text: string }[] {
  const groups: { phones: string; text: string }[] = [];
  for (const entry of entries) {
    const existing = groups.find((g) => g.text === entry.text);
    if (existing) {
      existing.phones = `${existing.phones},${entry.phone}`;
    } else {
      groups.push({ text: entry.text, phones: entry.phone });
    }
  }
  return groups;
}
