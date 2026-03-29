import { render, screen } from '@testing-library/react';
import { MarkdownWidget } from './MarkdownWidget';

vi.mock('./MermaidDiagram', () => ({
    MermaidDiagram: ({ code }: { code: string }) => <div data-testid="mermaid-diagram">{code}</div>,
}));

describe('MarkdownWidget', () => {
    it('routes mermaid fences to the Mermaid renderer', () => {
        render(
            <MarkdownWidget
                id="markdown"
                value={'```mermaid\ngraph TD\nA-->B\n```'}
                onChange={() => {}}
                readonly
            />,
        );

        expect(screen.getByTestId('mermaid-diagram')).toHaveTextContent(/graph TD\s+A-->B/);
    });

    it('renders unknown code fences as plain code blocks', () => {
        render(
            <MarkdownWidget
                id="markdown"
                value={'```custom\nplain code example\n```'}
                onChange={() => {}}
                readonly
            />,
        );

        expect(screen.queryByTestId('mermaid-diagram')).not.toBeInTheDocument();
        expect(screen.getByText(/plain code example/)).toBeInTheDocument();
    });
});
