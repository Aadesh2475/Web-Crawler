'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Terminal, Activity, Database, CheckCircle2, AlertCircle, Globe, Zap } from 'lucide-react';
import { api } from '@/lib/api';

interface PipelineEvent {
  type: 'status' | 'mining' | 'connected' | 'ping';
  timestamp?: string;
  message?: string;
  title?: string;
  source?: string;
  topic?: string;
  url?: string;
  saved?: number;
  final?: boolean;
  status?: string;
}

export default function PipelinePage() {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState({ fetched: 0, saved: 0, sources: new Set<string>() });
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Load history from Redis via API client
    api.pipelineEvents().then(res => {
      if (res && res.events && res.events.length > 0) {
          setEvents(res.events);
          
          // Reconstruct stats from history
          let saved = 0;
          let fetched = 0;
          const sources = new Set<string>();
          let running = false;

          res.events.forEach((ev: PipelineEvent) => {
            if (ev.type === 'status' && ev.status === 'started') running = true;
            if (ev.type === 'mining') {
              fetched++;
              if (ev.source) sources.add(ev.source);
            }
            if (ev.saved) saved += ev.saved;
            if (ev.final) running = false;
          });

          setStats({ saved, fetched, sources });
          setIsRunning(running);
        }
      });

    // Connect to SSE stream
    const es = new EventSource('http://localhost:5000/pipeline/stream');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data: PipelineEvent = JSON.parse(event.data);
      if (data.type === 'ping' || data.type === 'connected') return;

      setEvents(prev => [...prev.slice(-49), data]);
      
      if (data.type === 'mining') {
        setStats(prev => ({
          ...prev,
          fetched: prev.fetched + 1,
          sources: new Set(prev.sources).add(data.source || 'Unknown')
        }));
      } else if (data.saved !== undefined) {
        setStats(prev => ({ ...prev, saved: prev.saved + data.saved! }));
        if (data.final) setIsRunning(false);
      }
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const runPipeline = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('http://localhost:5000/pipeline/run', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start pipeline');
    } catch (err) {
      setEvents(prev => [...prev, { type: 'status', message: 'ERROR: Could not trigger pipeline run.', timestamp: new Date().toISOString() }]);
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 animate-in fade-in duration-700">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
            Intelligence Ingestion Center
          </h1>
          <p className="text-slate-500">
            Monitor real-time data mining and NLP enrichment across global networks.
          </p>
        </div>
        <button
          onClick={runPipeline}
          disabled={isRunning}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
            isRunning 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95'
          }`}
        >
          {isRunning ? <Activity className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
          {isRunning ? 'PIPELINE ACTIVE' : 'INITIATE MINING CYCLE'}
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard 
          icon={<Globe className="text-blue-500" />} 
          label="Active Sources" 
          value={stats.sources.size.toString()} 
        />
        <StatCard 
          icon={<Zap className="text-amber-500" />} 
          label="Mined Units" 
          value={stats.fetched.toString()} 
        />
        <StatCard 
          icon={<Database className="text-indigo-500" />} 
          label="Saved Intel" 
          value={stats.saved.toString()} 
        />
        <StatCard 
          icon={<Activity className={isRunning ? "text-green-500" : "text-slate-300"} />} 
          label="System Status" 
          value={isRunning ? "OPERATIONAL" : "STANDBY"} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Console */}
        <div className="lg:col-span-2 flex flex-col h-[600px] bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-800/50 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-indigo-400" />
              <span className="text-xs font-mono font-bold text-slate-400 tracking-wider">LIVE_MINING_STREAM</span>
            </div>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            </div>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 font-mono text-sm space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
            {events.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                <Terminal size={48} className="mb-4" />
                <p>Waiting for pipeline activity...</p>
              </div>
            )}
            {events.map((ev, i) => (
              <div key={i} className={`animate-in slide-in-from-left-2 duration-300 ${ev.type === 'mining' ? 'text-indigo-300' : 'text-emerald-400'}`}>
                <span className="text-slate-600 mr-2">[{ev.timestamp?.split('T')[1].split('.')[0]}]</span>
                {ev.type === 'mining' ? (
                  <>
                    <span className="text-amber-500 font-bold">MINE_SUCCESS</span>
                    <span className="text-slate-400 mx-2">|</span>
                    <span className="text-blue-400">[{ev.source}]</span>
                    <span className="mx-2">→</span>
                    <span className="italic">"{ev.title}"</span>
                  </>
                ) : (
                  <>
                    <span className="text-emerald-500 font-bold">SYS_LOG</span>
                    <span className="text-slate-400 mx-2">|</span>
                    <span>{ev.message}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Visual Flair / Sidebar */}
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Activity size={18} className="text-indigo-600" />
              Real-time Analysis
            </h3>
            <div className="space-y-4">
              {Array.from(stats.sources).slice(-5).map(source => (
                <div key={source} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{source}</span>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`w-1 h-3 rounded-full ${isRunning ? 'bg-indigo-500 animate-pulse' : 'bg-slate-200'}`} style={{ animationDelay: `${i * 100}ms` }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-600 rounded-lg text-white">
                  <Zap size={20} />
                </div>
                <div>
                   <h4 className="font-bold text-indigo-900">ML Optimization</h4>
                   <p className="text-xs text-indigo-700">Parallel processing active</p>
                </div>
             </div>
             <p className="text-sm text-indigo-800 leading-relaxed">
               System is currently leveraging multi-threaded extraction for body content and GPU-accelerated embedding generation.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 transition-hover hover:shadow-md">
      <div className="p-3 bg-slate-50 rounded-xl">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}
