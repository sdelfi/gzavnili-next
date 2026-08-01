import { forwardRef, type InputHTMLAttributes } from 'react';
import cn from 'classnames';
import s from './Input.module.css';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: string }>(
  function Input({ error, className, type = 'text', ...props }, ref) {
    return (
      <>
        <input ref={ref} type={type} className={cn(s.input, className)} {...props} />
        {error && <span className={s.error}>{error}</span>}
      </>
    );
  },
);
