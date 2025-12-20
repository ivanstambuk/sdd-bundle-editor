/**
 * Date formatting utilities for consistent date display across the UI.
 */

/**
 * Format an ISO date string to a human-readable format.
 * Returns a localized string like "Jan 15, 2024".
 * 
 * @param isoDate - ISO 8601 date string (e.g., "2024-01-15" or "2024-01-15T10:00:00Z")
 * @returns Formatted date string, or "—" if undefined/invalid
 * 
 * @example
 * formatDate("2024-01-15") // "Jan 15, 2024"
 * formatDate("2024-12-20T14:30:00Z") // "Dec 20, 2024"
 * formatDate(undefined) // "—"
 */
export function formatDate(isoDate: string | undefined): string {
    if (!isoDate) return '—';
    try {
        return new Date(isoDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return isoDate;
    }
}
