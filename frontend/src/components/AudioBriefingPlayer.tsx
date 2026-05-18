'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Headphones, Sparkles, Loader2, RefreshCw, Volume2, Clock } from 'lucide-react';
import { api, BriefingInfo } from '@/lib/api';

export default function AudioBriefingPlayer() {
  const [info, setInfo] = useState<BriefingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [script, setScript] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Fetch briefing info on load
  const fetchInfo = async () => {
    try {
      const res = await api.briefingInfo();
      setInfo(res);
    } catch (e) {
      console.error('Failed to load briefing info:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
  }, []);

  // Handle clicking outside dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync audio progress
  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const onAudioEnded = () => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (!audioRef.current || !info?.exists) return;
    
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      setPlaying(true);
    }
  };

  // Synthesize new daily briefing newscast
  const handleSynthesize = async () => {
    setSynthesizing(true);
    setPlaying(false);
    try {
      const res = await api.briefingSynthesize();
      setScript(res.script);
      await fetchInfo();
      
      // Force reload audio element source
      if (audioRef.current) {
        audioRef.current.load();
      }
    } catch (e) {
      console.error('Synthesis failed:', e);
      alert('Failed to synthesize briefing audio. Please verify Gemini API setup.');
    } finally {
      setSynthesizing(false);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current && duration) {
      const val = parseFloat(e.target.value);
      const newTime = (val / 100) * duration;
      audioRef.current.currentTime = newTime;
      setProgress(val);
      setCurrentTime(newTime);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 20, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', opacity: 0.7 }}>
        <Loader2 size={13} className="animate-spin" />
        <span style={{ fontSize: 11, fontWeight: 500 }}>Briefing...</span>
      </div>
    );
  }

  const hasAudio = info?.exists;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Audio Element */}
      {hasAudio && (
        <audio
          ref={audioRef}
          src={info?.url ? `${info.url}?t=${info.last_synthesized ? new Date(info.last_synthesized).getTime() : Date.now()}` : `/audio/briefing.mp3?t=${Date.now()}`}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onAudioEnded}
        />
      )}

      {/* Main Glass Pill */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '5px 14px',
          borderRadius: 24,
          background: playing ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-secondary)',
          border: playing ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border)',
          boxShadow: playing ? '0 0 10px rgba(59, 130, 246, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s ease',
        }}
        onClick={() => setShowDropdown(!showDropdown)}
        className="audio-pill-hover"
      >
        {playing ? (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 12 }}>
            <span className="wave-bar bar-1" />
            <span className="wave-bar bar-2" />
            <span className="wave-bar bar-3" />
          </div>
        ) : (
          <Headphones size={13} style={{ color: hasAudio ? 'var(--blue)' : 'var(--text-disabled)' }} />
        )}
        
        <span style={{ fontSize: 12, fontWeight: 600, color: playing ? 'var(--blue)' : 'var(--text-primary)' }}>
          {playing ? 'Now Playing' : 'Daily Briefing'}
        </span>

        {synthesizing ? (
          <Loader2 size={12} className="animate-spin" style={{ color: 'var(--blue)' }} />
        ) : hasAudio ? (
          <div 
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--blue)',
              color: 'white',
              transition: 'transform 0.1s ease',
            }}
            className="play-btn"
          >
            {playing ? <Pause size={10} fill="white" /> : <Play size={10} fill="white" style={{ marginLeft: 1 }} />}
          </div>
        ) : (
          <Sparkles size={11} style={{ color: 'var(--orange)' }} />
        )}
      </div>

      {/* Dropdown Dashboard Panel */}
      {showDropdown && (
        <div 
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: 16,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Volume2 size={14} style={{ color: 'var(--blue)' }} />
              Audio Intelligence Briefing
            </h4>
            {hasAudio && (
              <button 
                onClick={handleSynthesize}
                disabled={synthesizing}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 600,
                }}
                className="hover:text-blue"
              >
                {synthesizing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Regen
              </button>
            )}
          </div>

          {!hasAudio ? (
            <div style={{ textAlign: 'center', padding: '20px 10px', border: '1px dashed var(--border)', borderRadius: 12 }}>
              <Sparkles size={24} style={{ color: 'var(--orange)', marginBottom: 8, opacity: 0.7 }} />
              <h5 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600 }}>Synthesize Audio Newscast</h5>
              <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Groups the top 5 high-importance intelligence signals of the last 24 hours into a 2-minute neural radio audio update.
              </p>
              <button 
                onClick={handleSynthesize}
                disabled={synthesizing}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {synthesizing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Generating Script & Audio...
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    Synthesize Daily Audio Briefing
                  </>
                )}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Audio Controls */}
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: playing ? 'var(--blue)' : 'var(--text-primary)' }}>
                    {playing ? 'Broadcasting live...' : 'Briefing ready'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                
                {/* Custom Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleProgressChange}
                  style={{
                    width: '100%',
                    height: 4,
                    background: 'var(--border)',
                    borderRadius: 2,
                    outline: 'none',
                    cursor: 'pointer',
                    accentColor: 'var(--blue)',
                    marginBottom: 12,
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button 
                    onClick={togglePlay}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--blue)',
                      color: 'white',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)',
                    }}
                  >
                    {playing ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" style={{ marginLeft: 2 }} />}
                  </button>
                </div>
              </div>

              {/* Aggregated meta info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={11} />
                  <span>Synthesized: {info?.last_synthesized ? new Date(info.last_synthesized).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                </div>
                {script && (
                  <div style={{ 
                    maxHeight: 100, 
                    overflowY: 'auto', 
                    padding: 8, 
                    borderRadius: 8, 
                    background: 'var(--bg-tertiary)', 
                    border: '1px solid var(--border)',
                    fontSize: 10,
                    lineHeight: 1.4,
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    <strong>Newscast Script:</strong><br/>
                    {script}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Styled Animations */}
      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        .audio-pill-hover:hover {
          background: var(--bg-tertiary) !important;
          transform: translateY(-1px);
        }
        .play-btn:hover {
          transform: scale(1.1);
        }
        .wave-bar {
          width: 2px;
          height: 100%;
          background: var(--blue);
          border-radius: 1px;
          animation: bounce 0.8s ease-in-out infinite alternate;
        }
        .bar-1 { animation-delay: 0.1s; height: 60%; }
        .bar-2 { animation-delay: 0.3s; height: 100%; }
        .bar-3 { animation-delay: 0.2s; height: 40%; }

        @keyframes bounce {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
