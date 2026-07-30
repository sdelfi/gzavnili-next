import cn from 'classnames';
import type { IconName } from './types';
import s from './Icon.module.css';

// Wraps the legacy sprite-icon system — see Icon.module.css's header comment. `inButton`
// reproduces legacy's `.btn i.icon` margin/line-height, for when this renders inside a
// `.btn`-styled button/link (see AGENTS.md's "Global CSS cleanup" rule for why this is a
// prop instead of a global descendant-selector rule reaching into a scoped module class).
export function Icon({
  name,
  inButton,
  className,
  ...props
}: { name: IconName; inButton?: boolean } & React.HTMLAttributes<HTMLElement>) {
  const key = name.replace('-', '') as keyof typeof s;
  return <i className={cn(s.icon, s[key], { [s.inButton]: inButton }, className)} {...props} />;
}
