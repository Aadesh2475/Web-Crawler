'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Terminal, Activity, Database, Zap, Globe, Cpu, Search } from 'lucide-react';
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
}

export default function PipelineControls({ onPipelineComplete }: { onPipelineComplete?: () => void }) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'connecting'>('connecting');
  const [stats, setStats] = useState({ fetched: 0, saved: 0, currentTopic: '', currentSource: '' });
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const [realtimeMeta, setRealtimeMeta] = useState({ cpu: 2, latency: 14 });
  const [nextSync, setNextSync] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.status();
        const ingestionJob = data.scheduler?.jobs?.find(j => j.id === 'ingestion_pipeline');
        if (ingestionJob?.next_run) {
          setNextSync(ingestionJob.next_run);
        }
      } catch (err) {
        console.error("Failed to fetch scheduler status", err);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch initial events from Redis to persist state across refreshes
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.pipelineEvents();
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
          
          // Calculate stats from history
          let discovered = 0;
          let savedCount = 0;
          const sources = new Set<string>();
          let running = false;
          let lastTopic = '';
          let lastSource = '';

          data.events.forEach(ev => {
            if (ev.type === 'mining') {
              discovered++;
              if (ev.source) sources.add(ev.source);
              lastSource = ev.source || lastSource;
            } else if (ev.type === 'status') {
              if (ev.topic) lastTopic = ev.topic;
              if (typeof ev.saved === 'number') savedCount += ev.saved;
              
              const msg = ev.message?.toLowerCase() || '';
              if (msg.includes('initialized') || msg.includes('processing') || msg.includes('mining') || msg.includes('indexing')) {
                running = true;
              }
              if (msg.includes('completed') || msg.includes('finished') || msg.includes('indexed')) {
                running = false;
              }
            }
          });

          setStats({
            fetched: discovered,
            saved: savedCount,
            currentTopic: lastTopic,
            currentSource: lastSource
          });
          setActiveSources(sources);
          setIsRunning(running);
        }
      } catch (err) {
        console.error("Failed to fetch pipeline history", err);
      }
    };
    fetchHistory();
  }, [onPipelineComplete]);

  // Force re-render for the countdown timer every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const es = new EventSource('http://localhost:5000/pipeline/stream');
    
    es.onopen = () => setConnectionStatus('connected');
    es.onerror = () => setConnectionStatus('error');

    es.onmessage = (event) => {
      try {
        const data: PipelineEvent = JSON.parse(event.data);
        if (data.type === 'ping') {
           // Simulate slight fluctuations in metadata
           setRealtimeMeta({ 
             cpu: isRunning ? 45 + Math.floor(Math.random() * 30) : 2 + Math.floor(Math.random() * 3),
             latency: 12 + Math.floor(Math.random() * 8)
           });
           return;
        }
        if (data.type === 'connected') return;

        setEvents(prev => [...prev.slice(-49), data]); // Limit to 50 items
        
        // If we receive mining or status events, ensure the UI shows the "Active" state
        // even if the user didn't manually trigger the run.
        if (data.type === 'mining' || (data.type === 'status' && !data.message?.toLowerCase().includes('completed'))) {
           if (!isRunning) setIsRunning(true);
        }

        if (data.type === 'mining') {
          setStats(prev => ({
            ...prev,
            fetched: prev.fetched + 1,
            currentSource: data.source || prev.currentSource
          }));
          setActiveSources(prev => new Set(prev).add(data.source || ''));
        } else if (data.type === 'status') {
          if (data.topic) setStats(prev => ({ ...prev, currentTopic: data.topic! }));
          if (typeof data.saved === 'number' && !isNaN(data.saved)) {
            setStats(prev => ({ ...prev, saved: prev.saved + data.saved! }));
            if (data.saved > 0) onPipelineComplete?.(); 
          }
          const msg = data.message?.toLowerCase() || '';
          if (msg.includes('completed pipeline cycle') || msg.includes('finished ingestion')) {
             // We keep isRunning = true because indexing follows
             onPipelineComplete?.(); 
          }
          if (msg.includes('indexed') || msg.includes('up to date') || msg.includes('intelligence updated')) {
             setIsRunning(false);
             onPipelineComplete?.();
          }
        }
      } catch (err) {
        console.error("SSE Parse Error", err);
      }
    };

    return () => es.close();
  }, [onPipelineComplete]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const runPipeline = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setStats({ fetched: 0, saved: 0, currentTopic: '', currentSource: '' });
    setActiveSources(new Set());
    setEvents([{ type: 'status', message: 'Initiating global intelligence harvest...', timestamp: new Date().toISOString() }]);
    
    try {
      const response = await api.pipelineRun() as any;
      if (response.status === 'error') throw new Error(response.message);
    } catch (err) {
      setEvents(prev => [...prev, { 
        type: 'status', 
        message: `CRITICAL ERROR: ${err instanceof Error ? err.message : 'Failed to reach mining core.'}`, 
        timestamp: new Date().toISOString() 
      }]);
      setIsRunning(false);
    }
  };

  const getTimeRemaining = (target?: string | null) => {
    if (!target) return 'calculating...';
    const diff = new Date(target).getTime() - new Date().getTime();
    if (diff <= 0) return 'starting...';
    
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '';
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts.slice(0, 8);
    }
  };

  return (
    <div className="pipeline-container">
      {/* Control Header */}
      <div className="pipeline-header-card">
        <div className="pipeline-info">
          <div className={`pipeline-icon-wrap ${isRunning ? 'active' : ''}`}>
            <Cpu size={22} />
          </div>
          <div className="pipeline-text">
            <h3 className="pipeline-title">
              Mining Engine
              <span className="autosync-badge">AUTOSYNC ACTIVE</span>
            </h3>
            <p className="pipeline-subtitle-text">
              {isRunning 
                ? `Mining ${stats.currentTopic || 'intelligence'}...` 
                : `System monitoring... Next sync in: ${getTimeRemaining(nextSync)}`}
            </p>
          </div>
        </div>
        <button
          onClick={runPipeline}
          disabled={isRunning}
          className={`btn btn-primary ${isRunning ? 'running' : ''}`}
          style={{ padding: '10px 24px', borderRadius: 12 }}
        >
          {isRunning ? <Activity className="spin" size={16} /> : <Play size={16} fill="currentColor" />}
          {isRunning ? 'CYCLE ACTIVE' : 'RUN PIPELINE'}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="pipeline-metrics">
        <MetricCard icon={<Search size={18} color="var(--blue)" />} label="Discoveries" value={stats.fetched} />
        <MetricCard icon={<Database size={18} color="var(--purple)" />} label="Stored Intel" value={stats.saved} />
        <MetricCard icon={<Globe size={18} color="var(--green)" />} label="Sources Hit" value={activeSources.size} />
      </div>

      <div className="pipeline-body">
        {/* Console */}
        <div className="pipeline-console">
          <div className="console-header">
            <div className="console-label">
              <Terminal size={12} style={{ marginRight: 6 }} />
              CORE_TELEMETRY_STREAM
            </div>
            <div className="console-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
          </div>
          <div ref={scrollRef} className="console-content">
            {events.length === 0 && (
              <div className="console-empty">
                {connectionStatus === 'connecting' ? 'ESTABLISHING HANDSHAKE...' : 
                 connectionStatus === 'error' ? 'CORE OFFLINE - CHECK BACKEND' : 
                 'AWAITING TELEMETRY...'}
              </div>
            )}
            {events.map((ev, i) => (
              <div key={i} className={`console-line ${ev.type}`}>
                <span className="console-time">[{formatTimestamp(ev.timestamp)}]</span>
                {ev.type === 'mining' ? (
                  <span className="console-text">
                    <b style={{ color: 'var(--blue)' }}>MINED</b> » <span style={{ color: '#fff' }}>{ev.source}:</span> {ev.title}
                  </span>
                ) : (
                  <span className="console-text">
                    <b style={{ color: 'var(--green)' }}>LOG</b> » {ev.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Visualizer */}
        <div className="pipeline-visualizer">
           <h4 className="visual-title">
             <Activity size={14} /> LIVE VISUALIZER
           </h4>
           
           <div className="visual-core">
              <div className={`radar-outer ${isRunning ? 'animate' : ''}`}>
                <div className="radar-inner">
                  <div className={`radar-center ${isRunning ? 'active' : ''}`}>
                    <Zap size={24} />
                  </div>
                </div>
                {isRunning && [0,1,2,3].map(i => <div key={i} className="radar-orbit" style={{ transform: `rotate(${i * 90}deg)` }} />)}
              </div>

              <div className="visual-status">
                 <p className="status-label">{isRunning ? 'HARVESTING DATA' : 'ENGINE STANDBY'}</p>
                 <p className="status-meta">LATENCY: {realtimeMeta.latency}ms | BUF: 1024</p>
              </div>

              <div className="visual-progress">
                 <div className="progress-labels">
                    <span>CPU_LOAD</span>
                    <span>{realtimeMeta.cpu}%</span>
                 </div>
                 <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${realtimeMeta.cpu}%` }} />
                 </div>
              </div>
           </div>
        </div>
      </div>

      <style>{`
        .pipeline-container { display: flex; flex-direction: column; gap: 24px; padding-top: 10px; }
        
        .pipeline-header-card {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: var(--shadow-sm);
        }
        
        .pipeline-info { display: flex; align-items: center; gap: 16px; }
        .pipeline-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: var(--bg-tertiary);
          color: var(--text-disabled);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .pipeline-icon-wrap.active {
          background: var(--text-primary);
          color: #fff;
          box-shadow: 0 0 15px rgba(0,0,0,0.1);
        }
        
        .pipeline-title { font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 10px; }
        .autosync-badge {
          font-size: 9px;
          background: var(--blue-bg);
          color: var(--blue);
          padding: 2px 8px;
          border-radius: 20px;
          border: 1px solid rgba(0, 102, 255, 0.1);
          letter-spacing: 0.5px;
          font-weight: 800;
        }
        .pipeline-subtitle-text { font-size: 13px; color: var(--text-muted); margin: 2px 0 0; }
        
        .pipeline-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .metric-card {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow-sm);
        }
        .metric-icon { 
          background: var(--bg-secondary);
          width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .metric-label { font-size: 10px; font-weight: 800; color: var(--text-disabled); text-transform: uppercase; letter-spacing: 1px; margin: 0; }
        .metric-value { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }

        .pipeline-body { 
          display: grid; 
          grid-template-columns: 2fr 1fr; 
          gap: 24px; 
          height: 540px; /* Fixed height for stability */
          overflow: hidden;
          margin-top: 10px;
        }
        
        .pipeline-console {
          background: #0f172a;
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid #1e293b;
          box-shadow: var(--shadow);
          height: 100%;
        }
        .console-header {
          background: #1e293b;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #334155;
        }
        .console-label { color: #94a3b8; font-size: 10px; font-family: monospace; font-weight: 700; display: flex; align-items: center; }
        .console-dots { display: flex; gap: 6px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; opacity: 0.5; }
        .dot.red { background: #ef4444; }
        .dot.yellow { background: #f59e0b; }
        .dot.green { background: #10b981; }

        .console-content {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 12px;
          line-height: 1.6;
          color: #94a3b8;
          scrollbar-width: thin;
        }
        .console-empty { height: 100%; display: flex; align-items: center; justify-content: center; color: #334155; font-weight: 700; letter-spacing: 2px; }
        .console-line { margin-bottom: 4px; display: flex; gap: 12px; word-break: break-all; overflow-x: hidden; }
        .console-time { color: #475569; flex-shrink: 0; }
        .console-text { word-break: break-word; }

        .pipeline-visualizer {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-sm);
          height: 100%; /* Match console height */
        }
        .visual-title { font-size: 11px; font-weight: 800; color: var(--text-disabled); margin-bottom: 30px; display: flex; align-items: center; gap: 8px; }
        .visual-core { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; }
        
        .radar-outer {
          width: 120px; height: 120px;
          border-radius: 50%;
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          position: relative;
        }
        .radar-outer.animate { animation: pulse 2s infinite; }
        .radar-inner {
          width: 90px; height: 90px;
          border-radius: 50%;
          border: 1px solid var(--border-light);
          display: flex; align-items: center; justify-content: center;
        }
        .radar-center {
          width: 60px; height: 60px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          color: var(--text-disabled);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s;
        }
        .radar-center.active { background: var(--text-primary); color: #fff; transform: scale(1.1); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        
        .radar-orbit {
          position: absolute;
          width: 6px; height: 6px;
          background: var(--blue);
          border-radius: 50%;
          top: 0; left: 50%;
          margin-left: -3px;
          transform-origin: 3px 60px;
          animation: orbit 4s linear infinite;
        }

        .visual-status { text-align: center; }
        .status-label { font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0; }
        .status-meta { font-size: 10px; font-family: monospace; color: var(--text-muted); margin: 4px 0 0; }

        .visual-progress { width: 100%; margin-top: 20px; }
        .progress-labels { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; color: var(--text-disabled); margin-bottom: 6px; }
        .progress-bar-bg { width: 100%; height: 6px; background: var(--bg-tertiary); border-radius: 10px; overflow: hidden; }
        .progress-bar-fill { height: 100%; background: var(--text-primary); transition: width 0.5s ease; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0px rgba(0,0,0,0.05); } 100% { box-shadow: 0 0 0 20px rgba(0,0,0,0); } }
        
        .pulse-border { animation: border-pulse 0.6s ease-out; }
        @keyframes border-pulse {
          0% { border-color: var(--border); box-shadow: 0 0 0 0 var(--blue-bg); }
          50% { border-color: var(--blue); box-shadow: 0 0 0 4px var(--blue-bg); }
          100% { border-color: var(--border); box-shadow: 0 0 0 0 var(--blue-bg); }
        }

        @media (max-width: 900px) {
          .pipeline-body { grid-template-columns: 1fr; }
          .pipeline-metrics { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: any, label: string, value: number }) {
  const [isPulsing, setIsPulsing] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 600);
      prevValue.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <div className={`metric-card ${isPulsing ? 'pulse-border' : ''}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
      </div>
    </div>
  );
}
