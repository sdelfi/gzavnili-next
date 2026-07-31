import type { TextareaHTMLAttributes } from 'react';
import cn from 'classnames';
import s from './Textarea.module.css';

// Shared multi-line field. Promoted to `ui/` per AGENTS.md's "if a pattern shows up in a
// second place" rule — `SiteSettingsForm`, `PageForm`, `QuoteForm` and `QuestionForm` had
// each hand-rolled their own `<textarea>` before the parcel form needed a fifth.
//
// Same `error` convention as `ui/Input`: a jquery.validate-style `<label class="error">`
// after the field rather than a native validation bubble.
export function Textarea({
  error,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <>
      <textarea className={cn(s.textarea, className)} {...props} />
      {error && <label className="error">{error}</label>}
    </>
  );
}
