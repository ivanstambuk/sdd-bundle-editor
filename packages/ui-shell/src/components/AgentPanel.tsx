import React, { useState, useEffect, useRef } from 'react';
import { ConversationMessage, ConversationStatus, ProposedChange, AgentDecision, DecisionOption, AgentBackendConfig } from '@sdd-bundle-editor/core-ai';
import ReactMarkdown from 'react-markdown';

export interface AgentPanelProps {
    messages: ConversationMessage[];
    status: ConversationStatus;
    pendingChanges?: ProposedChange[];
    activeDecision?: AgentDecision;
    onSendMessage: (message: string) => Promise<void>;
    onStartConversation: () => void;
    onAbortConversation: () => void;
    onAcceptChanges: () => void;
    onResolveDecision: (decisionId: string, optionId: string) => void;
}

export function AgentPanel({
    messages,
    status,
    pendingChanges,
    activeDecision,
    onSendMessage,
    onStartConversation,
    onAbortConversation,
    onAcceptChanges,
    onResolveDecision,
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
            return model ? `HTTP (${model})` : 'HTTP API';
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
        } catch (err) {
            console.error('Failed to save config', err);
            // In real app, show error toast
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, status, activeDecision]);

    // Auto-focus input when conversation starts
    useEffect(() => {
        if (status === 'active') {
            // Small delay to ensure the textarea is rendered
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [status]);

    const handleSend = async () => {
        if (inputText.trim() && !isSending) {
            const message = inputText;
            setInputText('');
            setIsSending(true);
            try {
                await onSendMessage(message);
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
                                >
                                    <option value="http">AI Provider (HTTP)</option>
                                    <option value="cli">Local CLI Tool</option>
                                </select>
                            </div>

                            {config.type === 'cli' && (
                                <>
                                    <div className="form-group">
                                        <label>Preset:</label>
                                        <select
                                            className="form-control"
                                            value={cliPreset}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setCliPreset(val);
                                                if (val === 'codex') {
                                                    setConfig({
                                                        ...config,
                                                        options: {
                                                            command: 'codex',
                                                            args: ['exec', '--full-auto']
                                                        }
                                                    });
                                                } else if (val === 'gemini') {
                                                    setConfig({ ...config, options: { command: 'gemini', args: [] } });
                                                } else if (val === 'claude') {
                                                    setConfig({ ...config, options: { command: 'claude', args: [] } });
                                                }
                                            }}
                                        >
                                            <option value="custom">Custom</option>
                                            <option value="codex">Codex CLI</option>
                                            <option value="gemini">Gemini CLI</option>
                                            <option value="claude">Claude Code</option>
                                        </select>
                                    </div>
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
                                                        model = 'deepseek-coder';
                                                        break;
                                                    case 'openrouter':
                                                        baseURL = 'https://openrouter.ai/api/v1';
                                                        break;
                                                }
                                                if (baseURL) {
                                                    setConfig({
                                                        ...config,
                                                        options: { ...config.options, baseURL, model }
                                                    });
                                                }
                                            }}
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
                                    <div className="form-group">
                                        <label>Model:</label>
                                        <input
                                            className="form-control"
                                            value={(config.options?.model as string) || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                options: { ...config.options, model: e.target.value }
                                            })}
                                            placeholder="gpt-4o"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="settings-actions">
                                <button onClick={handleSaveConfig} className="btn btn-primary btn-sm">Save</button>
                                <button onClick={() => setShowSettings(false)} className="btn btn-secondary btn-sm">Cancel</button>
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
                            >
                                Start Conversation
                            </button>
                            <button onClick={() => setShowSettings(true)} className="settings-btn btn btn-link">
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
                <span className={`status-badge status-${status}`}>{status}</span>
                {currentBackendLabel && (
                    <span className="backend-label">🤖 {currentBackendLabel}</span>
                )}
                <button onClick={onAbortConversation} className="abort-btn">Abort</button>
            </div>
            <div className="messages-list">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message role-${msg.role}`}>
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

                {status === 'pending_changes' && pendingChanges && (
                    <div className="pending-changes-block">
                        <h4>Proposed Changes ({pendingChanges.length})</h4>
                        <ul className="changes-list">
                            {pendingChanges.map((change, idx) => (
                                <li key={idx} className="change-item">
                                    <span className="change-type">{change.entityType}</span>
                                    <span className="change-path">{change.fieldPath}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="change-actions">
                            <button onClick={onAcceptChanges} className="btn btn-success btn-sm">Accept & Apply</button>
                            <button onClick={onAbortConversation} className="btn btn-secondary btn-sm">Decline</button>
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
                    placeholder={isSending ? "Waiting for response..." : "Describe changes..."}
                    rows={3}
                    disabled={isSending || (status !== 'active' && status !== 'error')}
                />
                <div className="input-actions">
                    <button
                        onClick={handleSend}
                        disabled={isSending || !inputText.trim() || (status !== 'active' && status !== 'error')}
                        className={`send-btn ${isSending ? 'sending' : ''}`}
                    >
                        {isSending ? '⏳ Sending...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
}
