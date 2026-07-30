import type { ReactNode } from 'react';
import cn from 'classnames';
import s from './Alert.module.css';

// Success/error banner — mirrors the legacy `Udf.displayErrors()` flash-message pattern
// (a one-shot server-rendered banner there; here just a plain presentational component,
// since the bema panel is CSR and owns its own request/response cycle per call).
export function Alert({ variant, children }: { variant: 'success' | 'error'; children: ReactNode }) {
  return <div className={cn(s.alert, s[variant])}>{children}</div>;
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <Alert variant="error">
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </Alert>
  );
}
