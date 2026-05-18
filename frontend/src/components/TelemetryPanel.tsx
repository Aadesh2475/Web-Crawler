'use client';

import { useEffect, useState } from 'react';
import { api, TelemetryData } from '@/lib/api';
import { Cpu, HardDrive, Server, Database, Radio, CheckCircle, Clock } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function TelemetryPanel() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [history, setHistory] = useState<{ time: string; cpu: number; ram: number }[]>([]);

  useEffect(() => {
    let active = true;
    const fetchTelemetry = async () => {
      try {
        const res = await api.telemetry();
        if (active) {
          setData(res);
          setHistory(prev => {
            const newHistory = [...prev, { 
              time: new Date().toLocaleTimeString([], { hour12: false }), 
              cpu: res.hardware.cpu_percent, 
              ram: res.hardware.ram_percent 
            }];
            return newHistory.slice(-20); // Keep last 20 data points
          });
        }
      } catch (e) {}
    };

    fetchTelemetry();
    const id = setInterval(fetchTelemetry, 3000); // refresh every 3 seconds for real-time feel
    return () => { active = false; clearInterval(id); };
  }, []);

  if (!data) return <div className="skeleton" style={{ height: 400, borderRadius: 12 }}></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* ── Hardware Gauges ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Cpu size={16} color="var(--blue)" />
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>CPU Utilization</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{data.hardware.cpu_percent}%</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${data.hardware.cpu_percent}%`, height: '100%', background: 'var(--blue)', transition: 'width 0.5s ease' }} />
          </div>
        </div>

        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <HardDrive size={16} color="var(--purple)" />
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Memory Usage</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{data.hardware.ram_percent}%</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{data.hardware.ram_used_gb} / {data.hardware.ram_total_gb} GB</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${data.hardware.ram_percent}%`, height: '100%', background: 'var(--purple)', transition: 'width 0.5s ease' }} />
          </div>
        </div>

      </div>

      {/* ── Real-time Graph ── */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Radio size={16} color="var(--red)" className="pulse-icon" />
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Live Hardware Monitoring</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={history} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--blue)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={[0, 100]} />
            <Tooltip contentStyle={{ fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }} />
            <Area type="monotone" dataKey="cpu" stroke="var(--blue)" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Pipeline Models & Sources ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Server size={16} color="var(--orange)" />
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Active Models & Engines</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.pipeline.models_loaded.map(model => (
              <div key={model} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 6 }}>
                <CheckCircle size={14} color="var(--green)" />
                {model}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Database size={16} color="var(--green)" />
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Active Data Crawlers</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.pipeline.data_sources.map(src => (
              <span key={src} style={{ fontSize: 12, background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border)' }}>
                {src}
              </span>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
