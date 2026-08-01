import type { ReactNode } from 'react';

export type TabOption<T extends string> = { value: T; label: ReactNode };
