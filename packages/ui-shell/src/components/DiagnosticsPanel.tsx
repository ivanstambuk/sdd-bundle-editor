import { useState } from 'react';
import type { UiDiagnostic } from '../types';
import { getEntityDisplayName, getEntityDisplayNamePlural } from '../utils/schemaMetadata';
import styles from './DiagnosticsPanel.module.css';

interface DiagnosticsPanelProps {
  diagnostics: UiDiagnostic[];
  entityTypes: string[];
  schemas?: Record<string, unknown>;
  onNavigate?: (entityType: string, entityId: string) => void;
}

export function DiagnosticsPanel({ diagnostics, entityTypes, schemas, onNavigate }: DiagnosticsPanelProps) {
  // Filter state - now managed within the panel
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');

  // Helper to get singular display name (for entity references)
  const getDisplayName = (entityType: string): string => {
    if (!entityType || entityType === '(bundle)') return entityType;
    const schema = schemas?.[entityType];
    return getEntityDisplayName(schema) ?? entityType;
  };

  // Helper to get plural display name (for group headers)
  const getDisplayNamePlural = (entityType: string): string => {
    if (!entityType || entityType === '(bundle)') return entityType;
    const schema = schemas?.[entityType];
    return getEntityDisplayNamePlural(schema) ?? entityType;
  };

  // Apply filters
  const filteredDiagnostics = diagnostics.filter((d) => {
    if (severityFilter !== 'all' && d.severity !== severityFilter) return false;
    if (entityTypeFilter !== 'all' && d.entityType !== entityTypeFilter) return false;
    return true;
  });

  if (!diagnostics.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>✓</span>
          <span>No diagnostics.</span>
        </div>
      </div>
    );
  }

  // Group filtered diagnostics by entity type
  const byEntityType = new Map<string, UiDiagnostic[]>();

  for (const d of filteredDiagnostics) {
    const key = d.entityType ?? '(bundle)';
    const existing = byEntityType.get(key);
    if (existing) {
      existing.push(d);
    } else {
      byEntityType.set(key, [d]);
    }
  }

  const groups = Array.from(byEntityType.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Diagnostics</h2>
        <span className={styles.count}>
          {filteredDiagnostics.length} of {diagnostics.length} issue{diagnostics.length !== 1 ? 's' : ''}
        </span>

        <div className={styles.filters}>
          <select
            className={styles.filterSelect}
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'all' | 'error' | 'warning')}
            data-testid="severity-filter"
          >
            <option value="all">All Severities</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
          </select>

          <select
            className={styles.filterSelect}
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            data-testid="entity-type-filter"
          >
            <option value="all">All Types</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>{getDisplayName(t)}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredDiagnostics.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔍</span>
          <span>No diagnostics match the current filters.</span>
        </div>
      ) : (
        groups.map(([entityType, group]) => (
          <div key={entityType} className={styles.group}>
            <h3 className={styles.groupTitle}>{getDisplayNamePlural(entityType)}</h3>
            <ul className={styles.list}>
              {group.map((d, idx) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={idx} className={`${styles.item} ${d.severity === 'error' ? styles.itemError : styles.itemWarning}`}>
                  <span className={`${styles.severity} ${d.severity === 'error' ? styles.severityError : styles.severityWarning}`}>{d.severity}</span>
                  <span className={styles.message}>
                    {d.message}
                    {d.entityId && d.entityType && (
                      <> (<button
                        type="button"
                        className={styles.entityLink}
                        onClick={() => onNavigate?.(d.entityType!, d.entityId!)}
                        data-testid={`diagnostic-link-${d.entityId}`}
                      >
                        {getDisplayName(d.entityType)} {d.entityId}
                      </button>)</>
                    )}
                    {d.path && <> @ {d.path}</>}
                  </span>
                  {d.code && <span className={styles.code}>[{d.code}]</span>}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

