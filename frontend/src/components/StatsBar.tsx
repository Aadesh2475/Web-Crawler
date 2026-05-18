'use client';

import { Activity, Database, Box, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Stats, SystemStatus } from '@/lib/api';
import AlertsMenu from './AlertsMenu';
import AudioBriefingPlayer from './AudioBriefingPlayer';

interface Props {
  stats: Stats | null;
  status: SystemStatus | null;
  apiOnline: boolean;
  loading?: boolean;
}

interface StatItemProps {
  label: string;
  value: string | number | undefined;
  icon: React.ReactNode;
  loading?: boolean;
}

function StatItem({ label, value, icon, loading }: StatItemProps) {
  return (
    <div className="topbar-stat">
      {icon}
      <strong>
        {loading
          ? <span className="skeleton" style={{ display: 'inline-block', width: 28, height: 13, verticalAlign: 'middle' }} />
          : (value ?? '—')
        }
      </strong>
      <span>{label}</span>
    </div>
  );
}

export default function StatsBar({ stats, status, apiOnline, loading }: Props) {
  const faissSize = status?.faiss?.index_size;

  return (
    <header className="topbar" role="banner">
      {/* Logo */}
      <div className="topbar-logo">
        <Box size={18} strokeWidth={2} />
        Web<span>Mining</span>
      </div>
      <div className="topbar-divider" />

      {/* Stats */}
      <div className="topbar-stats">
        <StatItem
          label="articles"
          value={stats?.total_articles}
          icon={<Database size={13} style={{ color: 'var(--text-disabled)' }} />}
          loading={loading}
        />
        <StatItem
          label="embedded"
          value={stats?.embedded_articles}
          icon={<Activity size={13} style={{ color: 'var(--text-disabled)' }} />}
          loading={loading}
        />
        {faissSize != null && (
          <StatItem
            label="in FAISS"
            value={faissSize}
            icon={<Database size={13} style={{ color: 'var(--text-disabled)' }} />}
            loading={loading}
          />
        )}
      </div>

      {/* API status & Alerts */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <AudioBriefingPlayer />
        <div className="topbar-divider" style={{ height: 16 }} />
        <AlertsMenu />
        <div className="topbar-divider" style={{ height: 16 }} />
        <div className="topbar-stat">
          {loading ? (
            <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--orange)' }} />
          ) : apiOnline ? (
            <Wifi size={13} style={{ color: 'var(--green)' }} />
          ) : (
            <WifiOff size={13} style={{ color: 'var(--text-disabled)' }} />
          )}
          <span style={{ fontSize: 12 }}>
            {loading ? 'Connecting…' : apiOnline ? 'API online' : 'API offline'}
          </span>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}
