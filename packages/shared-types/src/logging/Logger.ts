/**
 * Structured logging utilities for SDD Bundle Editor.
 * Provides consistent log formatting across the application.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

export interface LoggerOptions {
    name: string;
    enabled?: boolean;
    minLevel?: LogLevel;
    pretty?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Create a structured logger instance.
 */
export function createLogger(options: LoggerOptions): Logger {
    return new Logger(options);
}

/**
 * Structured logger class.
 */
export class Logger {
    private readonly name: string;
    private readonly enabled: boolean;
    private readonly minLevel: number;
    private readonly pretty: boolean;

    constructor(options: LoggerOptions) {
        this.name = options.name;
        this.enabled = options.enabled ?? true;
        this.minLevel = LOG_LEVELS[options.minLevel ?? 'info'];
        this.pretty = options.pretty ?? (typeof process !== 'undefined' && process.env.NODE_ENV === 'development');
    }

    debug(message: string, context?: Record<string, unknown>): void {
        this.log('debug', message, context);
    }

    info(message: string, context?: Record<string, unknown>): void {
        this.log('info', message, context);
    }

    warn(message: string, context?: Record<string, unknown>): void {
        this.log('warn', message, context);
    }

    error(message: string, error?: Error, context?: Record<string, unknown>): void {
        this.log('error', message, context, error);
    }

    /**
     * Create a child logger with additional context.
     */
    child(name: string): Logger {
        return new Logger({
            name: `${this.name}:${name}`,
            enabled: this.enabled,
            minLevel: this.getMinLevelName(),
            pretty: this.pretty,
        });
    }

    private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
        if (!this.enabled || LOG_LEVELS[level] < this.minLevel) {
            return;
        }

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: `[${this.name}] ${message}`,
            ...(context && { context }),
            ...(error && {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                },
            }),
        };

        if (this.pretty) {
            this.logPretty(entry);
        } else {
            this.logJson(entry);
        }
    }

    private logPretty(entry: LogEntry): void {
        const levelColors: Record<LogLevel, string> = {
            debug: '\x1b[90m',   // Gray
            info: '\x1b[36m',    // Cyan
            warn: '\x1b[33m',    // Yellow
            error: '\x1b[31m',   // Red
        };
        const reset = '\x1b[0m';
        const color = levelColors[entry.level];

        const time = entry.timestamp.split('T')[1].split('.')[0];
        const prefix = `${color}[${time}] ${entry.level.toUpperCase().padEnd(5)}${reset}`;

        console.log(`${prefix} ${entry.message}`);

        if (entry.context) {
            console.log(`  Context: ${JSON.stringify(entry.context)}`);
        }

        if (entry.error) {
            console.log(`  Error: ${entry.error.name}: ${entry.error.message}`);
            if (entry.error.stack) {
                const stackLines = entry.error.stack.split('\n').slice(1, 4);
                stackLines.forEach(line => console.log(`    ${line.trim()}`));
            }
        }
    }

    private logJson(entry: LogEntry): void {
        const output = JSON.stringify(entry);

        if (entry.level === 'error' || entry.level === 'warn') {
            console.error(output);
        } else {
            console.log(output);
        }
    }

    private getMinLevelName(): LogLevel {
        const levels = Object.entries(LOG_LEVELS);
        const found = levels.find(([_, value]) => value === this.minLevel);
        return (found?.[0] as LogLevel) ?? 'info';
    }
}

// ============================================================================
// Default loggers
// ============================================================================

/**
 * Root application logger.
 */
export const rootLogger = createLogger({
    name: 'sdd',
    minLevel: (typeof process !== 'undefined' && process.env.LOG_LEVEL as LogLevel) || 'info',
});
