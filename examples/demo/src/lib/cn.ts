import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// The exact class-merge helper shadcn/ui ships as `cn`.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
