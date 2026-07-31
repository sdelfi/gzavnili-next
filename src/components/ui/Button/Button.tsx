import type { ButtonHTMLAttributes } from 'react';
import cn from 'classnames';
import s from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning';

// Shared button — see AGENTS.md's "shared components" rule. Self-contained (CSS Modules),
// not dependent on public/css/style.css globals, since the bema admin panel (the first
// consumer of `variant="danger"`) doesn't load that stylesheet.
export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={cn(s.button, s[variant], className)} {...props} />;
}
