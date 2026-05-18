'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Compass, ShieldCheck, RefreshCw, Sliders, Globe, Activity, Loader2, ArrowUpRight } from 'lucide-react';
import { api, RiskForecast } from '@/lib/api';

export default function PredictiveRiskDesk() {
  const [forecast, setForecast] = useState<RiskForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string>('');

  const fetchForecast = async (topic: string, forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.riskDesk(topic, forceRefresh);
      setForecast(res);
    } catch (e) {
      console.error('Failed to load risk forecast:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchForecast(activeTopic);
  }, [activeTopic]);

  const handleRefresh = () => {
    fetchForecast(activeTopic, true);
  };

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ea580c';
      case 'critical': return '#dc2626';
      default: return 'var(--blue)';
    }
  };

  const getRiskBg = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low': return 'rgba(16, 185, 129, 0.08)';
      case 'medium': return 'rgba(245, 158, 11, 0.08)';
      case 'high': return 'rgba(234, 88, 12, 0.08)';
      case 'critical': return 'rgba(220, 38, 38, 0.08)';
      default: return 'rgba(59, 130, 246, 0.08)';
    }
  };

  // Safe markdown converter for basic bolding, headers, and bullet points
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let trimmed = line.trim();
      if (trimmed.startsWith('###')) {
        return <h4 key={idx} style={{ fontSize: 15, fontWeight: 700, marginTop: 16, marginBottom: 8, color: 'var(--text-primary)' }}>{trimmed.replace('###', '').trim()}</h4>;
      }
      if (trimmed.startsWith('##')) {
        return <h3 key={idx} style={{ fontSize: 17, fontWeight: 700, marginTop: 20, marginBottom: 10, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>{trimmed.replace('##', '').trim()}</h3>;
      }
      if (trimmed.startsWith('#')) {
        return <h2 key={idx} style={{ fontSize: 20, fontWeight: 800, marginTop: 24, marginBottom: 12, color: 'var(--text-primary)' }}>{trimmed.replace('#', '').trim()}</h2>;
      }
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        return (
          <li key={idx} style={{ marginLeft: 16, fontSize: 13, lineHeight: 1.6, marginBottom: 6, color: 'var(--text-secondary)' }}>
            {processInlineMarkdown(trimmed.substring(1).trim())}
          </li>
        );
      }
      if (trimmed === '') return <div key={idx} style={{ height: 8 }} />;
      return <p key={idx} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10, color: 'var(--text-secondary)' }}>{processInlineMarkdown(trimmed)}</p>;
    });
  };

  const processInlineMarkdown = (text: string) => {
    // Basic bold processor
    const parts = text.split('**');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{part}</strong>;
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, padding: 40 }}>
        <Loader2 size={40} className="animate-spin" style={{ color: 'var(--blue)', marginBottom: 16 }} />
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Synthesizing Risk Intelligence Forecast...</h4>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Querying dynamic global sentiment structures and co-occurrence vectors</p>
      </div>
    );
  }

  const rLevel = forecast?.global_risk_level || 'medium';
  const rColor = getRiskColor(rLevel);
  const rBg = getRiskBg(rLevel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Risk Desk Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={24} style={{ color: rColor }} />
            Geopolitical & Financial Predictive Risk Desk
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Real-time vector cluster forecasting, coverage acceleration indexes, and dynamic hedging recommendations.
          </p>
        </div>

        {/* Refresh controls */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            color: 'var(--text-primary)',
            transition: 'all 0.2s',
          }}
          className="refresh-btn-hover"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Regenerate Matrix
        </button>
      </div>

      {/* Topic Filters */}
      <div style={{ display: 'flex', gap: 8, padding: 4, background: 'var(--bg-tertiary)', borderRadius: 10, alignSelf: 'flex-start', border: '1px solid var(--border)' }}>
        {[
          { label: 'All Clusters', value: '' },
          { label: 'Geopolitics', value: 'geopolitics' },
          { label: 'Finance & Markets', value: 'finance' },
          { label: 'Technology', value: 'technology' },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTopic(t.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTopic === t.value ? 'var(--bg-secondary)' : 'transparent',
              color: activeTopic === t.value ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: activeTopic === t.value ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Top Section: Systemic Risk State & Core Gauge */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Risk Card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative Corner Glow */}
          <div style={{
            position: 'absolute', top: -30, right: -30,
            width: 120, height: 120, borderRadius: '50%',
            background: rColor, opacity: 0.05, filter: 'blur(30px)',
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 6,
              background: rBg,
              color: rColor,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: rColor }} className="animate-ping" />
              SYSTEMIC RISK LEVEL: {rLevel}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
              Last Calculated: {forecast?.last_updated ? new Date(forecast.last_updated).toLocaleTimeString() : 'Just now'}
            </span>
          </div>

          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Systemic Core Brief</h3>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {forecast?.summary}
          </p>

          {/* Core Markdown Summary Text */}
          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 16,
            marginTop: 8,
          }}>
            {forecast && renderMarkdown(forecast.forecast_text)}
          </div>
        </div>

        {/* Gauge Widget */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          textAlign: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-muted)' }}>INTELLIGENCE THREAT MATRIX INDEX</h3>
          
          {/* Radial Meter Mock */}
          <div style={{ position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifySelf: 'center' }}>
            <svg width="180" height="180" viewBox="0 0 180 180">
              {/* Background circle */}
              <circle cx="90" cy="90" r="75" fill="none" stroke="var(--border)" strokeWidth="12" />
              {/* Foreground circle indicator */}
              <circle 
                cx="90" cy="90" r="75" 
                fill="none" 
                stroke={rColor} 
                strokeWidth="12" 
                strokeDasharray="471" 
                strokeDashoffset={471 - (471 * (forecast?.risk_score || 50)) / 100}
                strokeLinecap="round" 
                transform="rotate(-90 90 90)"
                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                {forecast?.risk_score}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase' }}>
                Risk Quotient
              </span>
            </div>
          </div>

          <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: 10, padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <AlertTriangle size={16} style={{ color: rColor }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.3 }}>
              Score accounts for coverage acceleration ratios, mention velocity momentum, and negative sentiment skew.
            </span>
          </div>
        </div>
      </div>

      {/* Middle Section: Thematic Cluster Signals */}
      {forecast?.key_clusters && forecast.key_clusters.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Activity size={16} style={{ color: 'var(--blue)' }} />
            Identified Emerging Cluster Signals
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {forecast.key_clusters.map((c, i) => (
              <div key={i} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.theme}</h4>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: c.signal_velocity === 'High' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(107, 114, 128, 0.08)',
                    color: c.signal_velocity === 'High' ? '#ef4444' : 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}>
                    {c.signal_velocity} Velocity
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                  {c.summary}
                </p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderTop: '1px solid var(--border)',
                  paddingTop: 10,
                  fontSize: 11,
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Polarization:</span>
                  <span style={{
                    fontWeight: 700,
                    color: c.sentiment < -0.1 ? '#ef4444' : c.sentiment > 0.1 ? '#10b981' : 'var(--text-muted)'
                  }}>
                    {c.sentiment > 0 ? '+' : ''}{c.sentiment.toFixed(2)}
                  </span>
                  <div style={{
                    flex: 1,
                    height: 4,
                    background: 'var(--border)',
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      width: `${Math.abs(c.sentiment * 50)}%`,
                      height: '100%',
                      background: c.sentiment > 0 ? '#10b981' : '#ef4444',
                      transform: c.sentiment > 0 ? 'translateX(0)' : 'translateX(-100%)',
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Section: Predictive Risk Events Matrix */}
      {forecast?.risk_events && forecast.risk_events.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Compass size={16} style={{ color: 'var(--blue)' }} />
            24-48h Actionable Threat Matrix
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {forecast.risk_events.map((e, idx) => {
              const eColor = getRiskColor(e.impact);
              const eBg = getRiskBg(e.impact);
              return (
                <div key={idx} style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${eColor}`,
                  borderRadius: '4px 12px 12px 4px',
                  padding: 20,
                  display: 'grid',
                  gridTemplateColumns: '1fr 280px',
                  gap: 24,
                }}>
                  {/* Left Column: Event details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: eBg,
                        color: eColor,
                        textTransform: 'uppercase'
                      }}>
                        {e.impact} Impact
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Globe size={12} /> {e.geography}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        • {e.timeframe}
                      </span>
                    </div>

                    <h4 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {e.title}
                    </h4>

                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
                      {e.description}
                    </p>
                  </div>

                  {/* Right Column: Probability and Hedging Strategy */}
                  <div style={{
                    borderLeft: '1px solid var(--border)',
                    paddingLeft: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>PROBABILITY QUOTIENT</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>{e.probability}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${e.probability}%`, background: eColor, borderRadius: 3 }} />
                      </div>
                    </div>

                    <div style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ShieldCheck size={10} />
                        HEDGING POSITION/MITIGATION
                      </span>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {e.hedging_strategy}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CSS Pulse styles */}
      <style>{`
        .animate-ping {
          animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .refresh-btn-hover:hover {
          background: var(--bg-tertiary) !important;
          border-color: var(--text-muted) !important;
        }
      `}</style>
    </div>
  );
}
