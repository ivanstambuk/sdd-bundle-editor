import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import type { UiDiagnostic } from '../types';

const sampleDiagnostics: UiDiagnostic[] = [
  {
    severity: 'error',
    message: 'Bundle is invalid',
    code: 'gate.bundle',
    source: 'gate',
  },
  {
    severity: 'warning',
    message: 'Feature missing description',
    entityType: 'Feature',
    entityId: 'FEAT-001',
    path: '/description',
    code: 'lint.feature.description',
    source: 'lint',
  },
  {
    severity: 'error',
    message: 'Requirement missing feature link',
    entityType: 'Requirement',
    entityId: 'REQ-001',
    code: 'lint.requirement.has-feature',
    source: 'lint',
  },
];

describe('DiagnosticsPanel', () => {
  it('renders placeholder when there are no diagnostics', () => {
    render(<DiagnosticsPanel diagnostics={[]} entityTypes={[]} />);

    expect(screen.getByText(/No diagnostics/i)).toBeInTheDocument();
  });

  it('groups diagnostics by entity type and renders details', () => {
    render(<DiagnosticsPanel diagnostics={sampleDiagnostics} entityTypes={['Feature', 'Requirement']} />);

    expect(screen.getByText('Diagnostics')).toBeInTheDocument();

    // group headings
    expect(screen.getByText('(bundle)')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('Requirement')).toBeInTheDocument();

    // some representative content
    expect(screen.getByText(/Bundle is invalid/)).toBeInTheDocument();
    expect(screen.getByText(/Feature FEAT-001/)).toBeInTheDocument();
    expect(screen.getByText(/Requirement missing feature link/)).toBeInTheDocument();
  });
});

