export const USER_THEME_VALUES = ["light", "dark"] as const;

export type UserTheme = (typeof USER_THEME_VALUES)[number];

export function isUserTheme(value: unknown): value is UserTheme {
  return (
    typeof value === "string" &&
    (USER_THEME_VALUES as readonly string[]).includes(value)
  );
}
