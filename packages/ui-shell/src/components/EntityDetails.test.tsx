import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EntityDetails } from './EntityDetails';
import type { UiBundleSnapshot, UiEntity } from '../types';

vi.mock('@rjsf/core', () => ({
  __esModule: true,
  default: (props: any) => (
    // simple stub so we do not depend on RJSF internals in tests
    // eslint-disable-next-line react/jsx-props-no-spreading
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

describe('EntityDetails', () => {
  it('renders placeholder when no bundle or entity is selected', () => {
    render(<EntityDetails bundle={null} entity={null} />);

    expect(screen.getByText(/No entity selected/i)).toBeInTheDocument();
  });

  it('renders schema-driven form and reference lists when schema is available', () => {
    const bundle = makeBundleWithSchema();
    const entity = bundle.entities.Feature[0];

    render(<EntityDetails bundle={bundle} entity={entity} />);

    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('FEAT-001')).toBeInTheDocument();
    expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();
    expect(screen.getByText('Outgoing references')).toBeInTheDocument();
    expect(screen.getByText('Requirement')).toBeInTheDocument();
    expect(screen.getByText('REQ-001')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('TASK-001')).toBeInTheDocument();
    expect(screen.getByText('via')).toBeInTheDocument();
    expect(screen.getAllByText('requirement').length).toBeGreaterThan(0);
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
});
