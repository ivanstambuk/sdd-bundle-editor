import { render, screen } from '@testing-library/react';
import { MarkdownWidget } from './MarkdownWidget';

vi.mock('./MermaidDiagram', () => ({
    MermaidDiagram: ({ code }: { code: string }) => <div data-testid="mermaid-diagram">{code}</div>,
}));

vi.mock('./PlantUmlDiagram', () => ({
    PlantUmlDiagram: ({ code }: { code: string }) => <div data-testid="plantuml-diagram">{code}</div>,
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

    it('keeps PlantUML fences routed to the existing renderer', () => {
        render(
            <MarkdownWidget
                id="markdown"
                value={'```plantuml\n@startuml\nAlice -> Bob: Hi\n@enduml\n```'}
                onChange={() => {}}
                readonly
            />,
        );

        expect(screen.getByTestId('plantuml-diagram')).toHaveTextContent(
            /@startuml\s+Alice -> Bob: Hi\s+@enduml/,
        );
    });
});
