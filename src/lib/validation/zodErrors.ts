import type { z } from 'zod';

// `ZodError.flatten()` only flattens one level: an issue at `receiver.city` comes back under
// the key `receiver`, so a form with nested sections can't tell which field to mark. This
// keys every issue by its full dotted path instead, which is what the components look
// themselves up by — and keeps the same `{ formErrors, fieldErrors }` envelope every other
// /api/bema/* route returns, so `extractErrorMessages()` still understands it.
export function flattenIssues(error: z.ZodError): {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
} {
  const formErrors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.');
    if (!key) formErrors.push(issue.message);
    else (fieldErrors[key] ??= []).push(issue.message);
  }

  return { formErrors, fieldErrors };
}
