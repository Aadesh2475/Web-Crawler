'use client';

import { useState, useEffect } from 'react';
import { X, Cpu, Globe, BarChart2, Database, CreditCard, Sliders, Lock, LogIn, CheckCircle2, Zap, LayoutTemplate, FileText } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSignIn: () => void;
  isLoggedIn: boolean;
  userName?: string;
}

type Tab = 'overview' | 'usage' | 'credits' | 'customize';

export default function AgentManager({ onClose, onSignIn, isLoggedIn, userName }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  
  // Customization State
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [temperature, setTemperature] = useState('balanced');
  const [showSources, setShowSources] = useState(true);
  
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [creditDone, setCreditDone] = useState(false);
  
  // Usage State
  const [usage, setUsage] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      // Load Preferences
      fetch('/api/preferences').then(r => r.json()).then(data => {
        if (data.tone) setTone(data.tone);
        if (data.length) setLength(data.length);
        if (data.temperature) setTemperature(data.temperature);
        if (typeof data.showSources === 'boolean') setShowSources(data.showSources);
      }).catch(() => {});

      // Load Usage
      setLoadingUsage(true);
      fetch('/api/usage').then(r => r.json()).then(data => {
        if (!data.error) setUsage(data);
        setLoadingUsage(false);
      }).catch(() => setLoadingUsage(false));
    }
  }, [isLoggedIn]);

  const savePreferences = async () => {
    if (!isLoggedIn) return onSignIn();
    setSavingPrefs(true);
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, length, temperature, showSources })
      });
    } finally {
      setTimeout(() => setSavingPrefs(false), 600);
    }
  };

  const tabs: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Overview',  Icon: Zap       },
    { id: 'usage',     label: 'Usage',     Icon: BarChart2 },
    { id: 'credits',   label: 'Credits',   Icon: CreditCard},
    { id: 'customize', label: 'Customize', Icon: Sliders   },
  ];

  const pill = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{
      flex: 1, padding: '7px 8px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
      border: active ? '1.5px solid var(--blue)' : '1.5px solid var(--border)',
      background: active ? 'var(--blue-bg)' : 'var(--bg)',
      color: active ? 'var(--blue)' : 'var(--text-secondary)',
      fontWeight: active ? 600 : 400, textTransform: 'capitalize', transition: 'all 150ms',
    }}>{label}</button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 520, maxHeight: '85vh', background: 'var(--bg)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={18} style={{ color: 'var(--bg)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>SummyAI Engine</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Workspace Settings & Integrations</div>
          </div>
          {isLoggedIn && (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border)' }}>
              {userName}
            </span>
          )}
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'var(--border-light)', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 50, transition: 'background 150ms' }} onMouseEnter={e => e.currentTarget.style.background='var(--border)'} onMouseLeave={e => e.currentTarget.style.background='var(--border-light)'}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '0 12px' }}>
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, padding: '12px 4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, fontWeight: tab === id ? 600 : 500,
              color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: tab === id ? '2px solid var(--text-primary)' : '2px solid transparent',
              background: 'none', border: 'none', borderBottomStyle: 'solid',
              cursor: 'pointer', transition: 'all 150ms',
            }}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                The <strong>SummyAI Agent</strong> provides access to two distinct intelligence engines. Switch between them in the chat input bar based on your task.
              </p>
              
              <div style={{ padding: '16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--blue-bg)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Cpu size={16}/></div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Newsler (Local Pipeline)</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>RAG Engine</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                  Directly queries your private PostgreSQL/FAISS database. It uses Retrieval-Augmented Generation to search crawled News, Wikipedia, and Reddit articles.
                </p>
                <ul style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <li><strong>Strengths:</strong> Private data, real-time facts, source citations.</li>
                  <li><strong>Best for:</strong> "What are the latest articles on climate?", "Summarize the IPL matches from the database."</li>
                  <li><strong>File Analysis:</strong> Embeds text documents alongside DB chunks.</li>
                </ul>
              </div>

              <div style={{ padding: '16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--purple-bg)', color: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={16}/></div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Gemini 3.1 Pro</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>Cloud LLM</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                  Connects to Google's advanced Generative AI APIs. It does not access your local database, but possesses deep general knowledge and advanced reasoning.
                </p>
                <ul style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <li><strong>Strengths:</strong> Coding, complex logic, broad knowledge.</li>
                  <li><strong>Best for:</strong> "Write a Python script", "Explain quantum physics".</li>
                  <li><strong>File Analysis:</strong> Native support for multimodal images, CSVs, and PDFs.</li>
                </ul>
              </div>
            </div>
          )}

          {tab === 'usage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!isLoggedIn ? (
                 <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <BarChart2 size={32} style={{ color: 'var(--text-disabled)', marginBottom: 12 }} />
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sign in to view usage</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Track your real-time queries and API limits.</div>
                    <button onClick={onSignIn} style={{ padding: '8px 16px', background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
                 </div>
              ) : loadingUsage ? (
                 <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>Loading usage data...</div>
              ) : usage ? (
                 <>
                  {[
                    { label: 'Newsler Engine', Icon: Cpu,   stats: usage.newsler, color: 'var(--blue)' },
                    { label: 'Gemini Cloud',  Icon: Globe, stats: usage.gemini, color: 'var(--purple)' },
                  ].map(({ label, Icon, stats, color }) => (
                    <div key={label} style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Icon size={16} style={{ color }} />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        <div style={{ flex: 1, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>{stats.queries}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>Queries</div>
                        </div>
                        <div style={{ flex: 1, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>{stats.limit - stats.queries}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>Remaining</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontWeight: 500 }}>
                        <span>Limit Quota</span><span>{Math.round((stats.queries / stats.limit) * 100)}% Used</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: Math.min(100, (stats.queries / stats.limit) * 100) + '%', background: color, borderRadius: 99, transition: 'width 1s ease-out' }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '12px 16px', background: 'var(--green-bg)', border: '1px solid #bbf7d0', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <FileText size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
                    <div style={{ fontSize: 13, color: 'var(--green)' }}>
                       <strong>{usage.newsler?.filesAnalyzed || 0} Files Analyzed</strong> across all your conversations this month.
                    </div>
                  </div>
                 </>
              ) : (
                 <div style={{ textAlign: 'center', padding: '20px', color: 'var(--red)' }}>Failed to load usage data.</div>
              )}
            </div>
          )}

          {tab === 'credits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!isLoggedIn && (
                <div style={{ padding: '12px 16px', background: 'var(--blue-bg)', border: '1px solid #bfdbfe', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Lock size={18} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--blue)' }}>Sign in to subscribe</div>
                    <div style={{ fontSize: 12, color: 'var(--blue)', opacity: 0.8 }}>Access higher limits and premium features.</div>
                  </div>
                  <button onClick={onSignIn} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <LogIn size={14} /> Sign In
                  </button>
                </div>
              )}
              {[
                { name: 'Starter',   price: '$4.99',  n: 500,   g: 50   },
                { name: 'Pro',       price: '$9.99',  n: 2000,  g: 200, popular: true },
                { name: 'Unlimited', price: '$24.99', n: 10000, g: 1000 },
              ].map(plan => (
                <div key={plan.name} style={{ padding: '16px', borderRadius: 12, border: plan.popular ? '1.5px solid var(--blue)' : '1.5px solid var(--border)', position: 'relative' }}>
                  {plan.popular && (
                    <span style={{ position: 'absolute', top: -11, left: 16, background: 'var(--blue)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 99 }}>POPULAR</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{plan.name}</span>
                    <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{plan.price}<span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>/mo</span></span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>✓ {plan.n.toLocaleString()} Newsler queries</div>
                    <div>✓ {plan.g} Gemini queries</div>
                    <div>✓ File Analysis included</div>
                  </div>
                  <button onClick={() => { if (!isLoggedIn) { onSignIn(); } else { setCreditDone(true); } }} style={{
                    width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: isLoggedIn ? 'var(--text-primary)' : 'var(--bg-secondary)',
                    color: isLoggedIn ? 'var(--bg)' : 'var(--text-muted)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'transform 100ms'
                  }} onMouseEnter={e => isLoggedIn && (e.currentTarget.style.transform = 'scale(1.02)')} onMouseLeave={e => isLoggedIn && (e.currentTarget.style.transform = 'none')}>
                    {creditDone ? <><CheckCircle2 size={16} /> Redirecting…</> : isLoggedIn ? 'Subscribe Now' : <><Lock size={14} /> Login to Subscribe</>}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'customize' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Response Tone</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>How should the agent speak?</div>
                <div style={{ display: 'flex', gap: 8 }}>{['professional', 'casual', 'technical'].map(t => pill(t, tone === t, () => setTone(t)))}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Output Length</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Control the verbosity of generated text.</div>
                <div style={{ display: 'flex', gap: 8 }}>{['short', 'medium', 'detailed'].map(l => pill(l, length === l, () => setLength(l)))}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Agent Creativity (Temperature)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Precise focuses on facts, Creative generates broader ideas.</div>
                <div style={{ display: 'flex', gap: 8 }}>{['precise', 'balanced', 'creative'].map(t => pill(t, temperature === t, () => setTemperature(t)))}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Source Citations</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Automatically append Newsler sources</div>
                </div>
                <button onClick={() => setShowSources(s => !s)} style={{
                  width: 44, height: 24, borderRadius: 99, background: showSources ? 'var(--blue)' : 'var(--bg-tertiary)',
                  border: '1px solid var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 200ms',
                }}>
                  <div style={{ position: 'absolute', top: 2, left: showSources ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg)', transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>

              <button onClick={savePreferences} style={{ marginTop: 8, padding: '12px', background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                {savingPrefs ? <><CheckCircle2 size={16}/> Saved</> : 'Save Preferences'}
              </button>
              
              {!isLoggedIn && <div style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-muted)' }}>Sign in to sync your preferences across devices.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
