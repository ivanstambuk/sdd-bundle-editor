import type { UiDiagnostic } from '../types';
import { formatEntityType } from '../utils/formatText';

interface DiagnosticsPanelProps {
  diagnostics: UiDiagnostic[];
}

export function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
  if (!diagnostics.length) {
    return (
      <div className="diagnostics-panel">
        <div className="diagnostics-empty">
          <span className="diagnostics-empty-icon">✓</span>
          <span>No diagnostics.</span>
        </div>
      </div>
    );
  }

  const byEntityType = new Map<string, UiDiagnostic[]>();

  for (const d of diagnostics) {
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
    <div className="diagnostics-panel">
      <div className="diagnostics-header">
        <h2 className="diagnostics-title">Diagnostics</h2>
        <span className="text-muted text-sm">{diagnostics.length} issue{diagnostics.length !== 1 ? 's' : ''}</span>
      </div>
      {groups.map(([entityType, group]) => (
        <div key={entityType} className="diagnostic-group">
          <h3 className="diagnostic-group-title">{formatEntityType(entityType)}</h3>
          <ul className="diagnostic-list">
            {group.map((d, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={idx} className={`diagnostic-item ${d.severity}`}>
                <span className="diagnostic-severity">{d.severity}</span>
                <span className="diagnostic-message">
                  {d.message}
                  {d.entityId && <> ({formatEntityType(d.entityType || '')} {d.entityId})</>}
                  {d.path && <> @ {d.path}</>}
                </span>
                {d.code && <span className="diagnostic-code">[{d.code}]</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
