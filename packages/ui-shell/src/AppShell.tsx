import { useEffect, useState } from 'react';
import type { UiAIResponse, UiBundleSnapshot, UiDiagnostic, UiEntity } from './types';
import { EntityNavigator } from './components/EntityNavigator';
import { EntityDetails } from './components/EntityDetails';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
}

interface BundleResponse {
  bundle: UiBundleSnapshot;
  diagnostics: UiDiagnostic[];
}

function computeBundleDiff(
  current: UiBundleSnapshot,
  updated: UiBundleSnapshot,
): string[] {
  const summary: string[] = [];

  const entityTypes = new Set([
    ...Object.keys(current.entities),
    ...Object.keys(updated.entities),
  ]);

  for (const type of entityTypes) {
    const currEntities = current.entities[type] ?? [];
    const updEntities = updated.entities[type] ?? [];

    const currById = new Map(currEntities.map((e) => [e.id, e]));
    const updById = new Map(updEntities.map((e) => [e.id, e]));

    const allIds = new Set([...currById.keys(), ...updById.keys()]);

    for (const id of allIds) {
      const curr = currById.get(id);
      const upd = updById.get(id);
      if (!curr && upd) {
        summary.push(`${type} ${id}: added`);
      } else if (curr && !upd) {
        summary.push(`${type} ${id}: removed`);
      } else if (curr && upd) {
        const currData = JSON.stringify(curr.data);
        const updData = JSON.stringify(upd.data);
        if (currData !== updData) {
          summary.push(`${type} ${id}: modified`);
        }
      }
    }
  }

  return summary;
}

const DEFAULT_BUNDLE_DIR = 'examples/basic-bundle';

export function AppShell() {
  const [bundle, setBundle] = useState<UiBundleSnapshot | null>(null);
  const [diagnostics, setDiagnostics] = useState<UiDiagnostic[]>([]);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<UiEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLog, setAiLog] = useState<string[]>([]);
  const [aiProposedBundle, setAiProposedBundle] = useState<UiBundleSnapshot | null>(null);
  const [aiDiffSummary, setAiDiffSummary] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    fetchJson<BundleResponse>(`/bundle?bundleDir=${encodeURIComponent(DEFAULT_BUNDLE_DIR)}`)
      .then((data) => {
        setBundle(data.bundle);
        setDiagnostics(data.diagnostics);
      })
      .catch((err: unknown) => {
        setError((err as Error).message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCompile = async () => {
    if (!bundle) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{ diagnostics: UiDiagnostic[] }>('/bundle/validate', {
        method: 'POST',
        body: JSON.stringify({ bundleDir: DEFAULT_BUNDLE_DIR }),
      });
      setDiagnostics(data.diagnostics);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{ response: UiAIResponse }>('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ bundleDir: DEFAULT_BUNDLE_DIR }),
      });
      const notes = data.response.notes ?? [];
      setAiLog((prev: string[]) => [...prev, ...notes]);
      if (data.response.updatedBundle && bundle) {
        setAiProposedBundle(data.response.updatedBundle);
        setAiDiffSummary(computeBundleDiff(bundle, data.response.updatedBundle));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const filteredDiagnostics = diagnostics.filter((d: UiDiagnostic) => {
    if (severityFilter !== 'all' && d.severity !== severityFilter) {
      return false;
    }
    if (entityTypeFilter !== 'all' && d.entityType !== entityTypeFilter) {
      return false;
    }
    return true;
  });

  const entityTypes = bundle ? Object.keys(bundle.entities) : [];

  const handleApplyAiChanges = async () => {
    if (!aiProposedBundle) return;
    setBundle(aiProposedBundle);
    setAiProposedBundle(null);
    setAiDiffSummary([]);
    try {
      const data = await fetchJson<{ diagnostics: UiDiagnostic[] }>('/bundle/validate', {
        method: 'POST',
        body: JSON.stringify({ bundleDir: DEFAULT_BUNDLE_DIR }),
      });
      setDiagnostics(data.diagnostics);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDiscardAiChanges = () => {
    setAiProposedBundle(null);
    setAiDiffSummary([]);
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">S</div>
          <h1 className="app-title">SDD Bundle Editor</h1>
        </div>
        <div className="btn-group">
          <button type="button" className="btn btn-primary" onClick={handleCompile} disabled={loading}>
            Compile Spec
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleAiGenerate} disabled={loading}>
            ✨ AI Generate
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-section">
          {loading && <span className="status-loading">Loading...</span>}
          {error && <div className="status-error">Error: {error}</div>}

          <div className="controls">
            <div className="filter-group">
              <span className="filter-label">Severity:</span>
              <select
                className="filter-select"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as 'all' | 'error' | 'warning')}
              >
                <option value="all">All</option>
                <option value="error">Errors</option>
                <option value="warning">Warnings</option>
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">Type:</span>
              <select
                className="filter-select"
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
              >
                <option value="all">All</option>
                {entityTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="sidebar-section">
          <EntityNavigator
            bundle={bundle}
            selected={selectedEntity ? { entityType: selectedEntity.entityType, id: selectedEntity.id } : undefined}
            onSelect={setSelectedEntity}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-area">
          <EntityDetails
            bundle={bundle}
            entity={selectedEntity}
            onNavigate={(entityType, entityId) => {
              // Find the target entity and select it
              const entities = bundle?.entities[entityType] ?? [];
              const targetEntity = entities.find((e) => e.id === entityId);
              if (targetEntity) {
                setSelectedEntity(targetEntity);
              }
            }}
          />

          {aiLog.length > 0 && (
            <div className="ai-panel">
              <h2 className="ai-panel-title">AI Log</h2>
              <ul className="ai-log">
                {aiLog.map((line: string, idx: number) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={idx} className="ai-log-item">{line}</li>
                ))}
              </ul>
            </div>
          )}

          {aiProposedBundle && (
            <div className="ai-panel">
              <h2 className="ai-panel-title">AI Proposed Changes</h2>
              {aiDiffSummary.length ? (
                <ul className="ai-diff-summary">
                  {aiDiffSummary.map((line: string, idx: number) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={idx} className="ai-diff-item">{line}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted">No differences detected.</div>
              )}
              <div className="btn-group">
                <button type="button" className="btn btn-success" onClick={handleApplyAiChanges} disabled={loading}>
                  Apply Changes
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleDiscardAiChanges} disabled={loading}>
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Panel - Diagnostics */}
      <div className="bottom-panel">
        <DiagnosticsPanel diagnostics={filteredDiagnostics} />
      </div>
    </div>
  );
}
