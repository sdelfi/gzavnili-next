// Shared low-level client for every /api/bema/* call — see AGENTS.md's "API calls go
// through a service layer" rule: components/pages never call `fetch()` directly, they
// import a typed function from `src/lib/api/*` (this file is the shared plumbing those
// modules build on, not something components import directly).
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(typeof (body as { error?: unknown } | null)?.error === 'string' ? (body as { error: string }).error : `Request failed (${status}).`);
  }
}

type ApiFetchInit = Omit<RequestInit, 'body'> & { json?: unknown };

async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...rest,
    ...(json !== undefined
      ? { headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(json) }
      : { headers }),
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);
export const apiPost = <T = void>(path: string, json?: unknown) => apiFetch<T>(path, { method: 'POST', json });
export const apiPatch = <T = void>(path: string, json: unknown) => apiFetch<T>(path, { method: 'PATCH', json });
export const apiDelete = <T = void>(path: string) => apiFetch<T>(path, { method: 'DELETE' });

/** For the rare `multipart/form-data` upload — a separate path from `apiFetch` so the
 *  browser sets its own `Content-Type` (with boundary) for the `FormData` body, rather than
 *  the JSON header `apiFetch` always attaches. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(path, { method: 'POST', credentials: 'same-origin', body: formData });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

// Every bema form's zod-validation-error response has the same `{ error: { formErrors,
// fieldErrors } }` shape (see any `/api/bema/*` route's `parsed.error.flatten()`) — shared
// so `UserForm`/`PageForm`/etc. don't each reimplement this flattening. Never expose an
// unknown schema path as a fallback label: dotted implementation keys such as
// `draftParcels.0.receiver.postalCode` are not useful to an operator, while the validation
// message itself already names the field.
export function extractErrorMessages(body: unknown, fieldLabels: Record<string, string> = {}): string[] {
  const b = body as { error?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> } | string } | null;
  const errorField = b?.error;
  if (typeof errorField === 'string') return [errorField];

  const formErrors = errorField?.formErrors ?? [];
  const fieldErrors = errorField?.fieldErrors
    ? Object.entries(errorField.fieldErrors).flatMap(([field, messages]) =>
        messages.map((message) => (fieldLabels[field] ? `${fieldLabels[field]}: ${message}` : message)),
      )
    : [];
  const combined = [...formErrors, ...fieldErrors];
  return combined.length ? combined : ['Save failed.'];
}
