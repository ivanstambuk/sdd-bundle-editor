import React from 'react';

interface DateWidgetProps {
    id: string;
    value: string | undefined;
    onChange: (value: string | undefined) => void;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
}

/**
 * Custom date widget for RJSF forms.
 * 
 * In read-only mode: shows formatted date or "—" for empty values
 * In edit mode: shows native date input
 */
export function DateWidget(props: DateWidgetProps) {
    const { id, value, onChange, disabled, readonly } = props;

    const isReadOnly = disabled || readonly;

    // In read-only mode, show formatted date or em-dash for empty
    if (isReadOnly) {
        if (!value) {
            return (
                <span className="date-widget date-widget--empty">—</span>
            );
        }

        // Format the date nicely (e.g., "Dec 20, 2024")
        try {
            const date = new Date(value);
            const formatted = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
            return (
                <span className="date-widget date-widget--readonly">{formatted}</span>
            );
        } catch {
            // If date parsing fails, show raw value
            return (
                <span className="date-widget date-widget--readonly">{value}</span>
            );
        }
    }

    // Edit mode: native date input
    return (
        <input
            type="date"
            id={id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="date-widget date-widget--editable"
        />
    );
}
