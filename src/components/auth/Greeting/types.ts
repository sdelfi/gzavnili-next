export type GreetingKey = 'night' | 'morning' | 'afternoon' | 'evening';

export type GreetingCopy = Record<GreetingKey, { heading: string; text: string }>;
