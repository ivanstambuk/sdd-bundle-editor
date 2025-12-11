/**
 * AppShell - Main application shell component.
 * 
 * This component composes the main UI layout and connects:
 * - Bundle state (via useBundleState hook)
 * - Agent state (via useAgentState hook)
 * - Keyboard shortcuts (via useKeyboardShortcuts hook)
 * 
 * The component focuses on layout composition and prop drilling,
 * with business logic extracted to hooks and API layer.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { UiAIResponse, UiBundleSnapshot, UiDiagnostic, UiEntity } from './types';
import { EntityNavigator } from './components/EntityNavigator';
import { EntityDetails } from './components/EntityDetails';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { DomainKnowledgePanel } from './components/DomainKnowledgePanel';
import { AgentPanel } from './components/AgentPanel';
import { ReadOnlyToggle } from './components/ReadOnlyToggle';
import { Breadcrumb } from './components/Breadcrumb';
import { ResizableSidebar } from './components/ResizableSidebar';
import { createLogger } from './utils/logger';
import { useBundleState, useAgentState, useKeyboardShortcuts } from './hooks';
import { aiApi, agentApi } from './api';

const log = createLogger('AppShell');

/**
 * Compute diff summary between two bundle snapshots.
 */
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

/**
 * Get the bundle directory from URL parameters.
 * The bundleDir query parameter is REQUIRED - there is no default.
 */
function getInitialBundleDir(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const dir = params.get('bundleDir');
    if (dir) return dir;
  }
  console.warn('No bundleDir specified in URL. Please provide bundleDir query parameter.');
  return process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle';
}

export function AppShell() {
  // Core state
  const [bundleDir] = useState(getInitialBundleDir);

  // Bundle state hook
  const {
    bundle,
    diagnostics,
    selectedEntity,
    loading: bundleLoading,
    error: bundleError,
    loadBundle,
    reloadBundle,
    setBundle,
    setDiagnostics,
    selectEntity,
    navigateToEntity,
    runValidation,
    clearError,
  } = useBundleState(bundleDir);

  // UI state
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'entity' | 'domain'>('entity');
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // AI generation state (legacy)
  const [aiLog, setAiLog] = useState<string[]>([]);
  const [aiProposedBundle, setAiProposedBundle] = useState<UiBundleSnapshot | null>(null);
  const [aiDiffSummary, setAiDiffSummary] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agent state hook
  const agentState = useAgentState({
    bundleDir,
    onBundleReload: reloadBundle,
    onError: setError,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts(useMemo(() => [
    {
      key: 'j',
      ctrl: true,
      handler: () => setShowAgentPanel(prev => !prev),
      description: 'Toggle Agent Panel'
    },
    {
      key: 'b',
      ctrl: true,
      handler: () => setSidebarCollapsed(prev => !prev),
      description: 'Toggle Sidebar'
    },
    {
      key: 'p',
      ctrl: true,
      handler: () => {
        if (sidebarCollapsed) setSidebarCollapsed(false);
        setViewMode('entity');
      },
      description: 'Quick Search'
    },
  ], [sidebarCollapsed]));

  // Initial load
  useEffect(() => {
    // Check for resetAgent query param
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('resetAgent') === 'true') {
        log.info('Resetting agent state via query parameter...');
        agentState.resetAgent();
      }
    }

    loadBundle();
  }, []);

  // Handlers for AI generation (legacy)
  const handleAiGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiApi.generate(bundleDir);
      const notes = data.response.notes ?? [];
      setAiLog((prev) => [...prev, ...notes]);
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

  const handleApplyAiChanges = async () => {
    if (!aiProposedBundle) return;
    setBundle(aiProposedBundle);
    setAiProposedBundle(null);
    setAiDiffSummary([]);
    try {
      await runValidation();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDiscardAiChanges = () => {
    setAiProposedBundle(null);
    setAiDiffSummary([]);
  };

  // Handler for fix diagnostics action
  const handleFixDiagnostics = (entity: UiEntity, curDiagnostics: UiDiagnostic[]) => {
    const errorCount = curDiagnostics.filter(d => d.severity === 'error').length;
    const warningCount = curDiagnostics.filter(d => d.severity === 'warning').length;
    const summary = `${errorCount} errors, ${warningCount} warnings`;

    setShowAgentPanel(true);

    const issues = curDiagnostics
      .slice(0, 5)
      .map(d => `- [${d.severity}] ${d.message}`)
      .join('\n');

    const prompt = `Fix the following issues for ${entity.entityType} ${entity.id} (${summary}):\n\n${issues}\n\n${curDiagnostics.length > 5 ? '(and more...)' : ''}`;

    agentState.sendMessage(prompt);
  };

  // Handler for edit request
  const handleEditRequest = () => {
    setIsReadOnly(false);
    setShowAgentPanel(true);
  };

  // Handler for navigation
  const handleNavigate = (entityType: string, entityId: string) => {
    navigateToEntity(entityType, entityId);
    setViewMode('entity');
  };

  // Filtered diagnostics
  const filteredDiagnostics = diagnostics.filter((d: UiDiagnostic) => {
    if (severityFilter !== 'all' && d.severity !== severityFilter) return false;
    if (entityTypeFilter !== 'all' && d.entityType !== entityTypeFilter) return false;
    return true;
  });

  const entityTypes = bundle ? Object.keys(bundle.entities) : [];

  const currentEntityDiagnostics = selectedEntity
    ? diagnostics.filter(d =>
      d.entityType === selectedEntity.entityType &&
      d.entityId === selectedEntity.id
    )
    : [];

  // Combined loading state
  const isLoading = loading || bundleLoading;

  // Combined error state
  const displayError = error || bundleError;

  return (
    <div className={`app-shell ${showAgentPanel ? 'with-agent-panel' : ''}`}>
      {/* Git dirty state warning */}
      {agentState.agentHealth && agentState.agentHealth.git.isClean === false && agentState.conversation.status !== 'idle' && (
        <div className="warning-banner git-dirty-warning" data-testid="git-dirty-warning">
          ⚠️ Git working tree has uncommitted changes. You cannot accept agent changes until the working tree is clean.
          <button
            type="button"
            className="btn btn-sm"
            onClick={agentState.refreshHealth}
          >
            🔄 Refresh
          </button>
        </div>
      )}

      {/* Network error indicator */}
      {agentState.networkError && (
        <div className="warning-banner network-error-warning" data-testid="network-error-warning">
          ⚠️ Connection issue: {agentState.networkError}
          <button
            type="button"
            className="btn btn-sm"
            onClick={agentState.refreshHealth}
          >
            🔄 Retry
          </button>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button
            type="button"
            className="btn-icon hamburger-menu"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            data-testid="sidebar-toggle"
          >
            ☰
          </button>
          <Breadcrumb bundle={bundle} selectedEntity={selectedEntity} />
        </div>
        <div className="header-right">
          <ReadOnlyToggle isReadOnly={isReadOnly} onToggle={setIsReadOnly} />

          {bundle?.domainMarkdown && (
            <button
              type="button"
              className={`btn-icon ${viewMode === 'domain' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('domain');
                selectEntity(null);
              }}
              title="Domain Knowledge"
            >
              📖
            </button>
          )}

          <button
            type="button"
            className={`btn-icon ${showAgentPanel ? 'active' : ''}`}
            onClick={() => setShowAgentPanel(!showAgentPanel)}
            title="Toggle Agent Panel (Ctrl+J)"
            data-testid="agent-toggle"
          >
            🤖
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={runValidation}
            disabled={isLoading}
            title="Compile Spec"
            data-testid="compile-btn"
          >
            ⚡
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={handleAiGenerate}
            disabled={isLoading}
            title="AI Generate"
          >
            ✨
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <ResizableSidebar isCollapsed={sidebarCollapsed}>
        <div className="sidebar-section">
          {isLoading && <span className="status-loading">Loading...</span>}
          {displayError && <div className="status-error">Error: {displayError}</div>}

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
              selectEntity(e);
              setViewMode('entity');
            }}
          />
        </div>
      </ResizableSidebar>

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
              diagnostics={currentEntityDiagnostics}
              onFixDiagnostics={handleFixDiagnostics}
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
                <button type="button" className="btn btn-success" onClick={handleApplyAiChanges} disabled={isLoading}>
                  Apply Changes
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleDiscardAiChanges} disabled={isLoading}>
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
            messages={agentState.conversation.messages}
            status={agentState.conversation.status}
            pendingChanges={agentState.conversation.pendingChanges}
            activeDecision={agentState.conversation.activeDecision}
            lastError={agentState.conversation.lastError}
            onSendMessage={agentState.sendMessage}
            onStartConversation={() => agentState.startConversation(isReadOnly)}
            onAbortConversation={agentState.abortConversation}
            onAcceptChanges={() => agentState.acceptChanges(agentState.conversation.pendingChanges || [])}
            onDiscardChanges={agentState.rollbackChanges}
            onResolveDecision={agentState.resolveDecision}
            onNewChat={() => agentState.startNewChat(isReadOnly)}
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
