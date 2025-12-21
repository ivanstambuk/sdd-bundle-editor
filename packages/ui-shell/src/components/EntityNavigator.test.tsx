import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EntityNavigator } from './EntityNavigator';
import type { UiBundleSnapshot } from '../types';

const sampleBundle: UiBundleSnapshot = {
  manifest: {},
  entities: {
    Feature: [
      {
        id: 'FEAT-001',
        entityType: 'Feature',
        filePath: 'features/FEAT-001.yaml',
        data: {},
      },
    ],
    Task: [
      {
        id: 'TASK-001',
        entityType: 'Task',
        filePath: 'tasks/TASK-001.yaml',
        data: {},
      },
    ],
  },
  refGraph: { edges: [] },
  schemas: {},
};

describe('EntityNavigator', () => {
  it('renders placeholder when no bundle is loaded', () => {
    render(<EntityNavigator bundle={null} selected={undefined} onSelect={() => { }} />);

    expect(screen.getByText(/No bundle loaded/i)).toBeInTheDocument();
  });

  it('renders entities grouped by type and calls onSelect', () => {
    const handleSelect = vi.fn();

    render(<EntityNavigator bundle={sampleBundle} selected={undefined} onSelect={handleSelect} />);

    expect(screen.getByText('Entities')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();

    // Groups are collapsed by default - expand the Feature group first
    fireEvent.click(screen.getByTestId('entity-group-Feature'));

    // Now the entity item should be visible
    fireEvent.click(screen.getByRole('button', { name: 'FEAT-001' }));

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect.mock.calls[0][0]).toMatchObject({
      id: 'FEAT-001',
      entityType: 'Feature',
    });
  });

  it('marks the selected entity as bold', () => {
    const handleSelect = vi.fn();

    render(
      <EntityNavigator
        bundle={sampleBundle}
        selected={{ entityType: 'Feature', id: 'FEAT-001' }}
        onSelect={handleSelect}
      />,
    );

    // Groups are collapsed by default - expand the Feature group first
    fireEvent.click(screen.getByTestId('entity-group-Feature'));

    const button = screen.getByRole('button', { name: 'FEAT-001' });
    // CSS Modules generate hashed class names like '_entityBtnSelected_c297df'
    expect(button.className).toMatch(/Selected/);
  });
});

