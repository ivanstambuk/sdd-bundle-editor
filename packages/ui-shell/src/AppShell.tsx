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
import { TabbedBottomPanel, type BottomPanelTab } from './components/TabbedBottomPanel';
import { OutputPanel, useOutputLog } from './components/OutputPanel';
import { SearchResultsPanel, type SearchResult } from './components/SearchResultsPanel';
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
  const [viewMode, setViewMode] = useState<'entity' | 'domain'>('entity');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Output log
  const outputLog = useOutputLog();

  // Log bundle events
  useEffect(() => {
    if (bundle) {
      const entityCount = Object.values(bundle.entities).reduce((sum, map) => sum + Object.keys(map).length, 0);
      outputLog.success(`Bundle loaded: ${entityCount} entities`, 'Bundle');
    }
  }, [bundle]);

  useEffect(() => {
    if (diagnostics.length > 0) {
      const errors = diagnostics.filter(d => d.severity === 'error').length;
      const warnings = diagnostics.filter(d => d.severity === 'warning').length;
      outputLog.info(`Validation complete: ${errors} errors, ${warnings} warnings`, 'Validation');
    }
  }, [diagnostics]);

  useEffect(() => {
    if (bundleError) {
      outputLog.error(bundleError, 'Bundle');
    }
  }, [bundleError]);

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
      <div className="info-banner" data-testid="read-only-banner">
        📖 <strong>Read-Only Mode</strong>
        <span className="info-text">
          — To edit entities, use an MCP client (Claude Desktop, VS Code Copilot) connected to the MCP server.
        </span>
        <span
          className={`mcp-status ${isMcpMode ? 'connected' : 'fallback'}`}
          data-testid="mcp-status"
        >
          {isMcpMode ? '🔗 MCP' : '📡 HTTP'}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={reloadBundle}
          data-testid="reload-bundle"
        >
          🔄 Reload
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
          {bundleError && (
            <div className="status-error" data-testid="bundle-error">
              <strong>⚠️ Error:</strong> {bundleError}
              {bundleError.includes('fetch') && (
                <div className="error-hint">
                  💡 Backend server may not be running. Try: <code>pnpm dev</code>
                </div>
              )}
            </div>
          )}
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

      {/* Bottom Panel - Tabbed */}
      <TabbedBottomPanel
        tabs={[
          {
            id: 'diagnostics',
            label: 'Diagnostics',
            badge: diagnostics.length > 0 ? diagnostics.length : undefined,
            badgeType: diagnostics.some(d => d.severity === 'error') ? 'error' : 'warning',
            content: <DiagnosticsPanel diagnostics={diagnostics} entityTypes={entityTypes} schemas={bundle?.schemas} onNavigate={handleNavigate} />,
          },
          {
            id: 'output',
            label: 'Output',
            badge: outputLog.entries.length > 0 ? outputLog.entries.length : undefined,
            content: <OutputPanel entries={outputLog.entries} />,
          },
          {
            id: 'search',
            label: 'Search',
            badge: searchResults.length > 0 ? searchResults.length : undefined,
            content: (
              <SearchResultsPanel
                query={searchQuery}
                results={searchResults}
                onNavigate={handleNavigate}
              />
            ),
          },
        ]}
        defaultTab="diagnostics"
      />
    </div>
  );
}
