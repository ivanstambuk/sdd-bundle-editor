import { useEffect, useState, useCallback } from 'react';
import type { UiAIResponse, UiBundleSnapshot, UiDiagnostic, UiEntity } from './types';
import { EntityNavigator } from './components/EntityNavigator';
import { EntityDetails } from './components/EntityDetails';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { DomainKnowledgePanel } from './components/DomainKnowledgePanel';
import { AgentPanel } from './components/AgentPanel';
import { ReadOnlyToggle } from './components/ReadOnlyToggle';
import type { ConversationState } from '@sdd-bundle-editor/core-ai';

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

// Retry wrapper with exponential backoff for transient failures
async function fetchWithRetry<T>(
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchJson<T>(url, options);
    } catch (err) {
      lastError = err as Error;
      // Only retry on network errors or 5xx, not on 4xx client errors
      const isRetryable = lastError.message.includes('fetch') ||
        lastError.message.includes('5') ||
        lastError.message.includes('network');
      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  throw lastError;
}

interface AgentHealth {
  conversationStatus: string;
  hasPendingChanges: boolean;
  git: {
    isRepo: boolean;
    branch?: string;
    isClean?: boolean;
  };
  canAcceptChanges: boolean;
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

function getInitialBundleDir() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const dir = params.get('bundleDir');
    if (dir) return dir;
  }
  return DEFAULT_BUNDLE_DIR;
}

export function AppShell() {
  const [bundleDir] = useState(getInitialBundleDir);
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
  const [viewMode, setViewMode] = useState<'entity' | 'domain'>('entity');

  // Read-Only mode state
  const [isReadOnly, setIsReadOnly] = useState(true);

  // Agent state
  const [conversation, setConversation] = useState<ConversationState>({ status: 'idle', messages: [] });
  const [showAgentPanel, setShowAgentPanel] = useState(true);

  // Git health state for mid-conversation monitoring
  const [gitHealth, setGitHealth] = useState<AgentHealth | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Poll agent health when conversation is active
  const pollHealth = useCallback(async () => {
    if (conversation.status === 'idle') return;
    try {
      const health = await fetchJson<AgentHealth>(`/agent/health?bundleDir=${encodeURIComponent(bundleDir)}`);
      setGitHealth(health);
      setNetworkError(null);
    } catch (err) {
      setNetworkError((err as Error).message);
    }
  }, [conversation.status, bundleDir]);

  useEffect(() => {
    if (conversation.status !== 'idle') {
      pollHealth();
      const interval = setInterval(pollHealth, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [conversation.status, pollHealth]);

  // Poll agent status on mount
  useEffect(() => {
    fetchJson<{ state: ConversationState }>('/agent/status')
      .then((data) => setConversation(data.state))
      .catch((err) => console.error('Failed to fetch agent status', err));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchJson<BundleResponse>(`/bundle?bundleDir=${encodeURIComponent(bundleDir)}`)
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
        body: JSON.stringify({ bundleDir: bundleDir }),
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
        body: JSON.stringify({ bundleDir: bundleDir }),
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
        body: JSON.stringify({ bundleDir: bundleDir }),
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

  const handleAgentStart = async () => {
    console.log('handleAgentStart called, readOnly:', isReadOnly);
    try {
      const data = await fetchJson<{ state: ConversationState }>('/agent/start', {
        method: 'POST',
        body: JSON.stringify({
          bundleDir: bundleDir,
          readOnly: isReadOnly  // Pass read-only mode to backend for sandbox control
        }),
      });
      setConversation(data.state);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  };

  const handleAgentMessage = async (message: string) => {
    try {
      // Optimistic update
      setConversation(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          { id: 'temp-' + Date.now(), role: 'user', content: message, timestamp: Date.now() }
        ]
      }));

      const data = await fetchJson<{ state: ConversationState }>('/agent/message', {
        method: 'POST',
        body: JSON.stringify({ bundleDir: bundleDir, message }),
      });
      setConversation(data.state);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  };

  const handleAgentAbort = async () => {
    try {
      const data = await fetchJson<{ state: ConversationState }>('/agent/abort', {
        method: 'POST',
      });
      setConversation(data.state);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAgentAccept = async () => {
    try {
      const data = await fetchJson<{ state: ConversationState }>(`/agent/accept?bundleDir=${encodeURIComponent(bundleDir)}`, {
        method: 'POST',
        body: JSON.stringify({ changes: conversation.pendingChanges || [] }),
      });
      setConversation(data.state);
      // Refresh bundle after changes
      setLoading(true);
      fetchJson<BundleResponse>(`/bundle?bundleDir=${encodeURIComponent(bundleDir)}`)
        .then((data) => {
          setBundle(data.bundle);
          setDiagnostics(data.diagnostics);
        })
        .finally(() => setLoading(false));

    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  };

  const handleResolveDecision = async (decisionId: string, optionId: string) => {
    try {
      const data = await fetchJson<{ state: ConversationState }>('/agent/decision', {
        method: 'POST',
        body: JSON.stringify({ decisionId, optionId }),
      });
      setConversation(data.state);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  };

  const handleEditRequest = () => {
    setIsReadOnly(false);
    setShowAgentPanel(true);
  };

  const handleNavigate = (entityType: string, entityId: string) => {
    // Find the target entity and select it
    const entities = bundle?.entities[entityType] ?? [];
    const targetEntity = entities.find((e) => e.id === entityId);
    if (targetEntity) {
      setSelectedEntity(targetEntity);
      setViewMode('entity');
    }
  };

  return (
    <div className={`app-shell ${showAgentPanel ? 'with-agent-panel' : ''}`}>
      {/* Git dirty state warning */}
      {gitHealth && gitHealth.git.isClean === false && conversation.status !== 'idle' && (
        <div className="warning-banner git-dirty-warning" data-testid="git-dirty-warning">
          ⚠️ Git working tree has uncommitted changes. You cannot accept agent changes until the working tree is clean.
          <button
            type="button"
            className="btn btn-sm"
            onClick={pollHealth}
          >
            🔄 Refresh
          </button>
        </div>
      )}

      {/* Network error indicator */}
      {networkError && (
        <div className="warning-banner network-error-warning" data-testid="network-error-warning">
          ⚠️ Connection issue: {networkError}
          <button
            type="button"
            className="btn btn-sm"
            onClick={pollHealth}
          >
            🔄 Retry
          </button>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <span className="app-logo">📦</span>
          <h1 className="app-title">SDD Bundle Editor</h1>
        </div>
        <div className="header-right">
          <ReadOnlyToggle isReadOnly={isReadOnly} onToggle={setIsReadOnly} />

          {bundle?.domainMarkdown && (
            <button
              type="button"
              className={`btn ${viewMode === 'domain' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setViewMode('domain');
                setSelectedEntity(null);
              }}
            >
              📖 Domain Knowledge
            </button>
          )}

          <button
            type="button"
            className={`btn ${showAgentPanel ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowAgentPanel(!showAgentPanel)}
          >
            🤖 Agent
          </button>
          <button type="button" className="btn btn-primary" onClick={handleCompile} disabled={loading}>
            Compile Spec
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleAiGenerate} disabled={loading}>
            ✨ AI Generate
          </button>
          <div className="bundle-path">
            {bundleDir}
          </div>
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
            selected={viewMode === 'entity' && selectedEntity ? { entityType: selectedEntity.entityType, id: selectedEntity.id } : undefined}
            onSelect={(e) => {
              setSelectedEntity(e);
              setViewMode('entity');
            }}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-area">
          {viewMode === 'domain' && bundle?.domainMarkdown ? (
            <DomainKnowledgePanel content={bundle.domainMarkdown} />
          ) : (
            <EntityDetails
              bundle={bundle}
              entity={selectedEntity}
              readOnly={isReadOnly}
              onNavigate={handleNavigate}
              onEditRequest={handleEditRequest}
            />
          )}

          {aiLog.length > 0 && (
            <div className="ai-panel">
              <h2 className="ai-panel-title">AI Log</h2>
              <ul className="ai-log">
                {aiLog.map((line: string, idx: number) => (
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

      {showAgentPanel && (
        <aside className="right-sidebar">
          <AgentPanel
            messages={conversation.messages}
            status={conversation.status}
            pendingChanges={conversation.pendingChanges}
            activeDecision={conversation.activeDecision}
            onSendMessage={handleAgentMessage}
            onStartConversation={handleAgentStart}
            onAbortConversation={handleAgentAbort}
            onAcceptChanges={handleAgentAccept}
            onResolveDecision={handleResolveDecision}
          />
        </aside>
      )}

      {/* Bottom Panel - Diagnostics */}
      <div className="bottom-panel">
        <DiagnosticsPanel diagnostics={filteredDiagnostics} />
      </div>
    </div>
  );
}
