import React from 'react';

interface ReadOnlyToggleProps {
    isReadOnly: boolean;
    onToggle: (value: boolean) => void;
}

export function ReadOnlyToggle({ isReadOnly, onToggle }: ReadOnlyToggleProps) {
    return (
        <div className="read-only-toggle" title="Toggle between Edit and Read-Only modes">
            <label className="toggle-switch">
                <input
                    type="checkbox"
                    checked={isReadOnly}
                    onChange={(e) => onToggle(e.target.checked)}
                />
                <span className="slider round"></span>
            </label>
            <span className="toggle-label">{isReadOnly ? 'Read-Only' : 'Edit Mode'}</span>
        </div>
    );
}
