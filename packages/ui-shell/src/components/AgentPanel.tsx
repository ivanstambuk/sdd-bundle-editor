import React, { useState, useEffect, useRef } from 'react';
import {
    ConversationMessage,
    ConversationStatus,
    ProposedChange,
    AgentDecision,
    DecisionOption,
    AgentBackendConfig,
    CodexModel,
    CodexReasoningEffort,
    CodexReasoningSummary,
    CODEX_MODEL_CAPABILITIES,
    DEEPSEEK_MODELS
} from '@sdd-bundle-editor/shared-types';
import ReactMarkdown from 'react-markdown';
import { DiffReviewModal } from './DiffReviewModal';

export interface MessageOptions {
    model?: string;
    reasoningEffort?: string;
}

export interface AgentPanelProps {
    messages: ConversationMessage[];
    status: ConversationStatus;
    pendingChanges?: ProposedChange[];
    activeDecision?: AgentDecision;
    lastError?: string;
    onSendMessage: (message: string, options?: MessageOptions) => Promise<void>;
    onStartConversation: () => void;
    onAbortConversation: () => void;
    onAcceptChanges: () => void;
    onDiscardChanges: () => void;
    onResolveDecision: (decisionId: string, optionId: string) => void;
    onNewChat: () => void;
}

// Add Speech Recognition types
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: (event: any) => void;
    onend: (event: any) => void;
    onerror: (event: any) => void;
    onstart: (event: any) => void;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export function AgentPanel({
    messages,
    status,
    pendingChanges,
    activeDecision,
    lastError,
    onSendMessage,
    onStartConversation,
    onAbortConversation,
    onAcceptChanges,
    onDiscardChanges,
    onResolveDecision,
    onNewChat,
}: AgentPanelProps) {
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [config, setConfig] = useState<AgentBackendConfig>({ type: 'http' }); // Default to HTTP
    const [cliPreset, setCliPreset] = useState('custom');
    const [currentBackendType, setCurrentBackendType] = useState<string>('mock');
    const [currentBackendLabel, setCurrentBackendLabel] = useState<string>('');
    const [activeCommand, setActiveCommand] = useState<string>('');
    const [isSending, setIsSending] = useState(false);
    const [showDiffModal, setShowDiffModal] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // Inline model selection state (used during chat session)
    const [activeModel, setActiveModel] = useState<string>('gpt-5.1');
    const [activeReasoningEffort, setActiveReasoningEffort] = useState<CodexReasoningEffort>('high');

    // Check for debug mode (allows Echo CLI usage)
    const isDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'true';

    // Generate a friendly label for the current backend config
    const getBackendLabel = (cfg: AgentBackendConfig): string => {
        if (cfg.type === 'mock') return '';
        if (cfg.type === 'cli') {
            const cmd = cfg.options?.command as string;
            if (!cmd) return 'CLI';
            // "Echo" is for internal testing only, hidden unless debug mode is active
            if (cmd.toLowerCase() === 'echo' && !isDebug) return '';

            // Capitalize first letter of command name
            const name = cmd.charAt(0).toUpperCase() + cmd.slice(1);
            return `${name} CLI`;
        }
        if (cfg.type === 'http') {
            const model = cfg.options?.model as string;
            return model || 'HTTP API';
        }
        return cfg.type.toUpperCase();
    };

    const fetchStatus = () => {
        fetch('/agent/status')
            .then(res => res.json())
            .then((data: { config?: AgentBackendConfig }) => {
                if (data.config) {
                    setCurrentBackendType(data.config.type);
                    setActiveCommand(data.config.type === 'cli' ? (data.config.options?.command as string || '').toLowerCase() : '');
                    setCurrentBackendLabel(getBackendLabel(data.config));
                    // Pre-fill form with current config if not editing
                    if (!showSettings) {
                        setConfig(data.config);
                    }
                }
            })
            .catch((err: unknown) => console.error('Failed to fetch agent status', err));
    };

    // Poll agent status on mount and when settings close
    useEffect(() => {
        fetchStatus();
    }, [showSettings]);

    const handleSaveConfig = async () => {
        try {
            await fetch('/agent/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            setShowSettings(false);
            // Refresh status to update main view
            fetchStatus();
            // Automatically start conversation after saving config
            onStartConversation();
        } catch (err) {
            console.error('Failed to save config', err);
            // In real app, show error toast
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, status, activeDecision]);

    // Auto-focus input when conversation starts or when new chat begins (messages cleared)
    useEffect(() => {
        if (status === 'active') {
            // Focus immediately for new/empty conversations, with delay for transitions
            const delay = messages.length === 0 ? 50 : 100;
            setTimeout(() => inputRef.current?.focus(), delay);
        }
    }, [status, messages.length === 0]); // Also trigger when messages become empty (new chat)

    const handleSend = async () => {
        if (inputText.trim() && !isSending) {
            const message = inputText;
            setInputText('');
            setIsSending(true);
            try {
                // Pass inline model selection to the message handler
                const options: MessageOptions = {};
                if (currentBackendType === 'cli' && activeCommand === 'codex') {
                    options.model = activeModel;
                    options.reasoningEffort = activeReasoningEffort;
                } else if (currentBackendType === 'http') {
                    options.model = activeModel;
                }
                const minDuration = 500;
                const setMinLoading = new Promise(resolve => setTimeout(resolve, minDuration));

                // Allow error to propagate but ensure we waited minDuration
                try {
                    await Promise.all([
                        onSendMessage(message, options),
                        setMinLoading
                    ]);
                } catch (err) {
                    // Even if it failed, we waited. Rethrow to let UI handle error if needed, 
                    // though onSendMessage usually handles state updates via props.
                    // But here we just want to ensure catch block runs if needed.
                    // Actually onSendMessage returns Promise<void>, if it throws, we catch here.
                    await setMinLoading; // Ensure we still waited if it failed fast
                    throw err; // Re-throw to be caught by caller if any (none here) or just logged? 
                    // Actually handleSend catches nothing currently? 
                    // Wait, original code:
                    // try { ... await onSendMessage... } finally { setIsSending(false) }
                    // It swallowed errors? No, promise rejection bubbles up?
                    // handleSend is async void, so rejection is unhandled unless caught.
                    // But normally onSendMessage updates 'status' prop to 'error' via parent re-render?
                    // Let's assume onSendMessage might throw or might just update state.
                    // If access to onSendMessage throws, we want to catch it?
                    // But original code didn't catch. 
                    // Let's stick to original behavior but add delay.
                }
            } catch (err) {
                console.error("Error sending message:", err);
            } finally {
                setIsSending(false);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            // State update to false will happen in onend
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false; // Keep simple for now, only final results
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                setInputText(prev => {
                    const prefix = prev ? prev + ' ' : '';
                    return prefix + finalTranscript.trim();
                });
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    if (status === 'idle') {
        const isEcho = activeCommand === 'echo';
        const isAllowed = !isEcho || isDebug;
        // Basically configured if not mock AND allowed (or debug mode allows mock)
        const isConfigured = (currentBackendType !== 'mock' || isDebug) && isAllowed;

        let warningMsg = '⚠️ Agent is not configured. Please select a provider.';
        if (currentBackendType !== 'mock' && !isAllowed) {
            warningMsg = '⚠️ Echo tool is for internal testing only. Enable debug mode to use.';
        }

        return (
            <div className="agent-panel empty-state">
                <div className="agent-placeholder">
                    <h3>Agent Editor</h3>
                    {currentBackendLabel && (
                        <div className="agent-backend-badge">
                            <span className="badge badge-info">🤖 {currentBackendLabel}</span>
                        </div>
                    )}
                    <p>Start a conversation to modify the bundle using AI.</p>

                    {showSettings ? (
                        <div className="agent-settings">
                            <h4>Configuration</h4>
                            <div className="form-group">
                                <label>Provider Type:</label>
                                <select
                                    className="form-control"
                                    value={config.type}
                                    onChange={e => setConfig({ type: e.target.value, options: {} } as any)}
                                    data-testid="agent-provider-type-select"
                                >
                                    <option value="http">AI Provider (HTTP)</option>
                                    <option value="cli">Local CLI Tool</option>
                                    {/* Enable Mock Agent for testing/dev */}
                                    <option value="mock">Mock Agent (Debug)</option>
                                </select>
                            </div>

                            {config.type === 'cli' && (
                                <>
                                    <div className="form-group">
                                        <label>Preset:</label>
                                        <select
                                            className="form-control"
                                            value={cliPreset}
                                            data-testid="agent-cli-preset-select"
                                            onChange={e => {
                                                const val = e.target.value;
                                                setCliPreset(val);
                                                if (val === 'codex') {
                                                    setConfig({
                                                        ...config,
                                                        model: 'gpt-5.1',
                                                        reasoningEffort: 'high',
                                                        reasoningSummary: 'auto',
                                                        options: {
                                                            command: 'codex',
                                                            args: ['exec', '--full-auto']
                                                        }
                                                    });
                                                } else if (val === 'gemini') {
                                                    setConfig({ ...config, model: undefined, reasoningEffort: undefined, reasoningSummary: undefined, options: { command: 'gemini', args: [] } });
                                                } else if (val === 'claude') {
                                                    setConfig({ ...config, model: undefined, reasoningEffort: undefined, reasoningSummary: undefined, options: { command: 'claude', args: [] } });
                                                }
                                            }}
                                        >
                                            <option value="custom">Custom</option>
                                            <option value="codex">Codex CLI</option>
                                            <option value="gemini">Gemini CLI</option>
                                            <option value="claude">Claude Code</option>
                                        </select>
                                    </div>

                                    {/* Model Selection is now inline during chat */}
                                    {cliPreset === 'codex' && (
                                        <div className="form-group">
                                            <small style={{ color: 'var(--color-text-muted)' }}>
                                                💡 Model and reasoning effort can be changed during chat via the selector bar below the input.
                                            </small>
                                        </div>
                                    )}

                                    {cliPreset === 'custom' && (
                                        <>
                                            <div className="form-group">
                                                <label>Command:</label>
                                                <input
                                                    className="form-control"
                                                    value={(config.options?.command as string) || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        options: { ...config.options, command: e.target.value }
                                                    })}
                                                    placeholder="e.g. codex"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Args (JSON):</label>
                                                <input
                                                    className="form-control"
                                                    value={JSON.stringify((config.options?.args as string[]) || [])}
                                                    onChange={e => {
                                                        try {
                                                            const args = JSON.parse(e.target.value);
                                                            setConfig({ ...config, options: { ...config.options, args } });
                                                        } catch { }
                                                    }}
                                                    placeholder='e.g. ["--prompt"]'
                                                />
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            {config.type === 'http' && (
                                <>
                                    <div className="form-group">
                                        <label>Provider Preset:</label>
                                        <select
                                            className="form-control"
                                            onChange={e => {
                                                const val = e.target.value;
                                                let baseURL = '';
                                                let model = '';
                                                switch (val) {
                                                    case 'openai':
                                                        baseURL = 'https://api.openai.com/v1';
                                                        model = 'gpt-4o';
                                                        break;
                                                    case 'ollama':
                                                        baseURL = 'http://localhost:11434/v1';
                                                        model = 'llama3';
                                                        break;
                                                    case 'groq':
                                                        baseURL = 'https://api.groq.com/openai/v1';
                                                        model = 'llama3-70b-8192';
                                                        break;
                                                    case 'deepseek':
                                                        baseURL = 'https://api.deepseek.com';
                                                        model = 'deepseek-chat';
                                                        break;
                                                    case 'openrouter':
                                                        baseURL = 'https://openrouter.ai/api/v1';
                                                        model = '';
                                                        break;
                                                }
                                                if (baseURL) {
                                                    setConfig({
                                                        ...config,
                                                        model: model || undefined,
                                                        options: { ...config.options, baseURL, httpProvider: val }
                                                    });
                                                }
                                            }}
                                            data-testid="http-provider-select"
                                        >
                                            <option value="custom">Custom</option>
                                            <option value="openai">OpenAI</option>
                                            <option value="ollama">Ollama (Local)</option>
                                            <option value="groq">Groq</option>
                                            <option value="deepseek">DeepSeek</option>
                                            <option value="openrouter">OpenRouter</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Base URL:</label>
                                        <input
                                            className="form-control"
                                            value={(config.options?.baseURL as string) || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                options: { ...config.options, baseURL: e.target.value }
                                            })}
                                            placeholder="https://api.openai.com/v1"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>API Key:</label>
                                        <input
                                            className="form-control"
                                            type="password"
                                            value={(config.options?.apiKey as string) || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                options: { ...config.options, apiKey: e.target.value }
                                            })}
                                            placeholder="sk-..."
                                        />
                                    </div>

                                    {/* Model selection - hint for DeepSeek, input for others */}
                                    {config.options?.httpProvider === 'deepseek' ? (
                                        <div className="form-group">
                                            <small style={{ color: 'var(--color-text-muted)' }}>
                                                💡 DeepSeek model (Chat/Reasoner) can be switched during chat via the selector bar below the input.
                                            </small>
                                        </div>
                                    ) : (
                                        <div className="form-group">
                                            <label>Model:</label>
                                            <input
                                                className="form-control"
                                                value={config.model || (config.options?.model as string) || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    model: e.target.value
                                                })}
                                                placeholder="gpt-4o"
                                                data-testid="http-model-input"
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="settings-actions">
                                <button onClick={handleSaveConfig} className="btn btn-primary btn-sm" data-testid="agent-save-config-btn">Save</button>
                                <button onClick={() => setShowSettings(false)} className="btn btn-secondary btn-sm" data-testid="agent-cancel-config-btn">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="placeholder-actions">
                            {!isConfigured && (
                                <div className="config-warning">
                                    {warningMsg}
                                </div>
                            )}
                            <button
                                onClick={onStartConversation}
                                className="start-btn btn btn-primary btn-lg"
                                disabled={!isConfigured}
                                title={!isConfigured ? "Please configure an agent provider first" : ""}
                                data-testid="agent-start-btn"
                            >
                                Start Conversation
                            </button>
                            <button onClick={() => setShowSettings(true)} className="settings-btn btn btn-link" data-testid="agent-settings-btn">
                                {isConfigured ? '⚙️ Configure' : '👉 Configure Agent'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="agent-panel">
            <div className="agent-header">
                <span className={`status-badge status-${status}`} data-testid="agent-status-badge">{status}</span>
                {currentBackendLabel && (
                    <span className="backend-label">🤖 {currentBackendLabel}</span>
                )}
                {(status === 'active' || status === 'pending_changes' || status === 'error') && (
                    <button
                        onClick={onNewChat}
                        className="new-chat-btn"
                        title="Start New Chat"
                        data-testid="agent-new-chat-btn"
                    >
                        ➕
                    </button>
                )}
                <button onClick={onAbortConversation} className="abort-btn" data-testid="agent-abort-btn">Abort</button>
            </div>

            {status === 'error' && lastError && (
                <div className="agent-error-banner" data-testid="agent-error-banner">
                    ⚠️ {lastError}
                </div>
            )}

            <div className="messages-list">
                {messages.map((msg, idx) => (
                    <div key={msg.id} className={`message role-${msg.role}`} data-testid={`chat-message-${msg.role}-${idx}`}>
                        <div className="message-meta">
                            <span className="message-role">{msg.role}</span>
                            <span className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="message-content markdown-body">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}

                {isSending && (
                    <div className="message role-agent">
                        <div className="message-meta">
                            <span className="message-role">agent</span>
                        </div>
                        <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                )}

                {activeDecision && (
                    <div className="decision-block">
                        <h4>{activeDecision.question}</h4>
                        {activeDecision.context && <p className="decision-context">{activeDecision.context}</p>}
                        <div className="decision-options">
                            {activeDecision.options.map(option => (
                                <div key={option.id} className="decision-option">
                                    <div className="option-header">
                                        <strong>{option.label}</strong>
                                        <button
                                            onClick={() => onResolveDecision(activeDecision.id, option.id)}
                                            className="btn btn-primary btn-sm"
                                            data-testid={`decision-option-${option.id}`}
                                        >
                                            Select
                                        </button>
                                    </div>
                                    <p className="option-desc">{option.description}</p>
                                    {option.pros && option.pros.length > 0 && (
                                        <div className="option-pros">
                                            <span>Pros:</span>
                                            <ul>{option.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
                                        </div>
                                    )}
                                    {option.cons && option.cons.length > 0 && (
                                        <div className="option-cons">
                                            <span>Cons:</span>
                                            <ul>{option.cons.map((c, i) => <li key={i}>{c}</li>)}</ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(status === 'pending_changes' || status === 'linting') && pendingChanges && (
                    <div className="pending-changes-block" data-testid="pending-changes-block">
                        <div className="pending-changes-header">
                            <h4>Proposed Changes ({pendingChanges.length})</h4>
                            <button
                                onClick={() => setShowDiffModal(true)}
                                className="btn btn-primary btn-sm"
                                disabled={status === 'linting'}
                                data-testid="agent-review-btn"
                            >
                                📋 Review Changes
                            </button>
                        </div>
                        <ul className="changes-list">
                            {pendingChanges.map((change, idx) => (
                                <li key={idx} className="change-item-compact">
                                    <span className="change-type">{change.entityType}</span>
                                    <span className="change-path">{change.fieldPath}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="change-actions">
                            <button
                                onClick={onAcceptChanges}
                                className="btn btn-success btn-sm"
                                disabled={status === 'linting'}
                                data-testid="agent-accept-btn"
                            >
                                {status === 'linting' ? '⏳ Applying & Linting...' : 'Accept & Apply'}
                            </button>
                            <button
                                onClick={onDiscardChanges}
                                className="btn btn-danger btn-sm"
                                disabled={status === 'linting'}
                                data-testid="agent-discard-btn"
                            >
                                🗑️ Discard All Changes
                            </button>
                            <button
                                onClick={onAbortConversation}
                                className="btn btn-secondary btn-sm"
                                disabled={status === 'linting'}
                                data-testid="agent-decline-btn"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>
            <div className="input-area">
                <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isSending ? "Waiting for response..." : isListening ? "Listening... (Speak now)" : "Describe changes..."}
                    rows={3}
                    disabled={isSending || (status !== 'active' && status !== 'error')}
                    className={isListening ? 'listening' : ''}
                    data-testid="agent-message-input"
                />
                <div className="input-actions">
                    <button
                        onClick={toggleListening}
                        className={`mic-btn ${isListening ? 'active' : ''}`}
                        disabled={isSending || (status !== 'active' && status !== 'error')}
                        title={isListening ? "Stop Listening" : "Start Speech-to-Text"}
                        type="button"
                        data-testid="agent-mic-btn"
                    >
                        {isListening ? '🔴' : '🎤'}
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isSending || !inputText.trim() || (status !== 'active' && status !== 'error')}
                        className={`send-btn ${isSending ? 'sending' : ''}`}
                        data-testid="agent-send-btn"
                    >
                        {isSending ? '⏳ Sending...' : 'Send'}
                    </button>
                </div>

                {(status as any) !== 'idle' && currentBackendType !== 'mock' && (
                    <div className="model-selector-bar" data-testid="model-selector-bar">
                        {/* Codex CLI model/reasoning selection */}
                        {currentBackendType === 'cli' && activeCommand === 'codex' && (
                            <>
                                <div className="model-selector-item">
                                    <select
                                        value={activeModel}
                                        onChange={e => {
                                            const newModel = e.target.value as CodexModel;
                                            setActiveModel(newModel);
                                            // Reset reasoning effort if xhigh selected but not supported
                                            const caps = CODEX_MODEL_CAPABILITIES[newModel];
                                            if (activeReasoningEffort && !caps.supportedReasoningEfforts.includes(activeReasoningEffort)) {
                                                setActiveReasoningEffort('medium');
                                            }
                                        }}
                                        data-testid="inline-model-select"
                                        className="inline-select"
                                    >
                                        <option value="gpt-5.1-codex-max">GPT-5.1-Max</option>
                                        <option value="gpt-5.1-codex">GPT-5.1-Codex</option>
                                        <option value="gpt-5.1">GPT-5.1</option>
                                        <option value="gpt-5.1-codex-mini">GPT-5.1-Mini</option>
                                        <option value="o3">o3</option>
                                        <option value="o4-mini">o4-mini</option>
                                    </select>
                                </div>
                                <div className="model-selector-item">
                                    <select
                                        value={activeReasoningEffort}
                                        onChange={e => setActiveReasoningEffort(e.target.value as CodexReasoningEffort)}
                                        data-testid="inline-reasoning-select"
                                        className="inline-select"
                                    >
                                        {(() => {
                                            const caps = CODEX_MODEL_CAPABILITIES[activeModel as CodexModel];
                                            return caps?.supportedReasoningEfforts.map((effort: CodexReasoningEffort) => (
                                                <option key={effort} value={effort}>
                                                    {effort === 'xhigh' ? 'XHigh' :
                                                        effort.charAt(0).toUpperCase() + effort.slice(1)}
                                                </option>
                                            ));
                                        })()}
                                    </select>
                                </div>
                            </>
                        )}

                        {currentBackendType === 'http' && (config.options?.httpProvider === 'deepseek' || (typeof config.options?.baseURL === 'string' && config.options.baseURL.includes('deepseek'))) && (
                            <div className="model-selector-item">
                                <select
                                    value={activeModel}
                                    onChange={e => setActiveModel(e.target.value)}
                                    data-testid="inline-deepseek-model-select"
                                    className="inline-select"
                                >
                                    <option value="deepseek-chat">Chat</option>
                                    <option value="deepseek-reasoner">Reasoner</option>
                                </select>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Diff Review Modal */}
            {
                showDiffModal && pendingChanges && (
                    <DiffReviewModal
                        changes={pendingChanges}
                        onAcceptAll={() => {
                            setShowDiffModal(false);
                            onAcceptChanges();
                        }}
                        onDeclineAll={() => {
                            setShowDiffModal(false);
                            onDiscardChanges();
                        }}
                        onClose={() => setShowDiffModal(false)}
                    />
                )
            }
        </div >
    );
}
