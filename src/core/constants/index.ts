export const APP_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_PAGE_LIMIT: 100,
  DEFAULT_SORT_ORDER: 'desc',
} as const;

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
