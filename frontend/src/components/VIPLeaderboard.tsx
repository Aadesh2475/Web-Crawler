'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Users, Building, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Entity {
  name: string;
  mentions: number;
  avg_sentiment: number;
}

export default function VIPLeaderboard() {
  const [data, setData] = useState<{ people: Entity[]; organizations: Entity[] } | null>(null);
  const [days, setDays] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchEntities = async () => {
      setLoading(true);
      try {
        const res = await api.statsEntities(days);
        if (active) setData(res);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchEntities();
    return () => { active = false; };
  }, [days]);

  const SentimentBadge = ({ score }: { score: number }) => {
    if (score > 0.3) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)', fontSize: 12, fontWeight: 600 }}>
          <TrendingUp size={14} /> {(score * 100).toFixed(0)}% Pos
        </div>
      );
    } else if (score < -0.3) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--red)', fontSize: 12, fontWeight: 600 }}>
          <TrendingDown size={14} /> {(score * 100).toFixed(0)}% Neg
        </div>
      );
    } else {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
          <Minus size={14} /> Neutral
        </div>
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <select 
          value={days} 
          onChange={(e) => setDays(Number(e.target.value))}
          style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border)', 
            borderRadius: 6, 
            padding: '4px 8px', 
            fontSize: 11, 
            fontWeight: 500,
            color: 'var(--text-primary)',
            outline: 'none'
          }}
        >
          <option value={1}>24h Window</option>
          <option value={3}>3d Window</option>
          <option value={7}>7d Window</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          <div className="skeleton" style={{ height: 240, borderRadius: 12 }}></div>
          <div className="skeleton" style={{ height: 240, borderRadius: 12 }}></div>
        </div>
      ) : data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          
          {/* People Column */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Users size={14} color="var(--purple)" />
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Top People</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
              {data.people.length > 0 ? data.people.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border-light)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? 'var(--blue)' : 'var(--text-muted)', width: 20 }}>{i+1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 500 }}>{p.mentions} mentions</div>
                    <SentimentBadge score={p.avg_sentiment} />
                  </div>
                </div>
              )) : <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>No mentions detected.</p>}
            </div>
          </div>

          {/* Orgs Column */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Building size={14} color="var(--blue)" />
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Top Organizations</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
              {data.organizations.length > 0 ? data.organizations.map((o, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border-light)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? 'var(--blue)' : 'var(--text-muted)', width: 20 }}>{i+1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{o.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 500 }}>{o.mentions} mentions</div>
                    <SentimentBadge score={o.avg_sentiment} />
                  </div>
                </div>
              )) : <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>No mentions detected.</p>}
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
}
