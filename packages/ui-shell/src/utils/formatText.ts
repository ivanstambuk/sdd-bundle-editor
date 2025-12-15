/**
 * Utility functions for formatting text in the UI.
 */

/**
 * Known acronyms that should stay uppercase when formatting.
 * Add new acronyms here as needed.
 */
const KNOWN_ACRONYMS = new Set([
    'API', 'HTTP', 'HTTPS', 'URL', 'URI', 'ID', 'UUID', 'JSON', 'YAML',
    'XML', 'HTML', 'CSS', 'SQL', 'REST', 'GRPC', 'TCP', 'UDP', 'IP',
    'DNS', 'SSL', 'TLS', 'JWT', 'OAuth', 'SAML', 'LDAP', 'SMTP', 'IMAP',
    'SDD', 'MCP', 'ADR', 'AWS', 'GCP', 'CLI', 'SDK', 'OTel', 'OTEL',
]);

/**
 * Convert PascalCase or camelCase string to human-readable title case.
 * 
 * Examples:
 *   - "OpenQuestion" → "Open Question"
 *   - "TelemetrySchema" → "Telemetry Schema"
 *   - "HealthCheckSpec" → "Health Check Spec"
 *   - "APIEndpoint" → "API Endpoint"
 *   - "userID" → "User ID"
 * 
 * @param input - The PascalCase or camelCase string to format
 * @returns Human-readable title case string
 */
export function formatEntityType(input: string): string {
    if (!input) return '';

    // Split on capital letters, keeping the delimiter
    // This regex matches:
    // - Before uppercase letters that follow lowercase letters (camelCase boundary)
    // - Before uppercase letters followed by lowercase (end of acronym)
    const words = input
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase boundary
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')  // Acronym followed by word
        .split(' ');

    return words
        .map(word => {
            // Check if it's a known acronym (case-insensitive match)
            const upperWord = word.toUpperCase();
            if (KNOWN_ACRONYMS.has(upperWord)) {
                return upperWord;
            }
            // Otherwise, capitalize first letter only
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

/**
 * Pluralize an entity type name.
 * Simple English pluralization rules.
 * 
 * @param singular - The singular form
 * @returns The plural form
 */
export function pluralizeEntityType(singular: string): string {
    if (!singular) return '';

    // Common irregular plurals
    const irregulars: Record<string, string> = {
        'Schema': 'Schemas',
        'Spec': 'Specs',
        'Policy': 'Policies',
        'Category': 'Categories',
    };

    for (const [sing, plural] of Object.entries(irregulars)) {
        if (singular.endsWith(sing)) {
            return singular.slice(0, -sing.length) + plural;
        }
    }

    // Standard rules
    if (singular.endsWith('s') || singular.endsWith('x') || singular.endsWith('ch') || singular.endsWith('sh')) {
        return singular + 'es';
    }
    if (singular.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(singular.charAt(singular.length - 2))) {
        return singular.slice(0, -1) + 'ies';
    }
    return singular + 's';
}
