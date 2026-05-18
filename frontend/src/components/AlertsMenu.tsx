'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { api, Alert } from '@/lib/api';

export default function AlertsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await api.alerts();
      setAlerts(res.alerts || []);
      setUnreadCount(res.alerts ? res.alerts.length : 0);
    } catch (e) {
      console.error('Failed to fetch alerts', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0); // Mark as read when opened
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL': return <AlertTriangle size={14} color="#ef4444" />;
      case 'POSITIVE': return <TrendingUp size={14} color="#10b981" />;
      case 'VELOCITY': return <Activity size={14} color="#3b82f6" />;
      default: return <Bell size={14} />;
    }
  };

  return (
    <div className="alerts-menu" ref={menuRef} style={{ position: 'relative' }}>
      <button 
        onClick={toggleOpen}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isOpen ? 'var(--blue)' : 'var(--text-secondary)'
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute',
            top: 2,
            right: 4,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#ef4444',
            border: '2px solid var(--bg)'
          }} />
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          width: 320,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          zIndex: 100,
          overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>System Alerts</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{alerts.length} total</span>
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {loading && alerts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Scanning network...
              </div>
            ) : alerts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No active alerts.
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  background: alert.type === 'CRITICAL' ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                }}>
                  <div style={{ marginTop: 2 }}>{getAlertIcon(alert.type)}</div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <strong style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{alert.entity}</strong>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Phase 5 Proactive Alerting</span>
          </div>
        </div>
      )}
    </div>
  );
}
