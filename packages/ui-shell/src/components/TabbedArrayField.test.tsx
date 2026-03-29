import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TabbedArrayField } from './TabbedArrayField';

describe('TabbedArrayField', () => {
  it('marks and sorts the chosen tab using a root choice source path', () => {
    render(
      <TabbedArrayField
        items={[
          { key: 'fallback', children: <div>Fallback body</div> },
          { key: 'preferred', children: <div>Preferred body</div> },
        ]}
        formData={[
          { name: 'Fallback option' },
          { name: 'Preferred option' },
        ]}
        schema={{
          'x-sdd-layout': 'tabbedArray',
          'x-sdd-tabLabelField': 'name',
          'x-sdd-choiceSourcePath': 'decision.chosen_alternative',
          'x-sdd-choiceMatchField': 'name',
        }}
        formContext={{
          rootData: {
            decision: {
              chosen_alternative: 'Preferred option',
            },
          },
        }}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('Preferred option');
    expect(buttons[1]).toHaveTextContent('Fallback option');
    expect(buttons[0]).toHaveTextContent('✓');
    expect(screen.getByText('Preferred body')).toBeInTheDocument();
  });
});
