'use client';

import { FormEvent, useState } from 'react';
import { Search, SendHorizonal, Loader2 } from 'lucide-react';

interface Props {
  onSearch: (question: string) => Promise<void>;
  isLoading?: boolean;
}

export default function SearchBar({ onSearch, isLoading = false }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q || isLoading) return;
    await onSearch(q);
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-input-wrap">
        <span className="search-icon">
          <Search size={14} />
        </span>
        <input
          id="rag-search-input"
          className="search-input"
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Ask a question about the knowledge base…"
          disabled={isLoading}
          autoComplete="off"
        />
      </div>
      <button
        id="rag-search-btn"
        type="submit"
        className="btn btn-primary"
        disabled={isLoading || !value.trim()}
      >
        {isLoading ? (
          <>
            <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Searching…
          </>
        ) : (
          <>
            <SendHorizonal size={14} />
            Ask AI
          </>
        )}
      </button>
    </form>
  );
}
