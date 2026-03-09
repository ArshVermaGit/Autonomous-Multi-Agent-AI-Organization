'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Provider = 'bedrock' | 'openai' | 'anthropic' | 'google';

interface LLMKey {
    id: string;
    provider: Provider;
    label: string;
    key_hint: string;
    is_valid: boolean;
    created_at: string;
}

interface AgentPref {
    id?: string;
    agent_role: string;
    provider: Provider;
    model_name: string;
    key_id: string | null;
    model_params: Record<string, unknown>;
    is_default: boolean;
}

const PROVIDER_LABELS: Record<Provider, string> = {
    bedrock: 'Amazon Bedrock (Nova)',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google Gemini',
};

const AGENT_LABELS: Record<string, string> = {
    CEO: 'CEO — Strategy',
    CTO: 'CTO — Architecture',
    Engineer_Backend: 'Engineer — Backend',
    Engineer_Frontend: 'Engineer — Frontend',
    QA: 'QA — Testing',
    DevOps: 'DevOps — Infrastructure',
    Finance: 'Finance — Budget',
};

const MODEL_OPTIONS: Record<Provider, string[]> = {
    bedrock: ['amazon.nova-pro-v1:0', 'amazon.nova-lite-v1:0', 'amazon.nova-micro-v1:0'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet-latest', 'claude-3-haiku-20240307', 'claude-3-opus-latest'],
    google: ['gemini-2.5-pro-exp-03-25', 'gemini-2.0-flash', 'gemini-1.5-pro'],
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...options,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
    return (
        <span
            className={`inline-block w-2 h-2 rounded-full mr-2 ${active ? 'bg-emerald-500' : 'bg-neutral-300'}`}
        />
    );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="mb-6">
            <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">{title}</h2>
            <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>
        </div>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
            {children}
        </div>
    );
}

// ── Section 1: LLM Keys ───────────────────────────────────────────────────────

function LLMKeysSection() {
    const [keys, setKeys] = useState<LLMKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingFor, setAddingFor] = useState<Provider | null>(null);
    const [form, setForm] = useState({ api_key: '', label: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const data = await apiFetch<{ keys: LLMKey[] }>('/v1/settings/keys');
            setKeys(data.keys);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (provider: Provider) => {
        if (!form.api_key.trim()) { setError('API key is required'); return; }
        setSaving(true); setError('');
        try {
            await apiFetch('/v1/settings/keys', {
                method: 'POST',
                body: JSON.stringify({ provider, api_key: form.api_key, label: form.label || 'default' }),
            });
            setForm({ api_key: '', label: '' });
            setAddingFor(null);
            await load();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        await apiFetch(`/v1/settings/keys/${id}`, { method: 'DELETE' });
        await load();
    };

    const providers: Provider[] = ['bedrock', 'openai', 'anthropic', 'google'];

    return (
        <Card>
            <SectionHeader
                title="API Keys"
                subtitle="Store your LLM provider keys. Keys are encrypted with AES-256 before saving. Only the last 4 characters are ever shown."
            />
            {loading ? (
                <p className="text-sm text-neutral-400">Loading...</p>
            ) : (
                <div className="space-y-4">
                    {providers.map((provider) => {
                        const providerKeys = keys.filter(k => k.provider === provider);
                        const isAdding = addingFor === provider;
                        return (
                            <div key={provider} className="border border-neutral-100 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-neutral-800">
                                            {PROVIDER_LABELS[provider]}
                                        </span>
                                        <span className="text-xs text-neutral-400">
                                            {providerKeys.length} key{providerKeys.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setAddingFor(isAdding ? null : provider)}
                                        className="text-xs px-3 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 transition-colors"
                                    >
                                        {isAdding ? 'Cancel' : 'Add Key'}
                                    </button>
                                </div>

                                {/* Existing keys */}
                                {providerKeys.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        {providerKeys.map(key => (
                                            <div key={key.id} className="flex items-center justify-between bg-neutral-50 rounded-md px-3 py-2">
                                                <div className="flex items-center">
                                                    <StatusDot active={key.is_valid} />
                                                    <span className="text-sm text-neutral-700 font-mono">{key.key_hint}</span>
                                                    <span className="text-xs text-neutral-400 ml-2">— {key.label}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(key.id)}
                                                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add key form */}
                                {isAdding && (
                                    <div className="space-y-2 mt-2">
                                        <input
                                            type="password"
                                            placeholder="Paste API key"
                                            value={form.api_key}
                                            onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                                            className="w-full text-sm border border-neutral-200 rounded-md px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Label (e.g. Personal, Work)"
                                            value={form.label}
                                            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                                            className="w-full text-sm border border-neutral-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                                        />
                                        {error && <p className="text-xs text-red-500">{error}</p>}
                                        <button
                                            onClick={() => handleSave(provider)}
                                            disabled={saving}
                                            className="text-sm px-4 py-2 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                                        >
                                            {saving ? 'Saving...' : 'Save Key'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}

// ── Section 2: Agent Model Preferences ───────────────────────────────────────

function AgentPrefsSection() {
    const [prefs, setPrefs] = useState<AgentPref[]>([]);
    const [keys, setKeys] = useState<LLMKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [prefsData, keysData] = await Promise.all([
                apiFetch<{ prefs: AgentPref[] }>('/v1/settings/agent-prefs'),
                apiFetch<{ keys: LLMKey[] }>('/v1/settings/keys'),
            ]);
            setPrefs(prefsData.prefs);
            setKeys(keysData.keys);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleUpdate = async (pref: AgentPref, field: string, value: string) => {
        const updated = { ...pref, [field]: value };
        setPrefs(ps => ps.map(p => p.agent_role === pref.agent_role ? updated : p));

        setSaving(pref.agent_role);
        try {
            await apiFetch('/v1/settings/agent-prefs', {
                method: 'POST',
                body: JSON.stringify({
                    agent_role: updated.agent_role,
                    provider: updated.provider,
                    model_name: updated.model_name,
                    key_id: updated.key_id ?? '',
                }),
            });
        } finally { setSaving(null); }
    };

    const handleReset = async (role: string) => {
        await apiFetch(`/v1/settings/agent-prefs/${role}`, { method: 'DELETE' });
        await load();
    };

    return (
        <Card>
            <SectionHeader
                title="Agent Model Preferences"
                subtitle="Configure which LLM model and API key each agent role uses. Leave on default to use platform-recommended models."
            />
            {loading ? (
                <p className="text-sm text-neutral-400">Loading...</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-100">
                                <th className="text-left py-2 pr-4 text-xs font-medium text-neutral-500 uppercase tracking-wide">Agent Role</th>
                                <th className="text-left py-2 pr-4 text-xs font-medium text-neutral-500 uppercase tracking-wide">Provider</th>
                                <th className="text-left py-2 pr-4 text-xs font-medium text-neutral-500 uppercase tracking-wide">Model</th>
                                <th className="text-left py-2 pr-4 text-xs font-medium text-neutral-500 uppercase tracking-wide">API Key</th>
                                <th className="text-left py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                            {prefs.map(pref => {
                                const providerKeys = keys.filter(k => k.provider === pref.provider && k.is_valid);
                                const isSaving = saving === pref.agent_role;
                                return (
                                    <tr key={pref.agent_role} className="group">
                                        <td className="py-3 pr-4 font-medium text-neutral-800">
                                            {AGENT_LABELS[pref.agent_role] ?? pref.agent_role}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <select
                                                value={pref.provider}
                                                onChange={e => handleUpdate(pref, 'provider', e.target.value)}
                                                className="text-sm border border-neutral-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                                            >
                                                {Object.entries(PROVIDER_LABELS).map(([v, l]) => (
                                                    <option key={v} value={v}>{l}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <select
                                                value={pref.model_name}
                                                onChange={e => handleUpdate(pref, 'model_name', e.target.value)}
                                                className="text-sm border border-neutral-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                                            >
                                                {MODEL_OPTIONS[pref.provider]?.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <select
                                                value={pref.key_id ?? ''}
                                                onChange={e => handleUpdate(pref, 'key_id', e.target.value || '')}
                                                className="text-sm border border-neutral-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                                            >
                                                <option value="">First valid key</option>
                                                {providerKeys.map(k => (
                                                    <option key={k.id} value={k.id}>{k.label} ({k.key_hint})</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                {isSaving ? (
                                                    <span className="text-xs text-neutral-400">Saving...</span>
                                                ) : (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pref.is_default ? 'bg-neutral-100 text-neutral-500' : 'bg-neutral-900 text-white'}`}>
                                                        {pref.is_default ? 'Default' : 'Custom'}
                                                    </span>
                                                )}
                                                {!pref.is_default && (
                                                    <button
                                                        onClick={() => handleReset(pref.agent_role)}
                                                        className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        Reset
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    return (
        <div className="min-h-screen bg-neutral-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Page Header */}
                <div className="mb-10">
                    <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Settings</h1>
                    <p className="text-sm text-neutral-500 mt-1">
                        Configure LLM providers and agent model preferences for your projects.
                        When no key is configured, the platform default keys are used automatically.
                    </p>
                </div>

                <div className="space-y-6">
                    <LLMKeysSection />
                    <AgentPrefsSection />

                    {/* Prompting Guides Reference */}
                    <Card>
                        <SectionHeader
                            title="Prompting References"
                            subtitle="Official best practices for writing effective system prompts for each provider."
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { provider: 'Amazon Bedrock', model: 'Nova Pro', url: 'https://docs.aws.amazon.com/nova/latest/userguide/prompt-engineering.html', note: 'All Default Agents' },
                                { provider: 'OpenAI', model: 'GPT-4o', url: 'https://platform.openai.com/docs/guides/prompt-engineering', note: 'Fallback CEO, Finance agents' },
                                { provider: 'Google', model: 'Gemini 2.5 Pro', url: 'https://ai.google.dev/gemini-api/docs/prompting-strategies', note: 'Fallback CTO, FE agents' },
                                { provider: 'Anthropic', model: 'Claude 3.5', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview', note: 'Fallback Engineer, QA agents' },
                            ].map(g => (
                                <a
                                    key={g.provider}
                                    href={g.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-4 border border-neutral-100 rounded-lg hover:border-neutral-300 hover:bg-neutral-50 transition-colors group"
                                >
                                    <p className="text-sm font-medium text-neutral-800 group-hover:text-neutral-900">{g.provider}</p>
                                    <p className="text-xs text-neutral-400 mt-0.5">{g.model}</p>
                                    <p className="text-xs text-neutral-500 mt-2">{g.note}</p>
                                    <p className="text-xs text-neutral-400 mt-1 underline underline-offset-2">View guide</p>
                                </a>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
