'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Key, Settings as SettingsIcon, Shield, Cpu, BookOpen, Check, Trash2, Plus, Loader2 } from 'lucide-react';

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
            className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${active ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-slate-300'}`}
        />
    );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
    return (
        <div className="mb-6 flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <Icon size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-sm ${className}`}>
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
                icon={Key}
                title="API Keys"
                subtitle="Configure your LLM provider keys. Keys are encrypted with AES-256 and never fully exposed."
            />
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-purple-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {providers.map((provider) => {
                        const providerKeys = keys.filter(k => k.provider === provider);
                        const isAdding = addingFor === provider;
                        return (
                            <div key={provider} className={`border rounded-2xl p-5 transition-all ${isAdding ? 'border-purple-300 bg-purple-50/30' : 'border-slate-100 bg-slate-50/30'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800">
                                            {PROVIDER_LABELS[provider]}
                                        </span>
                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                            {providerKeys.length} active key{providerKeys.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setAddingFor(isAdding ? null : provider)}
                                        className={`p-2 rounded-xl transition-all ${isAdding ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        {isAdding ? <ArrowLeft size={16} /> : <Plus size={16} />}
                                    </button>
                                </div>

                                {/* Existing keys */}
                                {providerKeys.length > 0 && !isAdding && (
                                    <div className="space-y-2">
                                        {providerKeys.map(key => (
                                            <div key={key.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-2.5 shadow-sm">
                                                <div className="flex items-center min-w-0">
                                                    <StatusDot active={key.is_valid} />
                                                    <span className="text-xs text-slate-700 font-mono truncate">{key.key_hint}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium ml-2 px-1.5 py-0.5 bg-slate-100 rounded-md uppercase">{key.label}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(key.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add key form */}
                                {isAdding && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Secret Key</label>
                                            <input
                                                type="password"
                                                placeholder="sk-..."
                                                value={form.api_key}
                                                onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                                                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Label</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Production, Testing"
                                                value={form.label}
                                                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                                                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 transition-all"
                                            />
                                        </div>
                                        {error && <p className="text-xs text-red-500 ml-1">{error}</p>}
                                        <button
                                            onClick={() => handleSave(provider)}
                                            disabled={saving}
                                            className="w-full text-sm px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-all font-bold shadow-lg shadow-purple-500/20"
                                        >
                                            {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Save API Key'}
                                        </button>
                                    </div>
                                )}

                                {!isAdding && providerKeys.length === 0 && (
                                    <div className="py-2 text-center border-2 border-dashed border-slate-100 rounded-xl">
                                        <p className="text-[11px] text-slate-400 font-medium">No keys configured</p>
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
        <Card className="overflow-hidden">
            <SectionHeader
                icon={Cpu}
                title="Agent Model Preferences"
                subtitle="Override platform defaults by assigning specific models to each agent role."
            />
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-purple-600" />
                </div>
            ) : (
                <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-y border-slate-100">
                                <th className="text-left py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent Role</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Provider</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Model</th>
                                <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">API Key</th>
                                <th className="text-left py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {prefs.map(pref => {
                                const providerKeys = keys.filter(k => k.provider === pref.provider && k.is_valid);
                                const isSaving = saving === pref.agent_role;
                                return (
                                    <tr key={pref.agent_role} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="py-4 px-6 font-bold text-slate-800 text-xs">
                                            {AGENT_LABELS[pref.agent_role] ?? pref.agent_role}
                                        </td>
                                        <td className="py-4 px-4">
                                            <select
                                                value={pref.provider}
                                                onChange={e => handleUpdate(pref, 'provider', e.target.value)}
                                                className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 bg-white transition-all cursor-pointer"
                                            >
                                                {Object.entries(PROVIDER_LABELS).map(([v, l]) => (
                                                    <option key={v} value={v}>{l}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-4 px-4">
                                            <select
                                                value={pref.model_name}
                                                onChange={e => handleUpdate(pref, 'model_name', e.target.value)}
                                                className="text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 bg-white transition-all cursor-pointer"
                                            >
                                                {MODEL_OPTIONS[pref.provider]?.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-4 px-4">
                                            <select
                                                value={pref.key_id ?? ''}
                                                onChange={e => handleUpdate(pref, 'key_id', e.target.value || '')}
                                                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 bg-white transition-all cursor-pointer min-w-[140px]"
                                            >
                                                <option value="">Platform Default</option>
                                                {providerKeys.map(k => (
                                                    <option key={k.id} value={k.id}>{k.label} ({k.key_hint})</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {isSaving ? (
                                                    <Loader2 size={12} className="animate-spin text-purple-600" />
                                                ) : (
                                                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${pref.is_default ? 'bg-slate-100 text-slate-500' : 'bg-purple-600 text-white shadow-sm'}`}>
                                                        {pref.is_default ? 'Default' : 'Custom'}
                                                    </span>
                                                )}
                                                {!pref.is_default && (
                                                    <button
                                                        onClick={() => handleReset(pref.agent_role)}
                                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Reset to default"
                                                    >
                                                        <Trash2 size={14} />
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
        <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-purple-100 selection:text-purple-900">
            <div className="max-w-5xl mx-auto px-6 py-12 md:py-20">
                {/* Navigation Header */}
                <div className="mb-10 flex items-center justify-between">
                    <Link 
                        href="/chat"
                        className="flex items-center gap-2 text-slate-500 hover:text-purple-600 font-bold text-sm transition-all group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Chat
                    </Link>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100">
                        <Shield size={12} /> Secure Tunnel Active
                    </div>
                </div>

                {/* Page Header */}
                <div className="mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold uppercase tracking-widest mb-4">
                        <SettingsIcon size={14} /> Configuration
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">System Settings</h1>
                    <p className="text-base text-slate-500 max-w-2xl leading-relaxed">
                        Fine-tune your autonomous workforce. Manage API orchestration keys and override default agent brain models for specialized tasks.
                    </p>
                </div>

                <div className="space-y-8">
                    <LLMKeysSection />
                    <AgentPrefsSection />

                    {/* Prompting Guides Reference */}
                    <Card>
                        <SectionHeader
                            icon={BookOpen}
                            title="Prompting Best Practices"
                            subtitle="Official documentation for high-performance agent orchestration from top providers."
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
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
                                    className="block p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-purple-200 hover:bg-white hover:shadow-lg hover:shadow-purple-500/5 transition-all group"
                                >
                                    <p className="text-sm font-bold text-slate-800 group-hover:text-purple-600">{g.provider}</p>
                                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wide">{g.model}</p>
                                    <p className="text-xs text-slate-500 mt-4 leading-relaxed">{g.note}</p>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-purple-500 transition-colors uppercase tracking-widest">Read Docs</span>
                                        <ArrowLeft size={12} className="rotate-180 text-slate-300 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </a>
                            ))}
                        </div>
                    </Card>
                    
                    <div className="text-center py-8">
                        <p className="text-xs text-slate-400 font-medium tracking-wide italic">
                            Platform keys are managed by Proximus-Nova admin. Personal keys take precedence.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
