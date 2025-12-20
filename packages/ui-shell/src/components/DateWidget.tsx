import React from 'react';

interface DateWidgetProps {
    id: string;
    value: string | undefined;
    onChange: (value: string | undefined) => void;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    schema?: { format?: string };
}

/**
 * Custom date widget for RJSF forms.
 * 
 * In read-only mode: shows formatted date (with time if available) or "—" for empty values
 * In edit mode: shows native date or datetime-local input
 */
export function DateWidget(props: DateWidgetProps) {
    const { id, value, onChange, disabled, readonly, schema } = props;

    const isReadOnly = disabled || readonly;
    const isDateTime = schema?.format === 'date-time';

    // In read-only mode, show formatted date or em-dash for empty
    if (isReadOnly) {
        if (!value) {
            return (
                <span className="date-widget date-widget--empty">—</span>
            );
        }

        // Format the date nicely
        try {
            const date = new Date(value);

            // Check if time is meaningful (not midnight UTC which indicates date-only)
            const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;

            if (hasTime || isDateTime) {
                // Show date with time
                const formatted = date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                });
                return (
                    <span className="date-widget date-widget--readonly">{formatted}</span>
                );
            } else {
                // Show date only
                const formatted = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                });
                return (
                    <span className="date-widget date-widget--readonly">{formatted}</span>
                );
            }
        } catch {
            // If date parsing fails, show raw value
            return (
                <span className="date-widget date-widget--readonly">{value}</span>
            );
        }
    }

    // Edit mode: native date or datetime input
    const inputType = isDateTime ? 'datetime-local' : 'date';

    return (
        <input
            type={inputType}
            id={id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="date-widget date-widget--editable"
        />
    );
}
