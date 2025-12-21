/**
 * EmptyState - Reusable empty/placeholder state component.
 * 
 * Used when there's no data to display (e.g., no relationships, no entity selected).
 * Provides consistent styling across the application.
 */

import styles from './EmptyState.module.css';

interface EmptyStateProps {
    /** Icon to display (emoji or react node) */
    icon: React.ReactNode;
    /** Main message */
    message: string;
    /** Optional secondary hint text */
    hint?: string;
    /** Optional CSS class for container */
    className?: string;
}

export function EmptyState({ icon, message, hint, className = '' }: EmptyStateProps) {
    return (
        <div className={`${styles.container} ${className}`}>
            <div className={styles.icon}>{icon}</div>
            <div className={styles.message}>{message}</div>
            {hint && <div className={styles.hint}>{hint}</div>}
        </div>
    );
}

