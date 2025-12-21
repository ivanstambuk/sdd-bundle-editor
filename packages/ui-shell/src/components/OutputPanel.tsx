import { useEffect, useRef } from 'react';
import styles from './OutputPanel.module.css';

export interface OutputEntry {
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
    source?: string;
}

interface OutputPanelProps {
    entries: OutputEntry[];
    maxEntries?: number;
}

const levelStyles = {
    info: styles.entryInfo,
    warn: styles.entryWarn,
    error: styles.entryError,
    success: styles.entrySuccess,
};

export function OutputPanel({ entries, maxEntries = 500 }: OutputPanelProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new entries arrive
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [entries.length]);

    const displayEntries = entries.slice(-maxEntries);

    if (displayEntries.length === 0) {
        return (
            <div className={styles.panel}>
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}>📋</span>
                    <span>No output yet. Activity will appear here.</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            <div className={styles.list}>
                {displayEntries.map((entry, idx) => (
                    <div
                        key={`${entry.timestamp.getTime()}-${idx}`}
                        className={`${styles.entry} ${levelStyles[entry.level]}`}
                    >
                        <span className={styles.timestamp}>
                            [{formatTime(entry.timestamp)}]
                        </span>
                        {entry.source && (
                            <span className={styles.source}>[{entry.source}]</span>
                        )}
                        <span className={styles.message}>{entry.message}</span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}


// Hook to manage output entries
import { useState, useCallback } from 'react';

export function useOutputLog(maxEntries = 500) {
    const [entries, setEntries] = useState<OutputEntry[]>([]);

    const log = useCallback((level: OutputEntry['level'], message: string, source?: string) => {
        setEntries(prev => {
            const newEntry: OutputEntry = {
                timestamp: new Date(),
                level,
                message,
                source,
            };
            const updated = [...prev, newEntry];
            return updated.slice(-maxEntries);
        });
    }, [maxEntries]);

    const info = useCallback((message: string, source?: string) => log('info', message, source), [log]);
    const warn = useCallback((message: string, source?: string) => log('warn', message, source), [log]);
    const error = useCallback((message: string, source?: string) => log('error', message, source), [log]);
    const success = useCallback((message: string, source?: string) => log('success', message, source), [log]);

    const clear = useCallback(() => setEntries([]), []);

    return { entries, log, info, warn, error, success, clear };
}
