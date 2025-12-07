/**
 * Lightweight logger for development with configurable log levels
 * 
 * Features:
 * - Log levels: debug, info, warn, error
 * - Namespace/component filtering
 * - Only logs in development mode by default
 * - Can be toggled at runtime via localStorage
 * - Uses native console methods (DevTools filtering works)
 * 
 * Usage:
 *   const log = createLogger('AppShell');
 *   log.debug('Bundle loaded:', bundle);
 *   log.info('User action:', action);
 *   log.warn('Unusual state:', state);
 *   log.error('Critical issue:', error);
 * 
 * Runtime control (in browser console):
 *   localStorage.setItem('sdd:logLevel', 'debug');  // Show all logs
 *   localStorage.setItem('sdd:logLevel', 'info');   // Hide debug logs
 *   localStorage.setItem('sdd:logLevel', 'warn');   // Only warnings/errors
 *   localStorage.setItem('sdd:logLevel', 'error');  // Only errors
 *   localStorage.setItem('sdd:logLevel', 'off');    // Disable all logs
 *   
 *   localStorage.setItem('sdd:logFilter', 'AppShell'); // Only AppShell logs
 *   localStorage.removeItem('sdd:logFilter');          // Clear filter
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';

interface LoggerConfig {
    level: LogLevel;
    filter?: string;
    enabled: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    off: 4,
};

function getConfig(): LoggerConfig {
    // Only enable in development by default
    const isDev = process.env.NODE_ENV !== 'production';

    if (typeof window === 'undefined') {
        return { level: 'info', enabled: isDev };
    }

    try {
        const storedLevel = localStorage.getItem('sdd:logLevel') as LogLevel | null;
        const storedFilter = localStorage.getItem('sdd:logFilter') || undefined;

        return {
            level: storedLevel || 'info',
            filter: storedFilter,
            enabled: storedLevel !== 'off' && isDev,
        };
    } catch {
        return { level: 'info', enabled: isDev };
    }
}

function shouldLog(namespace: string, level: LogLevel): boolean {
    const config = getConfig();

    if (!config.enabled) return false;
    if (config.level === 'off') return false;

    // Check level threshold
    if (LOG_LEVELS[level] < LOG_LEVELS[config.level]) return false;

    // Check namespace filter
    if (config.filter && !namespace.includes(config.filter)) return false;

    return true;
}

function formatMessage(namespace: string, level: LogLevel, ...args: any[]): any[] {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1); // HH:MM:SS.mmm
    const levelIcon = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        off: '',
    }[level];

    return [`[${timestamp}]`, levelIcon, `[${namespace}]`, ...args];
}

export interface Logger {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    namespace: string;
}

/**
 * Create a logger for a specific namespace/component
 */
export function createLogger(namespace: string): Logger {
    return {
        namespace,

        debug: (...args: any[]) => {
            if (shouldLog(namespace, 'debug')) {
                console.debug(...formatMessage(namespace, 'debug', ...args));
            }
        },

        info: (...args: any[]) => {
            if (shouldLog(namespace, 'info')) {
                console.info(...formatMessage(namespace, 'info', ...args));
            }
        },

        warn: (...args: any[]) => {
            if (shouldLog(namespace, 'warn')) {
                console.warn(...formatMessage(namespace, 'warn', ...args));
            }
        },

        error: (...args: any[]) => {
            if (shouldLog(namespace, 'error')) {
                console.error(...formatMessage(namespace, 'error', ...args));
            }
        },
    };
}

/**
 * Quick logger for one-off logging without creating a named logger
 */
export const log = createLogger('app');

/**
 * Print current logger configuration to console
 */
export function printLoggerConfig(): void {
    const config = getConfig();
    console.group('📋 Logger Configuration');
    console.log('Enabled:', config.enabled);
    console.log('Level:', config.level);
    console.log('Filter:', config.filter || 'none');
    console.groupEnd();

    console.group('💡 How to configure:');
    console.log('Set level:  localStorage.setItem("sdd:logLevel", "debug")');
    console.log('Set filter: localStorage.setItem("sdd:logFilter", "AppShell")');
    console.log('Disable:    localStorage.setItem("sdd:logLevel", "off")');
    console.log('Reset:      localStorage.removeItem("sdd:logLevel")');
    console.groupEnd();
}

// Make configuration helper available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    (window as any).loggerConfig = printLoggerConfig;
}
