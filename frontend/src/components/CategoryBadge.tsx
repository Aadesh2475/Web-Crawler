'use client';

// Maps topic/source strings to a badge color variant
const TOPIC_MAP: Record<string, string> = {
  // Topics
  'artificial intelligence': 'blue',
  'machine learning': 'blue',
  'ai': 'blue',
  'climate change': 'green',
  'climate': 'green',
  'environment': 'green',
  'space exploration': 'purple',
  'space': 'purple',
  'technology': 'blue',
  'tech': 'blue',
  'health': 'green',
  'science': 'purple',
  // Sources
  'reddit': 'orange',
  'wikipedia': 'slate',
  'wiki': 'slate',
  'bbc': 'red',
  'nytimes': 'red',
  'reuters': 'red',
  'sciencedaily': 'blue',
  'news': 'red',
};

const ICONS: Record<string, string> = {
  blue:   '◆',
  red:    '▲',
  green:  '●',
  purple: '★',
  orange: '◉',
  slate:  '○',
};

function resolveVariant(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(TOPIC_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'slate';
}

interface Props {
  label: string;
  /** Override auto-detection */
  variant?: 'red' | 'blue' | 'green' | 'purple' | 'orange' | 'slate';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg' | string;
}

export default function CategoryBadge({ label, variant, showIcon = true, size }: Props) {
  const v = variant ?? resolveVariant(label);
  const sizeClass = size ? `badge-${size}` : '';
  return (
    <span className={`badge badge-${v} ${sizeClass}`}>
      {showIcon && <span style={{ fontSize: 8, opacity: 0.7 }}>{ICONS[v]}</span>}
      {label}
    </span>
  );
}

export { resolveVariant };
