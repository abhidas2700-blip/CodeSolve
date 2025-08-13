import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine multiple class names with Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date to a string
 */
export function formatDate(date: Date | number): string {
  if (typeof date === 'number') {
    date = new Date(date);
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format a percentage from a decimal
 */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generates a unique audit ID with format AUD-XXXXXXXX where X is a digit
 * @returns A unique audit ID string
 */
export function generateAuditId(): string {
  // Get current timestamp to ensure uniqueness
  const timestamp = Date.now();
  
  // Generate a random 8-digit number (padded with leading zeros if needed)
  const randomPart = Math.floor(Math.random() * 100000000)
    .toString()
    .padStart(8, '0');
  
  // Combine timestamp and random number, then take last 8 digits to ensure uniqueness
  const uniqueNumber = (timestamp + parseInt(randomPart))
    .toString()
    .slice(-8)
    .padStart(8, '0');
  
  return `AUD-${uniqueNumber}`;
}

/**
 * Converts any existing audit ID to the professional AUD-XXXXXXXX format
 * @param existingId The existing ID to convert
 * @returns A new professional format audit ID
 */
export function convertToAuditIdFormat(existingId: string | number): string {
  // If it's already in the AUD- format, return it as is
  if (typeof existingId === 'string' && existingId.startsWith('AUD-')) {
    return existingId;
  }
  
  // Special handling for legacy "open-sample-" prefixed IDs to maintain consistency
  if (typeof existingId === 'string' && existingId.startsWith('open-sample-')) {
    console.log(`Converting legacy open sample ID ${existingId} to professional format`);
  }
  
  // Generate a new professional format ID
  return generateAuditId();
}
