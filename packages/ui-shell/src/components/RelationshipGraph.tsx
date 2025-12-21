/**
 * RelationshipGraph - Interactive graph visualization of entity type relationships.
 * Uses React Flow for rendering and dagre for automatic hierarchical layout.
 * 
 * Features:
 * - Multi-select filtering: Show only selected entity types and their connections
 * - Category grouping: Filter dropdown groups types by category
 * - Click-to-navigate: Click a node to navigate to that entity type
 * 
 * ARCHITECTURAL NOTE: Relationships are derived from schema x-sdd-refTargets as
 * the SINGLE SOURCE OF TRUTH. The bundle-type.json.relations array is NOT used.
 */
import { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
    Node,
    Edge,
    MiniMap,
    Controls,
    Background,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    MarkerType,
    NodeMouseHandler,
    type EdgeTypes,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

import type {
    BundleTypeEntityConfig,
    BundleTypeCategoryConfig,
} from '@sdd-bundle-editor/shared-types';
import { extractRelationsFromSchemas, type SchemaRelation } from '../utils/schemaUtils';
import { getEntityColor } from '../utils/entityColors';
import { LabeledEdge, type LabeledEdgeData } from './LabeledEdge';
import { GraphFilterDropdown } from './GraphFilterDropdown';
import styles from './RelationshipGraph.module.css';

interface RelationshipGraphProps {
    /** Entity type configurations */
    entityConfigs: BundleTypeEntityConfig[];
    /** Category configurations for grouping */
    categories?: BundleTypeCategoryConfig[];
    /** Entity schemas - SINGLE SOURCE OF TRUTH for relationships */
    schemas?: Record<string, unknown>;
    /** Callback when an entity type node is clicked */
    onSelectType?: (entityType: string) => void;
}



// Create dagre graph and apply layout
function getLayoutedElements(
    nodes: Node[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 150;
    const nodeHeight = 50;

    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: 60,
        ranksep: 80,
        marginx: 40,
        marginy: 40,
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
}

/**
 * Transform bundle type definitions into React Flow nodes and edges.
 * Relationships are derived from schemas (x-sdd-refTargets) as SSOT.
 * 
 * @param entityConfigs - Entity type configurations to create nodes for
 * @param relations - Relationship data (already filtered if needed)
 * @param visibleTypes - Set of entity types to show (empty = show all)
 */
function transformToFlowElements(
    entityConfigs: BundleTypeEntityConfig[],
    relations: SchemaRelation[],
    visibleTypes: Set<string>
): { nodes: Node[]; edges: Edge[] } {
    // Filter to visible types only
    const filteredConfigs = visibleTypes.size === 0
        ? entityConfigs
        : entityConfigs.filter(c => visibleTypes.has(c.entityType));

    // Create nodes for each visible entity type
    const nodes: Node[] = filteredConfigs.map((config, index) => {
        const color = getEntityColor(config.entityType, config, index);

        return {
            id: config.entityType,
            type: 'default',
            data: {
                label: config.entityType,
            },
            position: { x: 0, y: 0 }, // Will be set by dagre
            style: {
                background: color,
                color: '#1a1b26',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: '13px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                minWidth: '120px',
                textAlign: 'center' as const,
            },
        };
    });

    // Build set of visible node IDs for edge filtering
    const visibleNodeIds = new Set(nodes.map(n => n.id));

    // Filter relations to only those between visible nodes
    const filteredRelations = relations.filter(
        rel => visibleNodeIds.has(rel.fromEntity) && visibleNodeIds.has(rel.toEntity)
    );

    // Track edge count between node pairs to offset overlapping edges
    const edgePairCount: Record<string, number> = {};

    // Create edges for each relationship (derived from schema)
    // Uses custom 'labeled' edge type that renders labels as HTML above the SVG path
    const edges: Edge<LabeledEdgeData>[] = filteredRelations.map((rel, index) => {
        // Format label: display name with cardinality indicator
        const cardinalitySymbol = rel.isMany ? ' [*]' : '';
        const label = rel.displayName + cardinalitySymbol;

        // Track how many edges exist between this pair (for offset calculation)
        const pairKey = `${rel.fromEntity}-${rel.toEntity}`;
        const reversePairKey = `${rel.toEntity}-${rel.fromEntity}`;
        const existingCount = (edgePairCount[pairKey] || 0) + (edgePairCount[reversePairKey] || 0);
        edgePairCount[pairKey] = (edgePairCount[pairKey] || 0) + 1;

        // Calculate path offset for parallel edges (curves the line to avoid overlap)
        const pathOffset = existingCount > 0 ? existingCount * 30 : undefined;

        return {
            id: `edge-${index}`,
            source: rel.fromEntity,
            target: rel.toEntity,
            // Use custom 'labeled' edge type - label is passed via data, not as direct prop
            type: 'labeled',
            data: {
                label,
                offset: pathOffset,
            },
            style: {
                stroke: 'var(--color-border, #414868)',
                strokeWidth: 1.5,
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: 'var(--color-border, #414868)',
                width: 20,
                height: 20,
            },
            animated: false,
        };
    });

    // Apply dagre layout
    return getLayoutedElements(nodes, edges, 'TB');
}

export function RelationshipGraph({
    entityConfigs,
    categories,
    schemas,
    onSelectType,
}: RelationshipGraphProps) {
    // Filter state: which entity types to show (empty = show all)
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

    // Extract relationships from schemas - SINGLE SOURCE OF TRUTH
    const relations = useMemo(
        () => extractRelationsFromSchemas(schemas),
        [schemas]
    );

    // Transform data to React Flow format with dagre layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
        () => transformToFlowElements(entityConfigs, relations, selectedTypes),
        [entityConfigs, relations, selectedTypes]
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

    // Update nodes/edges when filter changes
    useEffect(() => {
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
    }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

    // Define custom edge types - must be memoized to prevent re-renders
    const edgeTypes: EdgeTypes = useMemo(
        () => ({ labeled: LabeledEdge }),
        []
    );


    // Handle node click -> navigate to entity type
    const onNodeClick: NodeMouseHandler = useCallback(
        (_event, node) => {
            onSelectType?.(node.id);
        },
        [onSelectType]
    );

    // Handle filter change
    const handleFilterChange = useCallback((newSelection: Set<string>) => {
        setSelectedTypes(newSelection);
    }, []);

    // Empty state
    if (entityConfigs.length === 0) {
        return (
            <div className={styles.empty}>
                <span className={styles.emptyIcon}>🗺️</span>
                <p>No entity types defined in this bundle.</p>
            </div>
        );
    }

    // Compute hint text for filtered state
    const isFiltered = selectedTypes.size > 0;
    const visibleCount = isFiltered ? selectedTypes.size : entityConfigs.length;
    const edgeCount = edges.length;

    return (
        <div className={styles.container}>
            {/* Toolbar with filter */}
            <div className={styles.toolbar}>
                <GraphFilterDropdown
                    entityConfigs={entityConfigs}
                    categories={categories}
                    selectedTypes={selectedTypes}
                    onSelectionChange={handleFilterChange}
                />
                <span className={styles.hint}>
                    {visibleCount} types • {edgeCount} relationships
                </span>
            </div>

            {/* Graph */}
            <div className={styles.graph} data-testid="relationship-graph">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={onNodeClick}
                    fitView
                    fitViewOptions={{
                        padding: 0.2,
                        minZoom: 0.5,
                        maxZoom: 1.5,
                    }}
                    minZoom={0.2}
                    maxZoom={2}
                    edgeTypes={edgeTypes}
                    defaultEdgeOptions={{
                        type: 'labeled',
                    }}
                    proOptions={{ hideAttribution: true }}
                    style={{ height: '400px', width: '100%' }}
                >
                    <Background
                        variant={BackgroundVariant.Dots}
                        gap={20}
                        size={1}
                        color="var(--color-border-subtle, #2f3549)"
                    />
                    <Controls
                        showInteractive={false}
                        position="bottom-left"
                    />
                    <MiniMap
                        nodeColor={(node) => node.style?.background as string || '#414868'}
                        maskColor="rgba(0, 0, 0, 0.6)"
                        style={{
                            backgroundColor: 'var(--color-surface-secondary, #24283b)',
                            border: '1px solid var(--color-border, #414868)',
                            borderRadius: '8px',
                        }}
                        position="bottom-right"
                    />
                </ReactFlow>
            </div>
        </div>
    );
}
