import cn from 'classnames';
import s from './IconButton.module.css';

const ICONS = {
  edit: (
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  ),
  loginAs: (
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
  ),
  statement: <path d="M7 2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V4a2 2 0 0 1 2-2zm1.5 6.75h7v-1.5h-7v1.5zm0 3.5h7v-1.5h-7v1.5zM11 17.5h2V19h-2v-1.5z" />,
  delete: (
    <path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2zM9.5 9.5v9m2.5-9v9m2.5-9v9" stroke="currentColor" strokeWidth="1.5" fill="none" />
  ),
} as const;

// Table-row action icon — every bema list screen's "Edit"/"Login as user"/"View Statement"
// icon-link column uses this (legacy: `<img src="../include/images/edit.png">` etc.). Inline
// SVG rather than vendoring the legacy PNGs, matching docs/decisions/0006's "own/modern
// replacements only" — no legacy asset dependency needed for something this simple.
export function IconButton({
  icon,
  title,
  disabled,
}: {
  icon: keyof typeof ICONS;
  title: string;
  disabled?: boolean;
}) {
  return (
    <span className={cn(s.button, { [s.disabled]: disabled })} title={title} aria-label={title}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        {ICONS[icon]}
      </svg>
    </span>
  );
}
