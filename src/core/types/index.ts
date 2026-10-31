export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type AsyncFunction<T = void> = (...args: unknown[]) => Promise<T>;

import './express.d';
