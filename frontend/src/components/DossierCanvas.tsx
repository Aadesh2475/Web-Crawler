'use client';

import { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Send,
  Loader2,
  Sparkles,
  Clock,
  Database,
  Search,
  FileCheck,
  AlertCircle,
  Download,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Dossier {
  filename: string;
  chunks: number;
  uploaded_at: string;
}

export default function DossierCanvas() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Chat/Query state
  const [question, setQuestion] = useState('');
  const [querying, setQuerying] = useState(false);
  const [conversation, setConversation] = useState<Array<{
    type: 'user' | 'assistant';
    text: string;
    sources?: Array<{ title: string; source: string; similarity: number; url: string }>;
  }>>([]);

  const [copyingIndex, setCopyingIndex] = useState<number | null>(null);

  // Suggested Prompts
  const suggestions = [
    {
      label: 'Identify Strategic Anomaly Signals',
      prompt: 'Based on the uploaded dossier, identify any anomalies, risk outliers, or subtle warning signals that could impact operational or financial stability.'
    },
    {
      label: 'Construct Meticulous Risk Matrix',
      prompt: 'Synthesize a high-precision risk matrix of all threats, key entity owners, probability estimates, and target mitigation strategies mapped out in the dossier.'
    },
    {
      label: 'Entity Network Synthesis',
      prompt: 'Extract all people, corporations, or geographical hubs mentioned in this document and construct a detailed summary of their core relationships and influence.'
    }
  ];

  const fetchDossiers = async () => {
    setLoadingList(true);
    try {
      const res = await api.dossiers();
      setDossiers(res.dossiers || []);
    } catch (err) {
      console.error('Failed to load dossiers list:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchDossiers();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Reset banners
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);

    try {
      await api.dossiersUpload(file);
      setUploadSuccess(`Dossier "${file.name}" uploaded and indexed successfully into vector space!`);
      fetchDossiers();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to parse and embed document. Please verify the file is readable.');
    } finally {
      setUploading(false);
    }
  };

  const handleQuery = async (queryText?: string) => {
    const q = queryText || question;
    if (!q || !q.trim() || querying) return;

    setQuerying(true);
    setQuestion('');

    // Append user query to thread
    setConversation(prev => [...prev, { type: 'user', text: q }]);

    try {
      const res = await api.dossiersQuery(q);
      setConversation(prev => [...prev, {
        type: 'assistant',
        text: res.answer,
        sources: res.sources
      }]);
    } catch (err: any) {
      setConversation(prev => [...prev, {
        type: 'assistant',
        text: `Error: Failed to query intelligence engine (${err.message || 'Connection lost'}).`
      }]);
    } finally {
      setQuerying(false);
    }
  };

  const handleCopyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopyingIndex(index);
    setTimeout(() => setCopyingIndex(null), 1500);
  };

  const handleDownloadBriefing = (text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `briefing_synthesis_${new Date().toISOString().slice(0,10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, height: 'calc(100vh - 100px)', padding: 12 }}>
      {/* ── Left Sidebar: Indexer & Documents ── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        overflowY: 'auto'
      }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            <Database size={16} style={{ color: '#6366f1' }} />
            Private Dossier RAG
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            Upload raw documents into secure local PostgreSQL storage. Automatic sliding-window chunking and SentenceTransformer vector indexing.
          </p>
        </div>

        {/* Upload Zone */}
        <div style={{ position: 'relative' }}>
          <label style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 120,
            border: '2px dashed var(--border)',
            borderRadius: 12,
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'border-color 200ms, background 200ms',
            background: 'rgba(255, 255, 255, 0.01)',
          }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => e.preventDefault()}
          >
            <input
              type="file"
              accept=".txt,.pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Loader2 size={24} className="animate-spin" style={{ color: '#6366f1' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Vector Indexing...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 12, textAlign: 'center' }}>
                <UploadCloud size={28} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>Click to Upload</span>
                  <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>PDF or TXT up to 15MB</span>
                </div>
              </div>
            )}
          </label>
        </div>

        {/* Upload Feedback */}
        {uploadError && (
          <div style={{
            display: 'flex', gap: 8, padding: 10, background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, color: '#f87171', fontSize: 11
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{uploadError}</span>
          </div>
        )}
        {uploadSuccess && (
          <div style={{
            display: 'flex', gap: 8, padding: 10, background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 8, color: '#4ade80', fontSize: 11
          }}>
            <FileCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Documents list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Indexed Documents
            </span>
            <span style={{ fontSize: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 10, color: 'var(--text-muted)' }}>
              {dossiers.length}
            </span>
          </div>

          {loadingList ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-disabled)' }} />
            </div>
          ) : dossiers.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 24, border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-disabled)',
              textAlign: 'center', gap: 8
            }}>
              <BookOpen size={18} />
              <span style={{ fontSize: 11 }}>No custom documents indexed yet.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: '320px' }}>
              {dossiers.map((doc, idx) => (
                <div key={idx} style={{
                  padding: 10,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <FileText size={14} style={{ color: '#6366f1', marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {doc.filename}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-disabled)', marginTop: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} />
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'N/A'}
                    </span>
                    <span style={{ background: '#6366f11c', color: '#818cf8', border: '1px solid #6366f130', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      {doc.chunks} Chunks
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Content: Intelligence Analysis Canvas ── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Canvas Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(to right, rgba(99, 102, 241, 0.04), transparent)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, margin: 0, background: 'linear-gradient(135deg, var(--text-primary), #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              <Sparkles size={16} style={{ color: '#818cf8' }} />
              Executive Intelligence Analysis Canvas
            </h1>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
              Interact directly with your private documents. Queries are synthesized through Google Gemini-2.0.
            </p>
          </div>
        </div>

        {/* Chat / Canvas Output Area */}
        <div style={{
          flex: 1,
          padding: 24,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}>
          {conversation.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: 600,
              margin: 'auto',
              textAlign: 'center',
              gap: 24
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.07)',
                display: 'flex', alignItems: 'center', justifyItems: 'center', border: '1px solid rgba(99, 102, 241, 0.2)'
              }}>
                <Sparkles size={24} style={{ color: '#6366f1', margin: 'auto' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  State of the Art Intelligence synthesis
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                  Select one of the analytical prompt vectors below or write a custom query to interrogate the uploaded private dossiers.
                </p>
              </div>

              {/* Suggestions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, width: '100%' }}>
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuery(s.prompt)}
                    disabled={querying}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 200ms, transform 150ms',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>{s.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {conversation.map((msg, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}>
                  {/* Speaker Label */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-disabled)'
                  }}>
                    {msg.type === 'user' ? 'You' : 'Intelligence Analyst'}
                  </div>

                  {/* Bubble */}
                  <div style={{
                    padding: msg.type === 'user' ? '12px 16px' : '16px 20px',
                    borderRadius: 12,
                    background: msg.type === 'user' ? '#6366f1' : 'rgba(255, 255, 255, 0.03)',
                    border: msg.type === 'user' ? 'none' : '1px solid var(--border)',
                    color: msg.type === 'user' ? '#ffffff' : 'var(--text-primary)',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.text}

                    {/* Actions on synthesis */}
                    {msg.type === 'assistant' && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <button
                          onClick={() => handleCopyToClipboard(msg.text, idx)}
                          style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0
                          }}
                        >
                          {copyingIndex === idx ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
                          {copyingIndex === idx ? 'Copied' : 'Copy Analysis'}
                        </button>
                        <button
                          onClick={() => handleDownloadBriefing(msg.text)}
                          style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0
                          }}
                        >
                          <Download size={12} />
                          Download Report
                        </button>
                      </div>
                    )}
                  </div>

                  {/* RAG Sources list */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-disabled)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <BookOpen size={10} />
                        Supporting Evidence Citations ({msg.sources.length})
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {msg.sources.map((s, sIdx) => (
                          <div key={sIdx} style={{
                            padding: '4px 8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)',
                            borderRadius: 6, fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6
                          }}>
                            <span style={{ fontWeight: 700, color: '#818cf8' }}>[{sIdx + 1}]</span>
                            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.source}</span>
                            <span style={{ opacity: 0.6 }}>· Sim: {(s.similarity * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {querying && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  width: 'fit-content',
                  color: 'var(--text-muted)',
                  fontSize: 12
                }}>
                  <Loader2 size={14} className="animate-spin" style={{ color: '#818cf8' }} />
                  Synthesizing briefing report via Google Gemini...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{
          padding: 20,
          borderTop: '1px solid var(--border)',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          <form onSubmit={e => { e.preventDefault(); handleQuery(); }} style={{ display: 'flex', gap: 12 }}>
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask anything about the uploaded dossier data..."
              disabled={querying}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                transition: 'border-color 150ms'
              }}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button
              type="submit"
              disabled={querying || !question.trim()}
              style={{
                padding: '0 18px',
                borderRadius: 10,
                background: querying || !question.trim() ? 'var(--bg-tertiary)' : '#6366f1',
                color: querying || !question.trim() ? 'var(--text-disabled)' : '#ffffff',
                border: 'none',
                cursor: querying || !question.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 150ms'
              }}
              onMouseEnter={e => { if (!querying && question.trim()) e.currentTarget.style.background = '#4f46e5'; }}
              onMouseLeave={e => { if (!querying && question.trim()) e.currentTarget.style.background = '#6366f1'; }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
