'use client';

import { Article } from '@/lib/api';
import { 
  ExternalLink, 
  User, 
  Bird,
  MessageCircle, 
  Share2, 
  ShieldCheck, 
  Zap, 
  Eye,
  Calendar,
  Globe
} from 'lucide-react';

interface Props {
  article: Article;
}

export default function SocialCard({ article }: Props) {
  const meta = article.meta || {};
  const platform = meta.platform || article.source || 'Social';
  const username = meta.username || article.author || 'Anonymous';
  const imageUrl = meta.image_url;
  
  const truth = (article.truth_score || 0.5) * 100;
  const importance = (article.importance_score || 0.5) * 100;
  const attention = (article.attention_score || 0.5) * 100;
  

  const getPlatformIcon = (p: string) => {
    const low = p.toLowerCase();
    if (low.includes('twitter') || low === 'x' || low === 'tweet') return <Bird size={14} style={{ color: '#1d9bf0' }} />;
    if (low.includes('reddit')) return <MessageCircle size={14} style={{ color: '#ff4500' }} />;
    if (low.includes('instagram')) return <Globe size={14} style={{ color: '#e1306c' }} />;
    if (low.includes('facebook')) return <Globe size={14} style={{ color: '#1877f2' }} />;
    return <Globe size={14} />;
  };

  return (
    <div className="article-card" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>
      {/* Platform & User Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <User size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {username}
            {truth > 85 && <ShieldCheck size={12} style={{ color: '#2563eb' }} />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {getPlatformIcon(platform)} {platform}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-disabled)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={12} />
          {new Date(article.published_at || Date.now()).toLocaleDateString()}
        </div>
      </div>

      {/* Image if available */}
      {imageUrl && (
        <div style={{ width: '100%', height: 200, overflow: 'hidden', borderBottom: '1px solid var(--border-light)' }}>
          <img 
            src={imageUrl} 
            alt="Post content" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      )}

      {/* Content / Summary */}
      <div style={{ padding: 16 }}>
        {article.title && article.title !== `Post by ${username}` && (
          <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 12, fontWeight: 600 }}>
            {article.title}
          </p>
        )}
        
        <div className="social-card-insight" style={{ 
          padding: '12px 14px', 
          background: 'linear-gradient(135deg, var(--blue-bg) 0%, rgba(37, 99, 235, 0.05) 100%)', 
          borderRadius: 10, 
          border: '1px solid rgba(37, 99, 235, 0.1)',
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 8px', background: 'var(--blue)', color: 'white', fontSize: 9, fontWeight: 800, borderBottomLeftRadius: 8 }}>
            AI CORE
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={10} fill="currentColor" /> Intelligence Summary
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {article.summary || "Analyzing social context and entity relationships..."}
          </p>
        </div>

        {/* Category & Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          <span className="badge badge-topic">
            #{article.topic}
          </span>
          {article.keywords?.slice(0, 3).map(kw => (
            <span key={kw} className="badge badge-tag">
              {kw}
            </span>
          ))}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
          {/* Views */}
          {(meta.views !== undefined || meta.viewCount !== undefined) && (
            <div className="stat-item" title="Views">
              <Eye size={14} />
              {(meta.views ?? meta.viewCount).toLocaleString()}
            </div>
          )}
          
          {/* Engagement (Likes/Score) */}
          {(meta.likes !== undefined || meta.score !== undefined) && (
            <div className="stat-item" title="Engagement">
              <Zap size={14} style={{ color: '#ea580c' }} /> 
              {(meta.likes ?? meta.score).toLocaleString()}
            </div>
          )}

          {/* Shares / Retweets */}
          {(meta.retweets !== undefined || meta.shares !== undefined) && (
            <div className="stat-item" title="Shares / Retweets">
              <Share2 size={14} /> 
              {(meta.retweets ?? meta.shares).toLocaleString()}
            </div>
          )}

          {/* Comments / Replies */}
          {(meta.replies !== undefined || meta.num_comments !== undefined) && (
            <div className="stat-item" title="Comments / Replies">
              <MessageCircle size={14} /> 
              {(meta.replies ?? meta.num_comments).toLocaleString()}
            </div>
          )}
          
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(article.url);
                alert('URL copied to clipboard');
              }}
              className="btn-icon"
              title="Copy Link"
              style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <ExternalLink size={14} />
            </button>
            <a 
              href={article.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, height: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              Open {platform}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
