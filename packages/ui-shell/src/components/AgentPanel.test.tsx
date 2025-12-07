import { render, screen, fireEvent } from '@testing-library/react';
import { AgentPanel } from './AgentPanel';
import { ConversationMessage } from '@sdd-bundle-editor/core-ai';
import React from 'react';

describe('AgentPanel', () => {
    const mockOnSendMessage = vi.fn();
    const mockOnStart = vi.fn();
    const mockOnAbort = vi.fn();
    const mockOnAccept = vi.fn();
    const mockOnResolve = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    it('renders start button when idle', () => {
        render(
            <AgentPanel
                messages={[]}
                status="idle"
                onSendMessage={mockOnSendMessage}
                onStartConversation={mockOnStart}
                onAbortConversation={mockOnAbort}
                onAcceptChanges={mockOnAccept}
                onResolveDecision={mockOnResolve}
            />
        );

        expect(screen.getByText('Start Conversation')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Start Conversation'));
        expect(mockOnStart).toHaveBeenCalled();
    });

    it('renders messages and input when active', () => {
        const messages: ConversationMessage[] = [
            { id: '1', role: 'system', content: 'Hello', timestamp: 123 },
            { id: '2', role: 'user', content: 'Hi there', timestamp: 124 },
        ];

        render(
            <AgentPanel
                messages={messages}
                status="active"
                onSendMessage={mockOnSendMessage}
                onStartConversation={mockOnStart}
                onAbortConversation={mockOnAbort}
                onAcceptChanges={mockOnAccept}
                onResolveDecision={mockOnResolve}
            />
        );

        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there')).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('calls onSendMessage when sending text', () => {
        render(
            <AgentPanel
                messages={[]}
                status="active"
                onSendMessage={mockOnSendMessage}
                onStartConversation={mockOnStart}
                onAbortConversation={mockOnAbort}
                onAcceptChanges={mockOnAccept}
                onResolveDecision={mockOnResolve}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Make a change' } });
        fireEvent.click(screen.getByText('Send'));

        expect(mockOnSendMessage).toHaveBeenCalledWith('Make a change');
        expect(input).toHaveValue('');
    });

    it('calls onAbortConversation when abort button clicked', () => {
        render(
            <AgentPanel
                messages={[]}
                status="active"
                onSendMessage={mockOnSendMessage}
                onStartConversation={mockOnStart}
                onAbortConversation={mockOnAbort}
                onAcceptChanges={mockOnAccept}
                onResolveDecision={mockOnResolve}
            />
        );

        fireEvent.click(screen.getByText('Abort'));
        expect(mockOnAbort).toHaveBeenCalled();
    });

    it('renders pending changes and accept button', () => {
        render(
            <AgentPanel
                messages={[]}
                status="pending_changes"
                pendingChanges={[
                    {
                        entityType: 'Bundle',
                        entityId: 'root',
                        fieldPath: 'description',
                        originalValue: 'old',
                        newValue: 'new',
                        rationale: 'test'
                    }
                ]}
                onSendMessage={mockOnSendMessage}
                onStartConversation={mockOnStart}
                onAbortConversation={mockOnAbort}
                onAcceptChanges={mockOnAccept}
                onResolveDecision={mockOnResolve}
            />
        );

        expect(screen.getByText('Proposed Changes (1)')).toBeInTheDocument();
        expect(screen.getByText('Accept & Apply')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Accept & Apply'));
        expect(mockOnAccept).toHaveBeenCalled();
    });

    it('renders decision and calls onResolveDecision', () => {
        render(
            <AgentPanel
                messages={[]}
                status="active"
                activeDecision={{
                    id: 'dec-1',
                    question: 'Test Question',
                    status: 'open',
                    options: [
                        { id: 'opt-1', label: 'Option 1' },
                        { id: 'opt-2', label: 'Option 2' }
                    ]
                }}
                onSendMessage={mockOnSendMessage}
                onStartConversation={mockOnStart}
                onAbortConversation={mockOnAbort}
                onAcceptChanges={mockOnAccept}
                onResolveDecision={mockOnResolve}
            />
        );

        expect(screen.getByText('Test Question')).toBeInTheDocument();
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('Option 2')).toBeInTheDocument();

        // Find all "Select" buttons and click the first one
        const selectButtons = screen.getAllByText('Select');
        fireEvent.click(selectButtons[0]);

        expect(mockOnResolve).toHaveBeenCalledWith('dec-1', 'opt-1');
    });
});
