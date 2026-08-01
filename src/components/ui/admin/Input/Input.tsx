import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import cn from 'classnames';
import s from './Input.module.css';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { error?: string; prefix?: ReactNode }
>(function Input({ error, prefix, className, type = 'text', ...props }, ref) {
  const input = <input ref={ref} type={type} className={cn(s.input, className)} {...props} />;

  return (
    <>
      {prefix == null ? (
        input
      ) : (
        <div className={s.inputGroup}>
          <span className={s.prefix}>{prefix}</span>
          {input}
        </div>
      )}
      {error && <span className={s.error}>{error}</span>}
    </>
  );
});
