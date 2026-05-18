'use client';

import { useState } from 'react';
import { Clock, MapPin, Star, TrendingUp, TrendingDown, Minus, User, ExternalLink } from 'lucide-react';
import { Article } from '@/lib/api';
import CategoryBadge from './CategoryBadge';

interface Props { article: Article; }

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr.slice(0, 10); }
}

function sourceLabel(src: string): string {
  if (!src) return 'Unknown';
  const map: Record<string, string> = {
    bbc: 'BBC', nytimes: 'NYT', reuters: 'Reuters',
    sciencedaily: 'ScienceDaily', reddit: 'Reddit', wikipedia: 'Wikipedia',
  };
  const lower = src.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) return v;
  }
  return src.charAt(0).toUpperCase() + src.slice(1);
}

const SENTIMENT_CONFIG = {
  positive: { color: '#16a34a', bg: '#f0fdf4', Icon: TrendingUp  },
  negative: { color: '#dc2626', bg: '#fef2f2', Icon: TrendingDown },
  neutral:  { color: '#6b7280', bg: '#f9fafb', Icon: Minus        },
};

export default function ArticleCard({ article }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isReddit = article.source?.toLowerCase().includes('reddit');
  const isWiki   = article.source?.toLowerCase().includes('wiki');
  const sentiment = article.sentiment_label
    ? SENTIMENT_CONFIG[article.sentiment_label]
    : null;
  
  const author = article.author || article.meta?.author || article.meta?.username;

  // Extract and clean summary
  let displaySummary = article.summary || "";
  const mdImgRegex = /!\[.*?\]\((.*?)\)/i;
  const rawImgRegex = /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp))/i;
  
  let imageUrl = article.meta?.image_url || article.meta?.image;
  if (!imageUrl) {
     const mdMatch = displaySummary.match(mdImgRegex);
     if (mdMatch) imageUrl = mdMatch[1];
     else {
        const rawMatch = displaySummary.match(rawImgRegex);
        if (rawMatch) imageUrl = rawMatch[1];
     }
  }

  // Strip markdown links and raw URLs from the text to make it clean
  displaySummary = displaySummary.replace(/!?\[.*?\]\(.*?\)/g, '').replace(/(https?:\/\/[^\s]+)/g, '').replace(/\s{2,}/g, ' ').trim();

  return (
    <article className="article-card" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      borderLeft: article.relevance_score && article.relevance_score > 0.8 ? '4px solid var(--blue)' : undefined,
      background: article.relevance_score && article.relevance_score > 0.8 ? 'linear-gradient(to right, #f8fafc, #ffffff)' : 'var(--bg)'
    }}>
      {/* Banner Image */}
      {imageUrl && (
         <div style={{ width: 'calc(100% + 40px)', margin: '-16px -20px 16px -20px', height: 160, background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', position: 'relative' }}>
             <img 
                src={imageUrl} 
                alt={article.title} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.style.display = 'none'; }}
             />
             {formatDate(article.published_at).includes('m ago') && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--blue)', color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, letterSpacing: 0.5, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                  NEW
                </div>
             )}
         </div>
      )}

      {/* Header */}
      <div className="article-card-header">
        <h2 className="article-title" style={{ fontSize: 15 }}>
          {article.title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {sentiment && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 99,
              fontSize: 10, fontWeight: 600,
              color: sentiment.color, background: sentiment.bg,
            }}>
              <sentiment.Icon size={10} />
              {article.sentiment_label}
            </span>
          )}
        </div>
      </div>

      {/* Summary with AI Branding */}
      {displaySummary && (
        <div style={{ marginBottom: 12, background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 8, borderLeft: '2px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, opacity: 0.7 }}>
             <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 4, height: 4, borderRadius: 1, background: 'white' }} />
             </div>
             <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: 'var(--text-primary)', textTransform: 'uppercase' }}>AI Insight</span>
          </div>
          <p className="article-summary" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)', ...(isExpanded ? { WebkitLineClamp: 'unset' } : {}) }}>
            {displaySummary}
          </p>
          {!isExpanded && displaySummary.length > 150 && (
            <button onClick={(e) => { e.preventDefault(); setIsExpanded(true); }} style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 4 }}>
              Show full summary
            </button>
          )}
          {isExpanded && (
            <button onClick={(e) => { e.preventDefault(); setIsExpanded(false); }} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 4 }}>
              Show less
            </button>
          )}
        </div>
      )}

      {/* Keyword chips */}
      {article.keywords && article.keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {article.keywords.slice(0, 5).map(kw => (
            <span key={kw} style={{
              padding: '1px 7px', borderRadius: 99,
              fontSize: 10, fontWeight: 500,
              color: 'var(--text-muted)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
            }}>
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Meta row */}
      <div className="article-meta">
        <CategoryBadge
          label={isReddit ? 'Reddit' : isWiki ? 'Wikipedia' : 'News'}
          variant={isReddit ? 'orange' : isWiki ? 'slate' : 'red'}
          size="sm"
        />
        <CategoryBadge label={article.topic} showIcon size="sm" />
        <span className="article-meta-item">
          <Clock size={11} />
          {formatDate(article.published_at)}
        </span>
        <span className="article-meta-item">
          <MapPin size={11} />
          {sourceLabel(article.source)}
        </span>
        {author && (
          <span className="article-meta-item">
            <User size={11} />
            {author}
          </span>
        )}
        {article.relevance_score != null && (
          <span className="article-meta-item" style={{ marginLeft: 'auto' }}>
            <Star size={11} />
            {(article.relevance_score * 100).toFixed(0)}% relevant
          </span>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
        <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', background: 'var(--bg-tertiary)', padding: '6px 14px', borderRadius: 6, transition: 'all 150ms', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background='var(--border)'} onMouseLeave={e => e.currentTarget.style.background='var(--bg-tertiary)'}>
          Visit {sourceLabel(article.source)} <ExternalLink size={12} />
        </a>
      </div>
    </article>
  );
}
