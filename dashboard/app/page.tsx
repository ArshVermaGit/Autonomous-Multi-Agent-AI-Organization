'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Terminal, ArrowRight, Play, Database, Cpu, Network } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { api, AGENT_COLORS } from '../lib/api'

interface LogEntry {
    text: string
    color: string
}

export default function LandingPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [command, setCommand] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const [isExecuting, setIsExecuting] = useState(false)
    const [logs, setLogs] = useState<LogEntry[]>([
        { text: 'Loading Proximus-Nova kernel...', color: '#6b7280' },
        { text: 'Initializing AI sub-systems: [OK]', color: '#10b981' },
        { text: 'Mounting Model Context Protocol (MCP): [OK]', color: '#10b981' },
        { text: 'Connecting to Amazon Bedrock Nova Foundation: [READY]', color: '#10b981' },
    ])

    const logsEndRef = useRef<HTMLDivElement>(null)

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8082'

    const handleCommandSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!command.trim() || isExecuting) return

        setIsExecuting(true)
        setLogs(prev => [...prev, { text: `\n➜ ${command}`, color: '#f1f5f9' }])
        
        try {
            const project = await api.createProject({
                idea: command,
                budget_usd: 10
            })

            setLogs(prev => [...prev, { text: `[System] Project initialized: ${project.id}`, color: '#ec4899' }])

            const ws = new WebSocket(`${wsUrl}/ws/projects/${project.id}/stream`)
            
            ws.onopen = () => {
                setLogs(prev => [...prev, { text: `[System] Connected to execution stream...`, color: '#10b981' }])
            }

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    const role = data.agent_role || 'System'
                    const prefix = `[${role}] `
                    const color = AGENT_COLORS[role] || '#a1a1aa'
                    
                    setLogs(prev => [...prev, { text: `${prefix}${data.message}`, color }])
                    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                } catch (err) {
                    console.error('Failed to parse WS msg', err)
                }
            }

            ws.onerror = (error) => {
                setLogs(prev => [...prev, { text: `[System Error] WebSocket connection error`, color: '#ef4444' }])
                console.error('WebSocket Error:', error)
            }

            ws.onclose = () => {
                setLogs(prev => [...prev, { text: `[System] Execution stream closed.`, color: '#6b7280' }])
                setIsExecuting(false)
                
                setTimeout(() => {
                    router.push(`/dashboard/projects/${project.id}`)
                }, 4000)
            }

        } catch (error: any) {
            setLogs(prev => [...prev, { text: `[Error] Failed to start orchestrator: ${error.message}`, color: '#ef4444' }])
            setIsExecuting(false)
        }
        
        setCommand('')
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-gray-300 font-sans selection:bg-emerald-500/30 flex flex-col">
            {/* ── Top Bar (App-like header) ───────────────────────── */}
            <div className="h-10 w-full shrink-0 bg-[#0d0d12] border-b border-[#27272a] flex items-center justify-between px-4 sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                    <Terminal size={12} />
                    <span>proximus-nova — bash — 80x24</span>
                </div>
                <div className="flex gap-4">
                     <button onClick={() => router.push('/dashboard')} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                        <Play size={12} fill="currentColor" /> Open Dashboard
                    </button>
                </div>
            </div>

            {/* ── Main Terminal Content ─────────────────────────── */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-5xl mx-auto flex flex-col">
                
                {/* Hero Headers */}
                {!isExecuting && logs.length <= 5 && (
                    <div className="mb-12 mt-12">
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-gray-100 mb-4 font-sans">
                            The fully autonomous <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">AI Engineering Organization.</span>
                        </h1>
                        <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
                            A headless, outcome-driven orchestrator powered by Amazon Nova models. Input a goal, and watch a swarm of agents dynamically generate code, execute terminal commands, and deploy systems locally.
                        </p>
                    </div>
                )}

                {/* Boot Sequence / Live Log */}
                <div className="flex-1 overflow-y-auto mb-6 text-sm font-mono tracking-tight space-y-1">
                    {logs.map((log, i) => (
                        <p key={i} style={{ color: log.color, opacity: log.text.includes('[System]') ? 0.7 : 1 }}>
                            {log.text}
                        </p>
                    ))}
                    <div ref={logsEndRef} />
                </div>

                {/* The "Command Input" component */}
                <form onSubmit={handleCommandSubmit} className="relative z-20 group w-full mb-8 shrink-0">
                    <div className={`absolute -inset-1 rounded-xl blur transition duration-500 opacity-20 ${isFocused ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-40' : 'bg-gray-800'}`}></div>
                    <div className="relative flex items-center bg-[#18181b] border border-[#27272a] rounded-xl p-2 shadow-2xl">
                        <div className="pl-4 pr-3 text-emerald-500 font-bold select-none">➜</div>
                        <input 
                            type="text" 
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            disabled={isExecuting}
                            placeholder={isExecuting ? "Executing task..." : "Type a goal (e.g. 'Build a Next.js landing page for an AI hackathon...')"}
                            className="w-full bg-transparent border-none outline-none text-gray-100 placeholder-gray-600 font-mono text-sm py-3 disabled:opacity-50"
                        />
                        <button type="submit" disabled={isExecuting || !command.trim()} className="hidden sm:flex items-center gap-2 px-4 py-2 ml-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm transition-colors whitespace-nowrap font-sans font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                            Execute <ArrowRight size={14} />
                        </button>
                    </div>
                </form>

                {/* Stats / Tech Stack Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 border-t border-[#27272a] pt-6 pb-2">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-sans">Core Engine</span>
                        <div className="flex items-center gap-2 text-gray-300">
                            <Cpu size={14} className="text-emerald-500" />
                            <span className="font-semibold">Amazon Nova</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-sans">Vector Search</span>
                        <div className="flex items-center gap-2 text-gray-300">
                            <Database size={14} className="text-cyan-500" />
                            <span className="font-semibold">Rust MoE + Nova</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-sans">Orchestrator</span>
                        <div className="flex items-center gap-2 text-gray-300">
                            <Network size={14} className="text-purple-500" />
                            <span className="font-semibold">Go Backend</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-sans">Status</span>
                        <div className="flex items-center gap-2 text-emerald-400">
                            <div className={`w-1.5 h-1.5 rounded-full ${isExecuting ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                            <span className="font-semibold">{isExecuting ? 'Executing' : 'Ready'}</span>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    )
}
