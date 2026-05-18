const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Article {
  id: number;
  title: string;
  url: string;
  summary: string;
  source: string;
  topic: string;
  published_at: string;
  relevance_score?: number;
  is_embedded?: boolean;
  is_outdated?: boolean;
  keywords?: string[];
  sentiment_score?: number;
  sentiment_label?: 'positive' | 'neutral' | 'negative';
  truth_score?: number;
  importance_score?: number;
  attention_score?: number;
  author?: string;
  meta?: Record<string, any>;
}

export interface Source {
  title: string;
  url: string;
  source: string;
  similarity: number;
  summary?: string;
  topic?: string;
}

export interface QueryResult {
  answer: string;
  sources: Source[];
  question: string;
}

export interface Stats {
  total_articles: number;
  embedded_articles: number;
  outdated_articles?: number;
  topics?: Record<string, number>;
}

export interface SystemStatus {
  scheduler?: {
    running: boolean;
    jobs?: Array<{ id: string; next_run: string }>;
  };
  database?: {
    total_articles: number;
    embedded_articles: number;
  };
  faiss?: {
    index_size: number;
  };
}

export interface PipelineStats {
  crawled?: number;
  filtered?: number;
  summarised?: number;
  saved?: number;
  [key: string]: number | undefined;
}

export interface Alert {
  id: number;
  type: 'CRITICAL' | 'VELOCITY' | 'POSITIVE';
  entity: string;
  message: string;
  timestamp: string;
}

export interface Prediction {
  entity: string;
  current_sentiment: number;
  momentum: number;
  velocity: number;
  projected_sentiment: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  confidence: number;
}

export interface RiskEvent {
  title: string;
  probability: number;
  timeframe: string;
  impact: 'Low' | 'Medium' | 'High' | 'Critical';
  geography: string;
  description: string;
  hedging_strategy: string;
}

export interface KeyCluster {
  theme: string;
  signal_velocity: 'Low' | 'Medium' | 'High';
  sentiment: number;
  summary: string;
}

export interface RiskForecast {
  global_risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  summary: string;
  key_clusters: KeyCluster[];
  risk_events: RiskEvent[];
  forecast_text: string;
  last_updated: string;
}

export interface BriefingInfo {
  exists: boolean;
  url: string | null;
  size_bytes: number;
  last_synthesized: string | null;
}

export interface BriefingSynthesis {
  message: string;
  script: string;
  stories: Array<{ title: string; source: string }>;
  url: string;
}

export interface TelemetryData {
  hardware: {
    cpu_percent: number;
    ram_percent: number;
    ram_used_gb: number;
    ram_total_gb: number;
  };
  pipeline: {
    active_jobs: any[];
    models_loaded: string[];
    data_sources: string[];
  };
}

// ── Simple In-Memory Cache ───────────────────────────────────────────────────
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds (faster updates)

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const isGet = !options?.method || options.method === 'GET';
  const cacheKey = `${path}_${JSON.stringify(options?.body || {})}`;

  if (isGet) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  const json = await res.json();
  const data = json.data as T;

  if (isGet) {
    cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL });
  }

  return data;
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  health: () =>
    apiFetch<{ service: string; healthy: boolean }>('/health'),

  pipelineStatus: () =>
    apiFetch<any>('/pipeline/status'),

  pipelineEvents: () =>
    apiFetch<{ events: any[] }>('/pipeline/events'),

  status: () =>
    apiFetch<SystemStatus>('/status'),

  telemetry: () =>
    apiFetch<TelemetryData>('/telemetry'),

  stats: () =>
    apiFetch<Stats>('/stats'),

  topics: () =>
    apiFetch<{ topics: string[] }>('/topics'),

  articles: (topic: string, limit = 20, offset = 0, fields?: string[]) => {
    const params = new URLSearchParams({ topic, limit: limit.toString(), offset: offset.toString() });
    if (fields) params.append('fields', fields.join(','));
    return apiFetch<{ topic: string; count: number; articles: Article[] }>(`/articles?${params.toString()}`);
  },

  articlesRecent: (limit = 30, sort = 'default', topics?: string[], offset = 0, fields?: string[]) => {
    const params = new URLSearchParams({ limit: limit.toString(), sort, offset: offset.toString() });
    if (topics) topics.forEach(t => params.append('topics', t));
    if (fields) params.append('fields', fields.join(','));
    return apiFetch<{ count: number; articles: Article[] }>(`/articles/recent?${params.toString()}`);
  },

  articlesSocial: (limit = 24, offset = 0) => {
    // Optimization: Request only fields needed by SocialCard
    const fields = ['id', 'url', 'title', 'summary', 'source', 'topic', 'published_at', 'keywords', 'truth_score', 'importance_score', 'attention_score', 'meta', 'author'];
    return apiFetch<{ count: number; articles: Article[] }>(
      `/articles/social?limit=${limit}&offset=${offset}&fields=${fields.join(',')}`
    );
  },

  popular: (limit = 30, offset = 0) =>
    apiFetch<{ count: number; articles: Article[] }>(
      `/articles/popular?limit=${limit}&offset=${offset}`
    ),

  topicsStats: () =>
    apiFetch<Record<string, number>>('/topics/stats'),

  statsEntities: (days = 3) =>
    apiFetch<{ people: any[]; organizations: any[] }>(`/stats/entities?days=${days}`),

  financeCorrelation: (company: string, days = 7) =>
    apiFetch<{ company: string; timeline: any[] }>(`/stats/finance/correlation?company=${encodeURIComponent(company)}&days=${days}`),

  knowledgeGraph: (days = 7, topic = '', focus = '') => {
    const params = new URLSearchParams({ days: days.toString() });
    if (topic) params.append('topic', topic);
    if (focus) params.append('focus', focus);
    return apiFetch<{ nodes: any[]; links: any[]; article_count: number }>(`/stats/knowledge-graph?${params.toString()}`);
  },

  entityDetails: (name: string) =>
    apiFetch<{ entity: string; metadata: any; news: any[] }>(`/stats/entity/details?name=${encodeURIComponent(name)}`),

  query: (question: string, top_k = 5, start_date?: string, end_date?: string) =>
    apiFetch<QueryResult>('/query', {
      method: 'POST',
      body: JSON.stringify({ question, top_k, start_date, end_date }),
    }),

  retrieve: (query: string, top_k = 5) =>
    apiFetch<{ query: string; count: number; documents: Source[] }>('/retrieve', {
      method: 'POST',
      body: JSON.stringify({ query, top_k }),
    }),

  pipelineRun: (topics?: string[]) =>
    apiFetch<PipelineStats>('/pipeline/run', {
      method: 'POST',
      body: JSON.stringify(topics ? { topics } : {}),
    }),

  pipelineEmbed: () =>
    apiFetch<{ newly_embedded: number }>('/pipeline/embed', {
      method: 'POST',
      body: '{}',
    }),

  pipelineCleanup: () =>
    apiFetch<{ articles_marked_outdated: number }>('/pipeline/cleanup', {
      method: 'POST',
      body: '{}',
    }),

  // ── Analytics ───────────────────────────────────────
  alerts: () =>
    apiFetch<{ alerts: Alert[] }>('/stats/alerts'),

  predictiveTrends: () =>
    apiFetch<{ predictions: Prediction[] }>('/stats/predictive-trends'),

  timeline: (days = 14, topic?: string) =>
    fetch(
      `${API_BASE}/stats/timeline?days=${days}${topic ? `&topic=${encodeURIComponent(topic)}` : ''}`,
    ).then(r => r.json()),

  sources: (topic?: string) =>
    fetch(
      `${API_BASE}/stats/sources${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`,
    ).then(r => r.json()),

  trending: () =>
    fetch(`${API_BASE}/articles/trending`).then(r => r.json()),

  riskDesk: (topic = '', refresh = false) =>
    apiFetch<RiskForecast>(`/predictive/risk-desk?topic=${encodeURIComponent(topic)}&refresh=${refresh}`),

  briefingInfo: () =>
    apiFetch<BriefingInfo>('/briefing/info'),

  briefingSynthesize: () =>
    apiFetch<BriefingSynthesis>('/briefing/synthesize', {
      method: 'POST',
      body: '{}'
    }),

  exportArticles: (topic: string, fmt: 'csv' | 'json' = 'json') =>
    `${API_BASE}/articles/export?topic=${encodeURIComponent(topic)}&fmt=${fmt}`,

  dossiers: () =>
    apiFetch<{ dossiers: Array<{ filename: string; chunks: number; uploaded_at: string }> }>('/dossiers'),

  dossiersUpload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE}/dossiers/upload`, {
      method: 'POST',
      body: formData,
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      return res.json().then(j => j.data);
    });
  },

  dossiersQuery: (question: string) =>
    apiFetch<QueryResult>('/dossiers/query', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
};
