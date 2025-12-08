import React, { useState, useEffect } from 'react';
import { ProposedChange } from '@sdd-bundle-editor/core-ai';

export interface DiffReviewModalProps {
    changes: ProposedChange[];
    onAcceptAll: () => void;
    onDeclineAll: () => void;
    onClose: () => void;
}

export function DiffReviewModal({
    changes,
    onAcceptAll,
    onDeclineAll,
    onClose
}: DiffReviewModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(new Set());
    const [declinedIndices, setDeclinedIndices] = useState<Set<number>>(new Set());

    const currentChange = changes[currentIndex];
    const hasMultiple = changes.length > 1;
    const isCurrentAccepted = acceptedIndices.has(currentIndex);
    const isCurrentDeclined = declinedIndices.has(currentIndex);

    const goToNext = () => {
        if (currentIndex < changes.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const goToPrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const acceptCurrent = () => {
        const newAccepted = new Set(acceptedIndices);
        newAccepted.add(currentIndex);
        setAcceptedIndices(newAccepted);

        // Remove from declined if it was there
        const newDeclined = new Set(declinedIndices);
        newDeclined.delete(currentIndex);
        setDeclinedIndices(newDeclined);

        // Auto-advance to next if available
        if (currentIndex < changes.length - 1) {
            setTimeout(() => goToNext(), 200);
        }
    };

    const declineCurrent = () => {
        const newDeclined = new Set(declinedIndices);
        newDeclined.add(currentIndex);
        setDeclinedIndices(newDeclined);

        // Remove from accepted if it was there
        const newAccepted = new Set(acceptedIndices);
        newAccepted.delete(currentIndex);
        setAcceptedIndices(newAccepted);

        // Auto-advance to next if available
        if (currentIndex < changes.length - 1) {
            setTimeout(() => goToNext(), 200);
        }
    };

    const handleApplySelected = () => {
        if (acceptedIndices.size === 0) {
            alert('Please accept at least one change');
            return;
        }

        // Apply selected changes (both creates and modifications are now supported)
        onAcceptAll();
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ESC to close
            if (e.key === 'Escape') {
                onClose();
            }
            // j or ArrowDown to go to next
            else if ((e.key === 'j' || e.key === 'ArrowDown') && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                goToNext();
            }
            // k or ArrowUp to go to previous
            else if ((e.key === 'k' || e.key === 'ArrowUp') && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                goToPrevious();
            }
            // a to accept current change
            else if (e.key === 'a' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                acceptCurrent();
            }
            // d to decline current change
            else if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                declineCurrent();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, acceptedIndices, declinedIndices]);

    if (!currentChange) return null;

    const originalStr = typeof currentChange.originalValue === 'string'
        ? currentChange.originalValue
        : JSON.stringify(currentChange.originalValue, null, 2);
    const newStr = typeof currentChange.newValue === 'string'
        ? currentChange.newValue
        : JSON.stringify(currentChange.newValue, null, 2);

    // Detect if this is an addition (no original)
    const isAddition = currentChange.originalValue === null || currentChange.originalValue === undefined;

    return (
        <div className="diff-modal-overlay" onClick={onClose}>
            <div className="diff-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="diff-modal-header">
                    <div className="diff-modal-title">
                        <h2>Review Changes</h2>
                        {hasMultiple && (
                            <span className="diff-modal-counter">
                                {currentIndex + 1} of {changes.length}
                            </span>
                        )}
                        {acceptedIndices.size > 0 && (
                            <span className="diff-modal-accepted-count">
                                ✓ {acceptedIndices.size} accepted
                            </span>
                        )}
                    </div>
                    <button
                        className="diff-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Change Info */}
                <div className="diff-modal-info">
                    <span className="diff-modal-entity-type">{currentChange.entityType}</span>
                    <span className="diff-modal-separator">•</span>
                    <span className="diff-modal-field-path">{currentChange.fieldPath}</span>
                    {isCurrentAccepted && (
                        <>
                            <span className="diff-modal-separator">•</span>
                            <span className="diff-modal-status-accepted">✓ Accepted</span>
                        </>
                    )}
                    {isCurrentDeclined && (
                        <>
                            <span className="diff-modal-separator">•</span>
                            <span className="diff-modal-status-declined">✗ Declined</span>
                        </>
                    )}
                </div>

                {/* Navigation */}
                {hasMultiple && (
                    <div className="diff-modal-nav">
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={goToPrevious}
                            disabled={currentIndex === 0}
                        >
                            ← Previous
                        </button>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={goToNext}
                            disabled={currentIndex === changes.length - 1}
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* Diff View - Smart Layout */}
                <div className={`diff-modal-body ${isAddition ? 'single-column' : ''}`}>
                    {!isAddition && (
                        <div className="diff-modal-column">
                            <div className="diff-modal-column-header diff-old-header">
                                <span className="diff-label">− Original</span>
                            </div>
                            <pre className="diff-modal-code diff-old-code">{originalStr ?? 'undefined'}</pre>
                        </div>
                    )}
                    <div className="diff-modal-column">
                        <div className="diff-modal-column-header diff-new-header">
                            <span className="diff-label">{isAddition ? '+ Adding' : '+ New'}</span>
                        </div>
                        <pre className="diff-modal-code diff-new-code">{newStr}</pre>
                    </div>
                </div>

                {/* Rationale */}
                {currentChange.rationale && (
                    <div className="diff-modal-rationale">
                        <strong>Rationale:</strong> {currentChange.rationale}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="diff-modal-footer">
                    <div className="diff-modal-shortcuts">
                        <kbd>ESC</kbd> Close
                        {hasMultiple && (
                            <>
                                <span className="diff-modal-separator">•</span>
                                <kbd>j</kbd>/<kbd>k</kbd> Navigate
                            </>
                        )}
                        <span className="diff-modal-separator">•</span>
                        <kbd>a</kbd> Accept This
                        <span className="diff-modal-separator">•</span>
                        <kbd>d</kbd> Decline This
                    </div>
                    <div className="diff-modal-actions">
                        <button
                            className="btn btn-secondary"
                            onClick={declineCurrent}
                            disabled={isCurrentDeclined}
                        >
                            {isCurrentDeclined ? '✗ Declined' : 'Decline This'}
                        </button>
                        <button
                            className="btn btn-success"
                            onClick={acceptCurrent}
                            disabled={isCurrentAccepted}
                        >
                            {isCurrentAccepted ? '✓ Accepted' : 'Accept This'}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleApplySelected}
                            disabled={acceptedIndices.size === 0}
                        >
                            Apply {acceptedIndices.size > 0 ? `${acceptedIndices.size} Change${acceptedIndices.size > 1 ? 's' : ''}` : 'Selected'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

