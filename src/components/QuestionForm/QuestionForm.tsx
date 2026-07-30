'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitQuestionForm } from '@/lib/actions/siteForms';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';

// Legacy `question_form.cfm`, embedded via the `{QUESTIONFORM}` CMS placeholder
// (`cargo.html`, `parcel-service.html`) — see PageContent.tsx and
// docs/decisions/0013-site-pages-cms.md.
export function QuestionForm({ locale }: { locale: string }) {
  const t = useTranslations('QuestionForm');
  const [state, formAction, pending] = useActionState(submitQuestionForm, undefined);
  const fieldErrors = state?.fieldErrors ?? {};

  const subjectOptions: SelectOption[] = t.raw('subjectOptions').map((value: string) => ({ value, label: value }));
  const [subject, setSubject] = useState(subjectOptions[0].value);

  if (state?.success) {
    return <h3>{t('thankYou')}</h3>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <div className="row">
        <div className="input-group col col-6 col-xs-12">
          {t('name')}
          <Input name="name" required error={fieldErrors.name?.[0]} />
        </div>
        <div className="input-group col col-6 col-xs-12">
          {t('email')}
          <Input type="email" name="email" required error={fieldErrors.email?.[0]} />
        </div>
      </div>

      <div className="input-group">
        {t('subject')}
        <Select instanceId="question-subject" name="subject" options={subjectOptions} value={subject} onChange={setSubject} />
      </div>

      <div className="input-group">
        {t('message')}
        <textarea name="message" rows={3} required />
        {fieldErrors.message?.[0] && <label className="error">{fieldErrors.message[0]}</label>}
      </div>

      <div className="btn-block ralign">
        <button type="submit" className="btn btn-blue" disabled={pending}>
          {pending ? '…' : t('send')}
        </button>
      </div>
    </form>
  );
}
