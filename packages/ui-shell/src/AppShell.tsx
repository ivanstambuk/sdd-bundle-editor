/**
 * AppShell - Main application shell component.
 * 
 * This component composes the main UI layout and connects:
 * - Bundle state (via useBundleState hook)
 * - Keyboard shortcuts (via useKeyboardShortcuts hook)
 * 
 * The UI is now READ-ONLY for browsing entities.
 * All writes happen via MCP tools called by external LLMs (Claude, Copilot).
 */

import { useEffect, useState, useMemo } from 'react';
import type { UiBundleSnapshot, UiDiagnostic, UiEntity } from './types';
import { EntityNavigator } from './components/EntityNavigator';
import { EntityDetails } from './components/EntityDetails';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { DomainKnowledgePanel } from './components/DomainKnowledgePanel';
import { Breadcrumb } from './components/Breadcrumb';
import { ResizableSidebar } from './components/ResizableSidebar';
import { createLogger } from './utils/logger';
import { useBundleState, useKeyboardShortcuts } from './hooks';

const log = createLogger('AppShell');

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
    isMcpMode,
    loadBundle,
    reloadBundle,
    selectEntity,
    navigateToEntity,
    runValidation,
    clearError,
  } = useBundleState(bundleDir);

  // UI state
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'entity' | 'domain'>('entity');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts(useMemo(() => [
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
    loadBundle();
  }, []);

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

  return (
    <div className="app-shell">
      {/* Info banner - UI is read-only, shows MCP connection status */}
      <div className="info-banner" data-testid="read-only-banner" style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        padding: '8px 16px',
        borderBottom: '1px solid #0284c7',
        color: '#0369a1',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        📖 <strong>Read-Only Mode</strong> — To edit entities, use an MCP client (Claude Desktop, VS Code Copilot) connected to the MCP server.
        <span
          data-testid="mcp-status"
          style={{
            marginLeft: '12px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: isMcpMode ? '#dcfce7' : '#fef3c7',
            color: isMcpMode ? '#166534' : '#92400e',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          {isMcpMode ? '🔗 MCP' : '📡 HTTP'}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={reloadBundle}
          style={{ marginLeft: 'auto' }}
        >
          🔄 Reload Bundle
        </button>
      </div>

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
            className="btn-icon"
            onClick={runValidation}
            disabled={bundleLoading}
            title="Validate Bundle"
            data-testid="compile-btn"
          >
            ⚡
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <ResizableSidebar isCollapsed={sidebarCollapsed}>
        <div className="sidebar-section">
          {bundleLoading && <span className="status-loading">Loading...</span>}
          {bundleError && <div className="status-error">Error: {bundleError}</div>}

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
              readOnly={true}
              onNavigate={handleNavigate}
              diagnostics={currentEntityDiagnostics}
            />
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
