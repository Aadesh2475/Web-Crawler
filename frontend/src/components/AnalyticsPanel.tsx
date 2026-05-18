'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, BarChart2 } from 'lucide-react';
import VIPLeaderboard from './VIPLeaderboard';
import MarketOverlayChart from './MarketOverlayChart';
import PredictiveTrends from './PredictiveTrends';
import PredictiveRiskDesk from './PredictiveRiskDesk';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#dc2626', '#0891b2'];
const TOPIC_COLORS: Record<string, string> = {};

function getTopicColor(topic: string, idx: number) {
  if (!TOPIC_COLORS[topic]) {
    TOPIC_COLORS[topic] = COLORS[idx % COLORS.length];
  }
  return TOPIC_COLORS[topic];
}

// ─── Timeline Chart ──────────────────────────────────────────────────────────

interface TimelineRow { date: string; topic: string; count: number; }

function TimelineChart({ days = 14 }: { days?: number }) {
  const [data, setData] = useState<Record<string, number | string>[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/stats/timeline?days=${days}`)
      .then(r => r.json())
      .then(json => {
        const rows: TimelineRow[] = json.data?.data ?? [];
        // Pivot: { date → { topic: count } }
        const pivot: Record<string, Record<string, number>> = {};
        const topicSet = new Set<string>();
        for (const row of rows) {
          topicSet.add(row.topic);
          if (!pivot[row.date]) pivot[row.date] = {};
          pivot[row.date][row.topic] = row.count;
        }
        const topicList = Array.from(topicSet);
        setTopics(topicList);
        setData(
          Object.entries(pivot)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, counts]) => ({ date, ...counts }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />;
  if (!data.length) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No timeline data yet.</p>;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
        <Tooltip
          contentStyle={{ fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
        {topics.map((t, i) => (
          <Line
            key={t}
            type="monotone"
            dataKey={t}
            stroke={getTopicColor(t, i)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Source Breakdown Chart ───────────────────────────────────────────────────

interface SourceRow { topic: string; source: string; count: number; }

function SourcePieChart({ topic }: { topic?: string | null }) {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = topic ? `?topic=${encodeURIComponent(topic)}` : '';
    fetch(`${API}/stats/sources${q}`)
      .then(r => r.json())
      .then(json => {
        const rows: SourceRow[] = json.data?.data ?? [];
        // Aggregate by source (across topics if no filter)
        const agg: Record<string, number> = {};
        for (const row of rows) {
          agg[row.source] = (agg[row.source] ?? 0) + row.count;
        }
        setData(Object.entries(agg).map(([name, value]) => ({ name, value })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topic]);

  if (loading) return <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />;
  if (!data.length) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No source data yet.</p>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Trending Topics Bar Chart ────────────────────────────────────────────────

interface TrendRow { topic: string; recent_count: number; }

function TrendingChart() {
  const [data, setData] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/topics/trending`)
      .then(r => r.json())
      .then(json => setData(json.trending ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="skeleton" style={{ height: 160, borderRadius: 8 }} />;
  if (!data.length) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No trending data (run pipeline first).</p>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis dataKey="topic" type="category" tick={{ fontSize: 11, fill: 'var(--text-primary)', fontWeight: 500 }} width={120} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: 'var(--bg-secondary)', opacity: 0.4 }}
          contentStyle={{ fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}
        />
        <Bar dataKey="recent_count" name="Articles (24h)" radius={[0, 6, 6, 0]} barSize={20}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Shared UI Components ───────────────────────────────────────────────────

function AnalyticsCard({ title, icon: Icon, children, subtitle }: { title: string; icon?: any; children: React.ReactNode; subtitle?: string }) {
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {Icon && <Icon size={16} color="var(--blue)" />}
            <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h4>
          </div>
          {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

interface Props {
  activeTopic: string | null;
}

// ─── Analytics Dashboard Panel ────────────────────────────────────────────────

export default function AnalyticsPanel({ activeTopic }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
      
      <AnalyticsCard 
        title="Collection Intelligence Timeline" 
        subtitle="Articles indexed per category over the last 14 days"
        icon={TrendingUp}
      >
        <TimelineChart />
      </AnalyticsCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24 }}>
        <AnalyticsCard title="Source Distribution" subtitle="Breakdown by origin for current focus" icon={PieIcon}>
          <SourcePieChart topic={activeTopic} />
        </AnalyticsCard>
        
        <AnalyticsCard title="Topic Velocity" subtitle="Highest volume categories crawled in last 24h" icon={BarChart2}>
          <div style={{ minHeight: 240 }}>
            <TrendingChart />
          </div>
        </AnalyticsCard>
      </div>
      
      <AnalyticsCard title="Entity Recognition (NER) Leaderboard" subtitle="Most influential People and Organizations in current news cycle">
        <VIPLeaderboard />
      </AnalyticsCard>
      
      <AnalyticsCard title="Market Sentiment Correlation" subtitle="AI Sentiment vs Mock Asset Price Performance">
        <MarketOverlayChart />
      </AnalyticsCard>

      <AnalyticsCard title="Neural Sentiment Forecasting" subtitle="Predictive trajectories based on sentiment momentum and mention velocity">
        <PredictiveTrends />
      </AnalyticsCard>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 32, marginTop: 16 }}>
        <PredictiveRiskDesk />
      </div>
    </div>
  );
}
