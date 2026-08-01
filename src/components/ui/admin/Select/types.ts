export type SelectOption<T extends string = string> = { value: T; label: string };
export type SelectOptionGroup<T extends string = string> = { label: string; options: SelectOption<T>[] };
