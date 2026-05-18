'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { api, Stats, SystemStatus, QueryResult as QR } from '@/lib/api';
import StatsBar           from '@/components/StatsBar';
import Sidebar            from '@/components/Sidebar';
import QueryResult        from '@/components/QueryResult';
import ArticleFeed        from '@/components/ArticleFeed';
import PipelineControls   from '@/components/PipelineControls';
import AnalyticsPanel     from '@/components/AnalyticsPanel';
import SummyAIPanel       from '@/components/SummyAIPanel';
import AgentManager       from '@/components/AgentManager';
import TelemetryPanel     from '@/components/TelemetryPanel';
import KnowledgeGraph     from '@/components/KnowledgeGraph';
import PredictiveTrends   from '@/components/PredictiveTrends';
import DossierCanvas      from '@/components/DossierCanvas';
import { Download } from 'lucide-react';

type View = 'feed' | 'pipeline' | 'analytics' | 'telemetry' | 'graph' | 'summy' | 'dossier';

const MIN_AI_W = 280;
const MAX_AI_W = 560;
const DEFAULT_AI_W = 340;

export default function DashboardPage() {
  const { data: session } = useSession();

  const [topics, setTopics]           = useState<string[]>([]);
  const [topicStats, setTopicStats]   = useState<Record<string, number>>({});
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [status, setStatus]           = useState<SystemStatus | null>(null);
  const [apiOnline, setApiOnline]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [view, setView]               = useState<View>('feed');
  const [queryResult, setQueryResult] = useState<QR | null>(null);
  const [feedKey, setFeedKey]         = useState(0);

  // SummyAI — closed by default
  const [aiOpen, setAiOpen]       = useState(false);
  const [aiWidth, setAiWidth]     = useState(DEFAULT_AI_W);
  const [showManager, setShowManager] = useState(false);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, w: DEFAULT_AI_W });

  // ── Drag-to-resize ─────────────────────────────────────
  const onDragStart = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, w: aiWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = dragStart.current.x - e.clientX;         // drag left = wider
      const newW  = Math.min(MAX_AI_W, Math.max(MIN_AI_W, dragStart.current.w + delta));
      setAiWidth(newW);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const fetchMeta = useCallback(async () => {
    setLoading(true);
    try {
      const [topicsData, statsData, topicStatsData] = await Promise.allSettled([
        api.topics(), api.stats(), api.topicsStats(),
      ]);
      if (topicsData.status     === 'fulfilled') setTopics(topicsData.value.topics);
      if (statsData.status      === 'fulfilled') setStats(statsData.value);
      if (topicStatsData.status === 'fulfilled') setTopicStats(topicStatsData.value);
      try { setStatus(await api.status()); } catch { /**/ }
      setApiOnline(true);
    } catch { setApiOnline(false); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchMeta();
    const id = setInterval(fetchMeta, 60_000);
    return () => clearInterval(id);
  }, [fetchMeta]);

  const handleExport = (fmt: 'csv' | 'json') => {
    const topic = activeTopic || topics[0];
    if (!topic) return;
    window.open(api.exportArticles(topic, fmt), '_blank');
  };

  return (
    <>
      {/* ── Shell: sidebar | main | [AI panel] ── */}
      <div
        className="app-shell"
        style={{
          gridTemplateColumns: `var(--sidebar-w) 1fr${aiOpen ? ` ${aiWidth}px` : ''}`,
        }}
      >
        <StatsBar stats={stats} status={status} apiOnline={apiOnline} loading={loading} />

        <Sidebar
          topics={topics}
          activeTopic={activeTopic}
          stats={topicStats}
          onSelect={topic => { setActiveTopic(topic); setView('feed'); setQueryResult(null); }}
          view={view}
          onViewChange={v => {
            if (v === 'summy') { setAiOpen(o => !o); }
            else setView(v as View);
          }}
          aiOpen={aiOpen}
        />

        {/* ── Main ── */}
        <main className="main">
          <div className="main-inner">

            {view === 'feed' && (
              <>
                {queryResult && <QueryResult result={queryResult} onClose={() => setQueryResult(null)} />}

                {topics.length > 0 ? (
                  <ArticleFeed key={feedKey} topic={activeTopic} topics={topics} />
                ) : !loading ? (
                  <div className="empty">
                    <div className="empty-icon">🔌</div>
                    <p className="empty-text">
                      {apiOnline ? 'No topics configured.' : 'Cannot reach API. Run: python main.py api'}
                    </p>
                  </div>
                ) : null}
              </>
            )}

            {view === 'analytics' && (
              <AnalyticsPanel activeTopic={activeTopic} />
            )}

            {view === 'telemetry' && (
              <TelemetryPanel />
            )}

            {view === 'graph' && (
              <KnowledgeGraph />
            )}

            {view === 'pipeline' && (
              <PipelineControls onPipelineComplete={() => { fetchMeta(); setFeedKey(k => k + 1); }} />
            )}

            {view === 'dossier' && (
              <DossierCanvas />
            )}
          </div>
        </main>

        {/* ── AI Panel + drag handle ── */}
        {aiOpen && (
          <>
            {/* Drag handle */}
            <div
              onMouseDown={onDragStart}
              style={{
                gridColumn: '3', gridRow: '2',
                width: 4, cursor: 'col-resize', zIndex: 10,
                background: 'transparent',
                borderLeft: '1px solid var(--border)',
                transition: 'background 150ms',
                position: 'relative',
                marginLeft: -4,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--blue-bg)'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
              onMouseLeave={e => { if (!dragging.current) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
            />
            {/* AI Panel */}
            <div style={{ gridColumn: '3', gridRow: '2', overflow: 'hidden', minWidth: MIN_AI_W }}>
              <SummyAIPanel
                onClose={() => setAiOpen(false)}
                onOpenManager={() => setShowManager(true)}
              />
            </div>
          </>
        )}
      </div>

      {/* Agent Manager */}
      {showManager && (
        <AgentManager
          onClose={() => setShowManager(false)}
          onSignIn={() => signIn()}
          isLoggedIn={!!session}
          userName={session?.user?.name ?? undefined}
        />
      )}
    </>
  );
}
