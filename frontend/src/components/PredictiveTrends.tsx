'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Info, BrainCircuit } from 'lucide-react';
import { api, Prediction } from '@/lib/api';

export default function PredictiveTrends() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const res = await api.predictiveTrends();
        setPredictions(res.predictions || []);
      } catch (e) {
        console.error('Failed to fetch predictions', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPredictions();
  }, []);

  if (loading) {
    return (
      <div className="predictive-loading" style={{ padding: '40px', textAlign: 'center' }}>
        <BrainCircuit size={32} className="animate-pulse" style={{ color: 'var(--blue)', marginBottom: 12, opacity: 0.5 }} />
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Calculating neural sentiment trajectories...</p>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="empty-predictions" style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Insufficient historical data to generate reliable forecasts. Collecting more intelligence...</p>
      </div>
    );
  }

  return (
    <div className="predictive-trends-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
      {predictions.map((p) => (
        <div key={p.entity} className="prediction-card" style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border)', 
          borderRadius: 12, 
          padding: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{p.entity}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ 
                  fontSize: 10, 
                  fontWeight: 600, 
                  padding: '2px 6px', 
                  borderRadius: 4, 
                  background: p.trend === 'UP' ? 'rgba(16, 185, 129, 0.1)' : p.trend === 'DOWN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                  color: p.trend === 'UP' ? '#10b981' : p.trend === 'DOWN' ? '#ef4444' : '#6b7280',
                  textTransform: 'uppercase'
                }}>
                  {p.trend} TREND
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Confidence: {p.confidence}%</span>
              </div>
            </div>
            {p.trend === 'UP' ? <TrendingUp size={20} color="#10b981" /> : p.trend === 'DOWN' ? <TrendingDown size={20} color="#ef4444" /> : <Minus size={20} color="#6b7280" />}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Current Sentiment</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: p.current_sentiment > 0 ? '#10b981' : p.current_sentiment < 0 ? '#ef4444' : 'var(--text-primary)' }}>
                {p.current_sentiment > 0 ? '+' : ''}{p.current_sentiment.toFixed(2)}
              </div>
            </div>
            <div style={{ flex: 1, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Projected (24h)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: p.projected_sentiment > 0 ? '#10b981' : p.projected_sentiment < 0 ? '#ef4444' : 'var(--text-primary)' }}>
                {p.projected_sentiment > 0 ? '+' : ''}{p.projected_sentiment.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="momentum-bar" style={{ height: 4, background: 'var(--border)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
            <div style={{ 
              position: 'absolute',
              left: '50%',
              width: `${Math.abs(p.momentum * 50)}%`,
              height: '100%',
              background: p.momentum > 0 ? '#10b981' : '#ef4444',
              transform: p.momentum > 0 ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'all 0.5s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sentiment Momentum</span>
            <span style={{ fontSize: 10, color: p.momentum > 0 ? '#10b981' : p.momentum < 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
              {p.momentum > 0 ? '+' : ''}{p.momentum.toFixed(2)}
            </span>
          </div>

          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(59, 130, 246, 0.2)', background: 'rgba(59, 130, 246, 0.05)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Info size={12} color="#3b82f6" />
            <span style={{ fontSize: 11, color: '#3b82f6', lineHeight: 1.2 }}>
              Mention velocity is {p.velocity.toFixed(1)}x higher than last week average.
            </span>
          </div>
        </div>
      ))}
      <style>{`
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>
    </div>
  );
}
