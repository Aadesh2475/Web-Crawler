'use client';

import { X, ExternalLink } from 'lucide-react';
import { QueryResult as QR, Source } from '@/lib/api';
import CategoryBadge from './CategoryBadge';

interface Props {
  result: QR;
  onClose: () => void;
}

function SourceRow({ src, idx }: { src: Source; idx: number }) {
  return (
    <div className="query-source-item">
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-disabled)', width: 18, flexShrink: 0, paddingTop: 2 }}>
        {idx + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a
          href={src.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13, fontWeight: 600, color: 'var(--blue)',
            display: 'flex', alignItems: 'center', gap: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{src.title}</span>
          <ExternalLink size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
        </a>
        {src.summary && (
          <p style={{
            fontSize: 12, color: 'var(--text-muted)', marginTop: 2,
            display: '-webkit-box', WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
          }}>
            {src.summary}
          </p>
        )}
        {src.topic && (
          <div style={{ marginTop: 4 }}>
            <CategoryBadge label={src.topic} showIcon={false} />
          </div>
        )}
      </div>
      <span className="query-source-sim" title="Similarity score">
        {(src.similarity * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export default function QueryResult({ result, onClose }: Props) {
  return (
    <div className="query-result">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <p className="query-question">AI Answer</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            &ldquo;{result.question}&rdquo;
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 26, height: 26, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: 4, color: 'var(--text-muted',
            flexShrink: 0, border: '1px solid var(--border)', background: 'var(--bg-secondary)',
          }}
          aria-label="Close result"
        >
          <X size={13} />
        </button>
      </div>

      <div className="divider" style={{ margin: '10px 0 14px' }} />

      {/* Answer */}
      <p className="query-answer">{result.answer}</p>

      {/* Sources */}
      {result.sources?.length > 0 && (
        <>
          <p className="query-sources-title">
            Sources — {result.sources.length} document{result.sources.length !== 1 ? 's' : ''}
          </p>
          <div className="query-source-list">
            {result.sources.map((src, i) => (
              <SourceRow key={i} src={src} idx={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
