'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, Article } from '@/lib/api';
import ArticleCard from './ArticleCard';
import SocialCard from './SocialCard';

interface Props {
  topic: string | null;
  topics: string[];
}

function SkeletonCard() {
  return (
    <div className="article-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="article-card-header" style={{ marginBottom: 12 }}>
        <div className="skeleton skeleton-title" style={{ width: '60%', margin: 0 }} />
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <div className="skeleton" style={{ width: 40, height: 16, borderRadius: 99 }} />
          <div className="skeleton" style={{ width: 40, height: 16, borderRadius: 99 }} />
        </div>
      </div>
      <div className="skeleton skeleton-text" style={{ width: '90%' }} />
      <div className="skeleton skeleton-text" style={{ width: '85%' }} />
      <div className="skeleton skeleton-text" style={{ width: '60%', marginBottom: 16 }} />
      
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
         <div className="skeleton" style={{ width: 60, height: 16, borderRadius: 99 }} />
         <div className="skeleton" style={{ width: 60, height: 16, borderRadius: 99 }} />
         <div className="skeleton" style={{ width: 60, height: 16, borderRadius: 99 }} />
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
         <div className="skeleton" style={{ width: 100, height: 28, borderRadius: 6 }} />
      </div>
    </div>
  );
}

function SkeletonSocialCard() {
  return (
    <div className="article-card" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary)' }}>
        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
        <div className="skeleton" style={{ width: 120, height: 14 }} />
        <div className="skeleton" style={{ width: 60, height: 14, marginLeft: 'auto' }} />
      </div>
      <div style={{ padding: 16 }}>
        <div className="skeleton skeleton-title" style={{ width: '80%', height: 18, marginBottom: 12 }} />
        <div className="skeleton skeleton-text" style={{ width: '95%' }} />
        <div className="skeleton skeleton-text" style={{ width: '90%' }} />
        <div className="skeleton skeleton-text" style={{ width: '40%', marginBottom: 20 }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
          <div className="skeleton" style={{ width: 60, height: 14 }} />
          <div className="skeleton" style={{ width: 60, height: 14 }} />
          <div style={{ marginLeft: 'auto' }}>
            <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ArticleFeed({ topic, topics }: Props) {
  const [articles, setArticles]   = useState<Article[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [offset, setOffset]       = useState(0);
  const [sortBy, setSortBy]       = useState<'default' | 'latest'>('default');
  const [hasMore, setHasMore]     = useState(true);
  const [showLoadMore, setShowLoadMore] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const cache = useRef<Record<string, Article[]>>({});
  const feedRef = useRef<HTMLDivElement>(null);

  // Helper to completely deduplicate articles by ID, Title, and URL
  const deduplicateArticles = useCallback((list: Article[]): Article[] => {
    const seenIds = new Set<number>();
    const seenTitles = new Set<string>();
    const seenUrls = new Set<string>();
    
    return list.filter(a => {
      if (!a) return false;
      const id = a.id;
      const title = a.title?.toLowerCase().trim();
      const url = a.url?.toLowerCase().trim();
      
      if (id && seenIds.has(id)) return false;
      if (title && seenTitles.has(title)) return false;
      if (url && seenUrls.has(url)) return false;
      
      if (id) seenIds.add(id);
      if (title) seenTitles.add(title);
      if (url) seenUrls.add(url);
      
      return true;
    });
  }, []);

  const load = useCallback(async (t: string | null, off: number, sort: string, append = false) => {
    setLoading(true);
    setError(null);
    const PAGE_SIZE = append ? 24 : 72; // Pre-load 72, then fetch 24 at a time
    
    try {
      let results: Article[] = [];

      if (t === 'news' || t === null) {
        const topicsFilter = ['finance', 'geopolitics', 'politics', 'current affairs', 'climate change', 'technology'];
        const data = await api.articlesRecent(PAGE_SIZE, sort, topicsFilter, off);
        results = data.articles || [];
      } else if (t === 'popular') {
        const data = await api.popular(PAGE_SIZE, off);
        results = data.articles || [];
      } else if (t === 'posts') {
        const data = await api.articlesSocial(PAGE_SIZE, off);
        results = data.articles || [];
      } else {
        const data = await api.articles(t, PAGE_SIZE, off);
        results = data.articles || [];
      }

      if (!append) {
        setArticles(deduplicateArticles(results));
      } else {
        setArticles(prev => deduplicateArticles([...prev, ...results]));
      }
      setHasMore(results.length >= PAGE_SIZE && results.length > 0);
    } catch (e: unknown) {
      console.error("Load error:", e);
      setError(e instanceof Error ? e.message : 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, [deduplicateArticles]);

  const scrollToTop = useCallback(() => {
    const scrollContainer = document.querySelector('.main') || window;
    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Scroll listener for Load More detection and Back to Top display
  useEffect(() => {
    const scrollContainer = document.querySelector('.main') || window;

    const handleScroll = () => {
      let scrollTop = 0;
      let scrollHeight = 0;
      let clientHeight = 0;

      if (scrollContainer instanceof HTMLElement) {
        scrollTop = scrollContainer.scrollTop;
        scrollHeight = scrollContainer.scrollHeight;
        clientHeight = scrollContainer.clientHeight;
      } else {
        scrollTop = window.scrollY;
        scrollHeight = document.body.offsetHeight;
        clientHeight = window.innerHeight;
      }

      // Reached bottom threshold (150px from absolute bottom of the container)
      if (clientHeight + scrollTop >= scrollHeight - 150) {
        setShowLoadMore(true);
      }
      
      // Scrolled down more than 400px shows Back to Top arrow
      if (scrollTop > 400) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    
    // Check initial scroll state in case layout was already loaded at depth
    handleScroll();

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Reload when topic or sort changes
  useEffect(() => {
    if (topics.length === 0) return;
    setArticles([]); // Clear for skeleton effect
    setOffset(0);
    setHasMore(true);
    setShowLoadMore(false);
    load(topic, 0, sortBy, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, sortBy, load]); 

  const handleLoadMore = () => {
    if (loading) return;
    setShowLoadMore(false); // Hide button immediately while loading
    const currentCount = articles.length;
    setOffset(currentCount);
    load(topic, currentCount, sortBy, true);
  };

  const getPageTitle = () => {
    if (topic === 'popular') return 'Intelligence Spotlight';
    if (topic === 'posts') return 'Social Intelligence';
    if (topic === 'news' || !topic) return 'Global Intelligence Feed';
    return `${topic.charAt(0).toUpperCase() + topic.slice(1)} Intelligence`;
  };

  const getPageSubtitle = () => {
    if (topic === 'popular') return 'Most viewed and high-attention analysis from the vector memory.';
    if (topic === 'posts') return 'Recent statements and news from X, Reddit, and global leaders.';
    if (topic === 'news' || !topic) return 'Aggregated current affairs, finance, and geopolitical insights.';
    return `Deep-dive analysis and extracted data for ${topic}.`;
  };

  return (
    <div className="feed-container" ref={feedRef} style={{ width: '100%' }}>
      {/* Feed Header with Filter Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div>
           <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
             {getPageTitle()}
           </h2>
           <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
             {getPageSubtitle()}
           </p>
        </div>

        {!topic || topic === 'news' ? (
           <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
             <button 
                onClick={() => setSortBy('default')}
                style={{ 
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none', background: sortBy === 'default' ? 'var(--bg)' : 'transparent',
                  color: sortBy === 'default' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: sortBy === 'default' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 200ms'
                }}
             >
               Default
             </button>
             <button 
                onClick={() => setSortBy('latest')}
                style={{ 
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none', background: sortBy === 'latest' ? 'var(--bg)' : 'transparent',
                  color: sortBy === 'latest' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: sortBy === 'latest' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 200ms'
                }}
             >
               Latest
             </button>
           </div>
        ) : null}
      </div>
      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--red-bg)',
          border: '1px solid #fca5a5',
          borderRadius: 'var(--radius)',
          fontSize: 13,
          color: 'var(--red)',
          marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      {/* Loading skeletons (Initial load) */}
      {loading && articles.length === 0 && (
        <div className="articles-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            topic === 'posts' ? <SkeletonSocialCard key={i} /> : <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Articles */}
      {!loading && articles.length === 0 && !error && (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <p className="empty-text">No articles found for this topic.</p>
          <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 6 }}>
            Run the pipeline to crawl new content.
          </p>
        </div>
      )}

      {articles.length > 0 && (
        <>
          <div className="articles-grid">
            {articles.map(a => (
              topic === 'posts'
                ? <SocialCard key={a.id ?? a.url} article={a} />
                : <ArticleCard key={a.id ?? a.url} article={a} />
            ))}
          </div>

          {/* Load more skeletons */}
          {loading && (
            <div className="articles-grid" style={{ marginTop: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                topic === 'posts' ? <SkeletonSocialCard key={`lms-${i}`} /> : <SkeletonCard key={`lms-${i}`} />
              ))}
            </div>
          )}

          {/* Load more button (Visible after long scroll) */}
          {!loading && hasMore && showLoadMore && (
            <div style={{ textAlign: 'center', marginTop: 40, paddingBottom: 40 }}>
              <button
                className="btn btn-primary"
                onClick={handleLoadMore}
                disabled={loading}
                style={{ minWidth: 200, height: 48, fontSize: 14 }}
              >
                Load More Articles
              </button>
            </div>
          )}
          
          {!hasMore && articles.length > 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              You've reached the end of the feed.
            </div>
          )}
        </>
      )}

      {/* Back to Top Floating Arrow Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll back to top"
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: 'var(--text-primary, #000000)',
            color: 'var(--bg, #ffffff)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1000,
            transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.08)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.22)';
            e.currentTarget.style.filter = 'brightness(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
            e.currentTarget.style.filter = 'none';
          }}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        </button>
      )}
    </div>
  );
}
