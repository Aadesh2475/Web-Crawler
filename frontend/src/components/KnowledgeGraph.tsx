'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Network, RefreshCw, ArrowLeft, ExternalLink, Building2, User, Globe2, Layers, Briefcase, Activity } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import ForceGraph2D with SSR disabled to prevent Next.js SSR build crashes
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  type: string;
  val: number;
  mentions: number;
  avg_sentiment: number;
  has_details?: boolean;
  is_focus?: boolean;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  is_category?: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  PERSON: '#475569',   // Slate Grey
  ORG: '#0f172a',      // Slate Black
  GPE: '#64748b',      // Lighter Slate
  CATEGORY: '#38bdf8', // Light Blue
};

const TOPICS = ['', 'technology', 'geopolitics', 'finance', 'artificial intelligence', 'climate change', 'health'];

export default function KnowledgeGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  
  const [graphData, setGraphData] = useState<{nodes: GraphNode[], links: GraphLink[], article_count: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  
  // Drill-down state
  const [focusEntity, setFocusEntity] = useState<string | null>(null);
  const [entityDetails, setEntityDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [hovered, setHovered] = useState<any | null>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 500 });

  // Measure container using ResizeObserver to adapt smoothly on layout resizes
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ 
          w: Math.max(entry.contentRect.width, 400), 
          h: Math.max(entry.contentRect.height, 400) 
        });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.knowledgeGraph(days, '', focusEntity || '');
      setGraphData(data);
    } catch (e) {
      console.error('Knowledge graph fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [days, focusEntity]);

  useEffect(() => { 
    fetchGraph(); 
  }, [fetchGraph]);

  const loadEntityDetails = async (name: string) => {
    setLoadingDetails(true);
    try {
      const res = await api.entityDetails(name);
      setEntityDetails(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleNodeClick = useCallback((node: any) => {
    if (node.type === 'CATEGORY') return;
    setFocusEntity(node.id);
    loadEntityDetails(node.id);
  }, []);

  // Configure and adjust physics forces & zoom whenever graph data updates
  useEffect(() => {
    if (fgRef.current && graphData && graphData.nodes.length > 0) {
      fgRef.current.d3Force('charge').strength(-600);
      fgRef.current.d3Force('link').distance(120);
      
      // Allow simulation to settle briefly and fit viewport bounds smoothly
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit(400, 50);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [graphData]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: focusEntity ? '1fr 380px' : '1fr', gap: 24, marginTop: 24 }}>
      
      {/* MAIN GRAPH AREA */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Network size={18} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                {focusEntity ? `Neural View: ${focusEntity}` : 'Entity Knowledge Graph'}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                {graphData ? `${graphData.nodes.length} nodes · ${graphData.links.length} connections` : 'Building graph…'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {focusEntity && (
              <button
                onClick={() => { setFocusEntity(null); setEntityDetails(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <ArrowLeft size={14} /> Back to Global View
              </button>
            )}

            {!focusEntity && (
              <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
                <div 
                  onClick={() => setTimeDropdownOpen(!timeDropdownOpen)}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 8, 
                    padding: '8px 16px', 
                    fontSize: 13, 
                    fontWeight: 500,
                    color: 'var(--text-primary)', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  {days === 3 ? 'Past 3 Days' : days === 7 ? 'Past 7 Days' : 'Past 14 Days'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: timeDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                
                {timeDropdownOpen && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    right: 0, 
                    marginTop: 6,
                    background: 'var(--bg)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 8, 
                    padding: '4px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    zIndex: 50,
                    minWidth: 140
                  }}>
                    {[3, 7, 14].map(d => (
                      <div 
                        key={d}
                        onClick={() => { setDays(d); setTimeDropdownOpen(false); }}
                        style={{
                          padding: '8px 12px',
                          fontSize: 13,
                          fontWeight: 500,
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: days === d ? 'var(--bg-tertiary)' : 'transparent',
                          color: days === d ? 'var(--blue)' : 'var(--text-primary)',
                        }}
                        onMouseEnter={e => { if (days !== d) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                        onMouseLeave={e => { if (days !== d) e.currentTarget.style.background = 'transparent'; }}
                      >
                        Past {d} Days
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={fetchGraph} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 16, background: 'var(--bg-secondary)', flexWrap: 'wrap' }}>
          {Object.entries(TYPE_COLOR).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{type}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
            {!focusEntity ? 'Click nodes to drill down' : 'Showing direct relationships'}
          </div>
        </div>

        {/* Graph Canvas */}
        <div className="graph-container" style={{ position: 'relative', width: '100%', height: 'calc(100vh - 220px)', minHeight: 400, background: 'var(--bg-secondary, #f8fafc)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--text-muted)' }}>
                <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : graphData && graphData.nodes.length > 0 ? (
              <ForceGraph2D
                ref={fgRef}
                graphData={{ nodes: graphData.nodes, links: graphData.links }}
                width={dimensions.w}
                height={dimensions.h}
                backgroundColor="transparent"
                nodeRelSize={4}
                nodeColor={(node: any) => TYPE_COLOR[node.type as string] || '#6b7280'}
                nodeVal={(node: any) => node.val}
                linkWidth={(link: any) => link.is_category ? 1.5 : Math.min(link.value * 0.8, 5)}
                linkColor={(link: any) => link.is_category ? 'rgba(234, 88, 12, 0.3)' : 'rgba(100,100,120,0.2)'}
                linkLineDash={(link: any) => link.is_category ? [4, 4] : null}
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                  const label = node.label as string;
                  const fontSize = Math.max(12 / globalScale, 4);
                  const radius = Math.sqrt(node.val) * 3;
                  const color = TYPE_COLOR[node.type as string] || '#6b7280';

                  // Glow effects
                  if (node.is_focus) {
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 25;
                  } else if (node.avg_sentiment > 0.3) {
                    ctx.shadowColor = 'rgba(22, 163, 74, 0.8)';
                    ctx.shadowBlur = 15;
                  } else if (node.avg_sentiment < -0.3) {
                    ctx.shadowColor = 'rgba(220, 38, 38, 0.8)';
                    ctx.shadowBlur = 15;
                  } else if (node.has_details && !focusEntity) {
                    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
                    ctx.shadowBlur = 10;
                  }

                  ctx.beginPath();
                  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                  ctx.fillStyle = color;
                  ctx.fill();
                  ctx.shadowBlur = 0;

                  // Border for interactable nodes
                  if (node.has_details || node.is_focus) {
                    ctx.lineWidth = 1.5 / globalScale;
                    ctx.strokeStyle = '#ffffff';
                    ctx.stroke();
                  }

                  if (globalScale > 0.6 || node.is_focus) {
                    const isDark = typeof document !== 'undefined' && 
                                   (document.documentElement.classList.contains('dark') || 
                                    document.body.classList.contains('dark'));
                    ctx.font = `${node.is_focus ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
                    ctx.fillStyle = node.is_focus ? (isDark ? '#ffffff' : '#000000') : (isDark ? '#e2e8f0' : '#111827');
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(
                      label.length > 18 ? label.slice(0, 16) + '…' : label, 
                      node.x, 
                      node.y + radius + fontSize + (node.is_focus ? 4 : 0)
                    );
                  }
                }}
                onNodeHover={(node: any) => {
                  setHovered(node || null);
                  if (containerRef.current) {
                    containerRef.current.style.cursor = node && (node.has_details || node.type !== 'CATEGORY') ? 'pointer' : 'default';
                  }
                }}
                onNodeClick={handleNodeClick}
                cooldownTicks={100}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <Network size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p>No entity data found.</p>
              </div>
            )}
          </div>

          {/* Hover tooltip */}
          {hovered && (
            <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', minWidth: 180, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[hovered.type] || '#6b7280' }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{hovered.label}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                {hovered.type !== 'CATEGORY' && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mentions</div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{hovered.mentions}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sentiment</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: hovered.avg_sentiment > 0 ? 'var(--green)' : hovered.avg_sentiment < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                      {hovered.avg_sentiment > 0 ? '+' : ''}{hovered.avg_sentiment}
                    </div>
                  </>
                )}
              </div>
              {!focusEntity && hovered.type !== 'CATEGORY' && (
                <div style={{ marginTop: 8, fontSize: 10, color: '#475569', fontWeight: 600 }}>
                  Click to explore relationships →
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SIDE PANEL (ENTITY DETAILS) */}
      {focusEntity && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 600 }}>
          {loadingDetails ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : entityDetails ? (
            <>
              {/* Header */}
              <div style={{ padding: 20, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: TYPE_COLOR[entityDetails.metadata?.type || 'ORG'], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                    {entityDetails.metadata?.type === 'PERSON' ? <User size={24} /> : 
                     entityDetails.metadata?.type === 'GPE' ? <Globe2 size={24} /> : <Building2 size={24} />}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{entityDetails.entity}</h2>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 10, marginTop: 4, display: 'inline-block' }}>
                      {entityDetails.metadata?.sector || entityDetails.metadata?.type || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Metadata Grid */}
                {entityDetails.metadata && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                    {entityDetails.metadata.ceo && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><User size={12}/> CEO/Leader</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{entityDetails.metadata.ceo}</div>
                      </div>
                    )}
                    {entityDetails.metadata.market_cap && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Activity size={12}/> Valuation</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{entityDetails.metadata.market_cap}</div>
                      </div>
                    )}
                    {entityDetails.metadata.net_worth && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Activity size={12}/> Net Worth</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{entityDetails.metadata.net_worth}</div>
                      </div>
                    )}
                    {entityDetails.metadata.employees && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={12}/> Size</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{entityDetails.metadata.employees}</div>
                      </div>
                    )}
                    {entityDetails.metadata.country && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Globe2 size={12}/> Location</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{entityDetails.metadata.country}</div>
                      </div>
                    )}
                  </div>
                )}
                
                {entityDetails.metadata?.services && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Layers size={12}/> Key Services/Products</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {entityDetails.metadata.services.map((s: string) => (
                        <span key={s} style={{ fontSize: 11, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 12 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* News Feed */}
              <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={14} color="#475569" /> Real-time Intel (Last 7 Days)
                </h3>
                
                {entityDetails.news?.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No recent news found for this entity.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {entityDetails.news?.map((art: any) => (
                      <div key={art.id} style={{ padding: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px 0', lineHeight: 1.4 }}>{art.title}</h4>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: art.sentiment > 0 ? 'rgba(22,163,74,0.1)' : art.sentiment < 0 ? 'rgba(220,38,38,0.1)' : 'var(--bg-tertiary)', color: art.sentiment > 0 ? 'var(--green)' : art.sentiment < 0 ? 'var(--red)' : 'var(--text-muted)', flexShrink: 0 }}>
                            {art.sentiment > 0 ? '+' : ''}{art.sentiment}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {art.summary || 'No AI summary generated yet.'}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{art.source}</span>
                          {art.url && (
                            <a href={art.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#475569', textDecoration: 'none', fontWeight: 500 }}>
                              Visit Source <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
              Failed to load entity details.
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
