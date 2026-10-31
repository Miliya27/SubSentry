/**
 * src/utils/cn.ts
 * Utility to merge Tailwind class names (lightweight clsx alternative).
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
