'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props { onClick: () => void; }

export default function SummyAIFloatButton({ onClick }: Props) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const t = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 600); }, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <button
      id="summy-ai-float-btn"
      onClick={onClick}
      title="Open SummyAI"
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: pulse
          ? '0 0 0 8px rgba(99,102,241,0.2), 0 8px 24px rgba(79,70,229,0.4)'
          : '0 4px 16px rgba(79,70,229,0.35)',
        zIndex: 200,
        transition: 'box-shadow 400ms ease, transform 150ms ease',
        transform: pulse ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      <Sparkles size={22} color="white" />
    </button>
  );
}
