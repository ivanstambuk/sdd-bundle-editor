import { render, screen, waitFor } from '@testing-library/react';
import mermaid from 'mermaid';
import { MermaidDiagram } from './MermaidDiagram';

vi.mock('mermaid', () => ({
    default: {
        initialize: vi.fn(),
        render: vi.fn(async () => ({
            svg: '<svg><text>Rendered Mermaid</text></svg>',
        })),
    },
}));

describe('MermaidDiagram', () => {
    beforeAll(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(() => ({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        });
    });

    it('renders SVG output from Mermaid', async () => {
        render(<MermaidDiagram code={'graph TD\nA-->B'} />);

        await waitFor(() => {
            expect(screen.getByRole('img', { name: 'Mermaid diagram' })).toBeInTheDocument();
        });

        expect(mermaid.initialize).toHaveBeenCalled();
        expect(mermaid.render).toHaveBeenCalledWith(expect.stringMatching(/^mermaid-/), 'graph TD\nA-->B');
    });
});
