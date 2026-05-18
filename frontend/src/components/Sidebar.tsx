'use client';

import {
  LayoutGrid,
  Settings,
  Bot,
  Leaf,
  Telescope,
  FlaskConical,
  Cpu,
  Heart,
  Circle,
  ChevronRight,
  BarChart2,
  Sparkles,
  Home,
  Flame,
  Radio,
  Globe,
  Cloud,
  DollarSign,
  Megaphone,
  Activity,
  Network,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { resolveVariant } from './CategoryBadge';

type View = 'feed' | 'pipeline' | 'analytics' | 'telemetry' | 'graph' | 'summy' | 'dossier';

interface Props {
  topics: string[];
  activeTopic: string | null;
  stats: Record<string, number>;
  onSelect: (topic: string | null) => void;
  view: View;
  onViewChange: (v: View) => void;
  aiOpen?: boolean;
}

const TOPIC_ICONS: Record<string, React.ElementType> = {
  'artificial intelligence': Bot,
  'machine learning':        Bot,
  'ai':                      Bot,
  'climate change':          Leaf,
  'climate':                 Leaf,
  'environment':             Leaf,
  'space exploration':       Telescope,
  'space':                   Telescope,
  'geopolitics':             Globe,
  'weather':                 Cloud,
  'finance':                 DollarSign,
  'awareness':               Megaphone,
  'technology':              Cpu,
  'tech':                    Cpu,
  'health':                  Heart,
  'science':                 FlaskConical,
};

function topicIcon(topic: string): React.ElementType {
  const lower = topic.toLowerCase();
  for (const [k, v] of Object.entries(TOPIC_ICONS)) {
    if (lower.includes(k)) return v;
  }
  return Circle;
}

const COLOR_MAP: Record<string, string> = {
  blue:   '#2563eb',
  green:  '#16a34a',
  purple: '#7c3aed',
  orange: '#ea580c',
  red:    '#dc2626',
  slate:  '#475569',
};

export default function Sidebar({ topics, activeTopic, stats, onSelect, view, onViewChange, aiOpen }: Props) {
  return (
    <nav className="sidebar" aria-label="Navigation">
      {/* ── Feed navigation ── */}
      <div className="sidebar-section">
        <p className="sidebar-label">Feed</p>

        <button
          className={`sidebar-item ${view === 'feed' && activeTopic === null ? 'active' : ''}`}
          onClick={() => { onSelect(null); onViewChange('feed'); }}
        >
          <Home size={14} style={{ flexShrink: 0, color: view === 'feed' && activeTopic === null ? 'var(--text-primary)' : 'var(--text-disabled)' }} />
          Home
        </button>


        <button
          className={`sidebar-item ${view === 'feed' && activeTopic === 'popular' ? 'active' : ''}`}
          onClick={() => { onSelect('popular'); onViewChange('feed'); }}
        >
          <Flame size={14} style={{ flexShrink: 0, color: view === 'feed' && activeTopic === 'popular' ? 'var(--text-primary)' : 'var(--text-disabled)' }} />
          Popular
        </button>

        <button
          className={`sidebar-item ${view === 'feed' && activeTopic === 'posts' ? 'active' : ''}`}
          onClick={() => { onSelect('posts'); onViewChange('feed'); }}
        >
          <MessageSquare size={14} style={{ flexShrink: 0, color: view === 'feed' && activeTopic === 'posts' ? 'var(--text-primary)' : 'var(--text-disabled)' }} />
          Posts
        </button>
      </div>

      {/* ── Explore ── */}
      <div className="sidebar-section">
        <p className="sidebar-label">Explore</p>
        {['geopolitics', 'weather', 'finance', 'awareness', 'technology'].map(topic => {
          const isActive = view === 'feed' && activeTopic === topic;
          const variant  = resolveVariant(topic);
          const color    = COLOR_MAP[variant] ?? 'var(--text-muted)';
          const Icon     = topicIcon(topic);

          return (
            <button
              key={topic}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => { onSelect(topic); onViewChange('feed'); }}
            >
              <Icon
                size={14}
                style={{ flexShrink: 0, color: isActive ? color : 'var(--text-disabled)' }}
              />
              <span style={{ textTransform: 'capitalize', flex: 1, textAlign: 'left' }}>
                {topic}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Views ── */}
      <div className="sidebar-section">
        <p className="sidebar-label">Tools</p>
        <button
          id="nav-pipeline"
          className={`sidebar-item ${view === 'pipeline' ? 'active' : ''}`}
          onClick={() => onViewChange('pipeline')}
        >
          <Settings
            size={14}
            style={{ flexShrink: 0, color: view === 'pipeline' ? 'var(--text-primary)' : 'var(--text-disabled)' }}
          />
          Pipeline
          <ChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--text-disabled)' }} />
        </button>
        <button
          id="nav-analytics"
          className={`sidebar-item ${view === 'analytics' ? 'active' : ''}`}
          onClick={() => onViewChange('analytics')}
        >
          <BarChart2
            size={14}
            style={{ flexShrink: 0, color: view === 'analytics' ? 'var(--text-primary)' : 'var(--text-disabled)' }}
          />
          Analytics
          <ChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--text-disabled)' }} />
        </button>
        <button
          id="nav-telemetry"
          className={`sidebar-item ${view === 'telemetry' ? 'active' : ''}`}
          onClick={() => onViewChange('telemetry')}
        >
          <Activity
            size={14}
            style={{ flexShrink: 0, color: view === 'telemetry' ? 'var(--text-primary)' : 'var(--text-disabled)' }}
          />
          Telemetry
          <ChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--text-disabled)' }} />
        </button>
        <button
          id="nav-graph"
          className={`sidebar-item ${view === 'graph' ? 'active' : ''}`}
          onClick={() => onViewChange('graph')}
        >
          <Network
            size={14}
            style={{ flexShrink: 0, color: view === 'graph' ? 'var(--text-primary)' : 'var(--text-disabled)' }}
          />
          Knowledge Graph
          <ChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--text-disabled)' }} />
        </button>

        {/* Dossier Canvas */}
        <button
          id="nav-dossier"
          className={`sidebar-item ${view === 'dossier' ? 'active' : ''}`}
          onClick={() => onViewChange('dossier')}
        >
          <FileText
            size={14}
            style={{ flexShrink: 0, color: view === 'dossier' ? 'var(--text-primary)' : 'var(--text-disabled)' }}
          />
          Dossier Canvas
          <ChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--text-disabled)' }} />
        </button>

        {/* SummyAI */}
        <button
          id="nav-summy"
          className={`sidebar-item ${aiOpen ? 'active' : ''}`}
          onClick={() => onViewChange('summy')}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Sparkles size={14} style={{ color: aiOpen ? 'var(--text-primary)' : 'var(--text-disabled)' }} />
            {!aiOpen && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                width: 5, height: 5, borderRadius: '50%',
                background: '#111827', boxShadow: '0 0 0 1.5px white',
              }} />
            )}
          </div>
          <span style={{ flex: 1, textAlign: 'left' }}>SummyAI</span>
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontWeight: 700, border: '1px solid var(--border)' }}>AI</span>
        </button>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '0 20px 20px', marginTop: 'auto' }}>
        <p style={{ fontSize: 11, color: 'var(--text-disabled)', lineHeight: 1.7 }}>
          WebMining ML Pipeline<br />
          News · Wikipedia · Reddit
        </p>
      </div>
    </nav>
  );
}
