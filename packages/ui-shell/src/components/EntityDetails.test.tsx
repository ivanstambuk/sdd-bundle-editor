import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EntityDetails } from './EntityDetails';
import type { UiBundleSnapshot, UiEntity } from '../types';

vi.mock('@rjsf/core', () => ({
  __esModule: true,
  default: (props: any) => (
    // simple stub so we do not depend on RJSF internals in tests

    <div data-testid="rjsf-form" data-schema-has-properties={props.schema && 'properties' in props.schema}>
      RJSF form
    </div>
  ),
}));

const makeEntity = (): UiEntity => ({
  id: 'FEAT-001',
  entityType: 'Feature',
  filePath: 'features/FEAT-001.yaml',
  data: {
    id: 'FEAT-001',
    title: 'Sample feature',
    requirement: 'REQ-001',
  },
});

const makeBundleWithSchema = (): UiBundleSnapshot => ({
  manifest: {},
  entities: {
    Feature: [makeEntity()],
  },
  refGraph: {
    edges: [
      {
        fromEntityType: 'Feature',
        fromId: 'FEAT-001',
        fromField: 'requirement',
        toEntityType: 'Requirement',
        toId: 'REQ-001',
      },
      {
        fromEntityType: 'Task',
        fromId: 'TASK-001',
        fromField: 'requirement',
        toEntityType: 'Feature',
        toId: 'FEAT-001',
      },
    ],
  },
  schemas: {
    Feature: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        requirement: {
          type: 'string',
          format: 'sdd-ref',
          'x-refTargets': ['Requirement'],
        },
      },
    },
  },
});

const makeBundleWithoutSchema = (): UiBundleSnapshot => {
  const withSchema = makeBundleWithSchema();
  return {
    ...withSchema,
    schemas: undefined,
  };
};

const makeNestedAdrEntity = (): UiEntity => ({
  id: 'ADR-0001-example',
  entityType: 'ADR',
  filePath: 'adrs/ADR-0001-example.yaml',
  data: {
    adr: {
      id: 'ADR-0001-example',
      title: 'Nested ADR title',
      status: 'accepted',
      created_at: '2024-10-15T10:00:00Z',
      last_modified: '2024-10-20T10:00:00Z',
    },
    decision: {
      chosen_alternative: 'Preferred option',
      confidence: 'high',
    },
    alternatives: [
      { name: 'Preferred option' },
      { name: 'Fallback option' },
    ],
  },
});

const makeNestedAdrBundle = (): UiBundleSnapshot => ({
  manifest: {},
  entities: {
    ADR: [makeNestedAdrEntity()],
  },
  refGraph: { edges: [] },
  schemas: {
    ADR: {
      type: 'object',
      'x-sdd-layoutGroups': {
        overview: { title: 'Overview', order: 1 },
        alternatives: { title: 'Alternatives', order: 2 },
        meta: { title: 'Meta', order: 3 },
      },
      properties: {
        adr: {
          type: 'object',
          'x-sdd-layoutGroup': 'overview',
          properties: {
            title: { type: 'string', 'x-sdd-displayLocation': 'title' },
            status: { type: 'string', 'x-sdd-displayLocation': 'header', 'x-sdd-enumStyles': { accepted: { color: 'success' } } },
            created_at: { type: 'string', format: 'date-time', title: 'Created Date', 'x-sdd-displayLocation': 'header' },
            last_modified: { type: 'string', format: 'date-time', title: 'Last Modified Date', 'x-sdd-displayLocation': 'header' },
          },
        },
        decision: {
          type: 'object',
          'x-sdd-layoutGroup': 'overview',
          properties: {
            chosen_alternative: { type: 'string' },
            confidence: { type: 'string', 'x-sdd-displayLocation': 'header', 'x-sdd-enumStyles': { high: { color: 'success' } }, 'x-sdd-showLabelInBadge': true },
          },
        },
        alternatives: {
          type: 'array',
          'x-sdd-layoutGroup': 'alternatives',
          'x-sdd-layout': 'tabbedArray',
          'x-sdd-tabLabelField': 'name',
          'x-sdd-choiceSourcePath': 'decision.chosen_alternative',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      },
    },
  },
});

describe('EntityDetails', () => {
  it('renders placeholder when no bundle or entity is selected', () => {
    render(<EntityDetails bundle={null} entity={null} />);

    expect(screen.getByText(/No entity selected/i)).toBeInTheDocument();
  });

  it('renders schema-driven form and tabs when schema is available', () => {
    const bundle = makeBundleWithSchema();
    const entity = bundle.entities.Feature[0];

    render(<EntityDetails bundle={bundle} entity={entity} />);

    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('FEAT-001')).toBeInTheDocument();
    expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();

    // Check that tabs are present
    expect(screen.getByTestId('tab-properties')).toBeInTheDocument();
    expect(screen.getByTestId('tab-graph')).toBeInTheDocument();
    expect(screen.getByTestId('tab-yaml')).toBeInTheDocument();
  });

  it('falls back to JSON view when no schema is available', () => {
    const bundle = makeBundleWithoutSchema();
    const entity = bundle.entities.Feature[0];

    render(<EntityDetails bundle={bundle} entity={entity} />);

    expect(screen.queryByTestId('rjsf-form')).not.toBeInTheDocument();
    expect(screen.getByText(/Schema not found for entity type/)).toBeInTheDocument();
  });

  it('shows diagnostics badge when entity has diagnostics', () => {
    const bundle = makeBundleWithSchema();
    const entity = bundle.entities.Feature[0];
    const diagnostics = [
      { severity: 'error' as const, message: 'Test error', entityType: 'Feature', entityId: 'FEAT-001' },
      { severity: 'warning' as const, message: 'Test warning', entityType: 'Feature', entityId: 'FEAT-001' },
    ];

    render(
      <EntityDetails
        bundle={bundle}
        entity={entity}
        diagnostics={diagnostics}
      />
    );

    // Check for error and warning counts in the badge
    expect(screen.getByText('⛔ 1')).toBeInTheDocument();
    expect(screen.getByText('⚠️ 1')).toBeInTheDocument();
  });

  it('renders nested title, nested header metadata, and layout sub-tabs for governed ADRs', () => {
    const bundle = makeNestedAdrBundle();
    const entity = bundle.entities.ADR[0];

    render(<EntityDetails bundle={bundle} entity={entity} />);

    expect(screen.getByText('Nested ADR title')).toBeInTheDocument();
    expect(screen.getByText('ADR-0001-example')).toBeInTheDocument();
    expect(screen.getByText('accepted')).toBeInTheDocument();
    expect(screen.getByText('Confidence: high')).toBeInTheDocument();
    expect(screen.getByText('Created Date:')).toBeInTheDocument();
    expect(screen.getByTestId('subtab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('subtab-alternatives')).toBeInTheDocument();
    expect(screen.getByTestId('subtab-meta')).toBeInTheDocument();
  });
});
