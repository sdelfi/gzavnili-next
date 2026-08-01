import type { ReactNode } from 'react';
import cn from 'classnames';
import s from './Alert.module.css';

export function Alert({ variant, children }: { variant: 'success' | 'error' | 'warning'; children: ReactNode }) {
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
