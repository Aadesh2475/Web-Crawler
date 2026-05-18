'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X, Bot, Settings, Globe, Cpu, ArrowUp, Square,
  Plus, History, Trash2, MessageSquare, ChevronUp,
  ThumbsUp, ThumbsDown, Copy, CheckCheck, TrendingUp, Paperclip, Mic, Volume2, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
type Model = 'gemini' | 'newsler';

export interface Attachment {
  name: string;
  mimeType: string;
  base64?: string;
  text?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: Model;
  ts: number;
  fileNames?: string[];
  feedback?: 1 | -1 | null;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  model: Model;
  updatedAt: number;
}

export const MODELS: { id: Model; label: string; desc: string; Icon: React.ElementType }[] = [
  { id: 'gemini',  label: 'Gemini 3.1 Pro (High)', desc: 'Cloud · Advanced logic', Icon: Globe },
  { id: 'newsler', label: 'Newsler Local',         desc: 'Local · Pipeline data',  Icon: Cpu  },
];

export const SUGGESTED = [
  'What are the latest AI breakthroughs?',
  'Summarize recent climate change news',
  'What is SpaceX working on?',
  'Top trending topics right now',
];

export function newId() { return Math.random().toString(36).slice(2) + Date.now(); }
export function storageKey(email?: string) { return email ? `summy_${email}` : 'summy_guest'; }
export function loadChats(k: string): Chat[] { try { return JSON.parse(localStorage.getItem(k) ?? '[]'); } catch { return []; } }
export function saveChats(k: string, c: Chat[]) { try { localStorage.setItem(k, JSON.stringify(c)); } catch { /**/ } }

const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.csv,.xml,.json,.txt,.md,.py,.js,.ts';

export async function readFile(file: File): Promise<Attachment> {
  const isImage = file.type.startsWith('image/');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (isImage) {
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ name: file.name, mimeType: file.type, base64 });
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => resolve({ name: file.name, mimeType: file.type, text: reader.result as string });
      reader.readAsText(file);
    }
    reader.onerror = reject;
  });
}

export interface Props {
  onClose: () => void;
  onOpenManager: () => void;
}

export default function SummyAIPanel(props: Props) {
  const { data: session } = useSession();
  const email = session?.user?.email ?? undefined;
  const key = storageKey(email);
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<Model>('gemini');
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModelDropup, setShowModelDropup] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('');
        setInput(transcript);
      };
      
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const [activeArtifact, setActiveArtifact] = useState<any>(null);

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`]/g, ''));
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleDownload = () => {
    if (!activeArtifact || !activeArtifact.data) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(activeArtifact.data, null, 2))}`;
    const link = document.createElement('a');
    link.href = jsonString;
    link.download = `${(activeArtifact.title || 'artifact-data').toLowerCase().replace(/\s+/g, '-')}.json`;
    link.click();
  };

  useEffect(() => {
    const loaded = loadChats(key);
    setChats(loaded);
    if (loaded.length > 0) setActiveChatId(loaded[0].id);
    else createNewChat();
  }, [key]);

  useEffect(() => {
    if (chats.length) saveChats(key, chats);
  }, [chats, key]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chats, activeChatId, loading]);

  const activeChat = chats.find(c => c.id === activeChatId);

  const createNewChat = () => {
    const id = newId();
    setChats(prev => [{ id, title: 'New Chat', messages: [], model, updatedAt: Date.now() }, ...prev]);
    setActiveChatId(id);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const att = await readFile(files[i]);
      setAttachments(prev => [...prev, att]);
    }
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleFeedback = async (messageId: string, value: 1 | -1) => {
    if (!session) return alert('Please sign in to give feedback.');
    
    setChats(prev => prev.map(c => c.id === activeChatId ? {
      ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, feedback: value } : m)
    } : c));

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, value })
      });
    } catch (e) {
      console.error('Feedback failed:', e);
    }
  };

  const handleSend = async (text: string) => {
    if ((!text.trim() && attachments.length === 0) || !activeChatId) return;
    
    const fileNames = attachments.map(a => a.name);
    const userMsg: Message = { id: newId(), role: 'user', content: text, ts: Date.now(), fileNames };
    const currentAttachments = [...attachments];
    
    setChats(prev => prev.map(c => {
      if (c.id === activeChatId) {
        return { 
          ...c, 
          title: c.messages.length === 0 ? (text.slice(0, 30) || 'File Analysis') + '...' : c.title,
          messages: [...c.messages, userMsg], 
          updatedAt: Date.now() 
        };
      }
      return c;
    }));
    setInput('');
    setAttachments([]);
    setLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let finalAnswer = "I couldn't process that.";
    const assistantId = newId();

    try {
      if (model === 'newsler') {
        let query = text;
        if (currentAttachments.length > 0) {
           const fileContexts = currentAttachments.map(a => `[File: ${a.name}]\n${a.text || '<Binary Data>'}`).join('\n\n');
           query = `Analyze this file and answer: ${text}\n\n${fileContexts}`;
        }
        
        const { api } = await import('@/lib/api');
        
        let startIso = startDate ? new Date(startDate).toISOString() : undefined;
        let endIso = endDate ? new Date(endDate).toISOString() : undefined;
        
        const res = await api.query(query, 5, startIso, endIso);
        finalAnswer = res.answer || "No relevant data found in knowledge base.";
        
        if (res.sources?.length) {
            finalAnswer += "\n\n### Sources\n" + res.sources.map((s, i) => `${i+1}. [${s.title}](${s.url}) - Similarity: ${(s.similarity*100).toFixed(1)}%`).join('\n');
        }

      } else {
        const fileData = currentAttachments[0] ? { mimeType: currentAttachments[0].mimeType, base64: currentAttachments[0].base64, text: currentAttachments[0].text, fileName: currentAttachments[0].name } : undefined;
        
        const history = (activeChat?.messages || []).map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));

        const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text, history, fileData }),
            signal: abortController.signal
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        finalAnswer = data.answer;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        finalAnswer = 'Response stopped by user.';
      } else {
        finalAnswer = 'Error: Could not fetch response from API. Ensure backend is running or API key is valid.';
      }
    } finally {
      abortControllerRef.current = null;
      const aiMsg: Message = { id: assistantId, role: 'assistant', content: finalAnswer, model, ts: Date.now() };
      
      let updatedChat: Chat | undefined;
      setChats(prev => {
          const newChats = prev.map(c => {
             if (c.id === activeChatId) {
                updatedChat = { ...c, messages: [...c.messages, aiMsg], updatedAt: Date.now() };
                return updatedChat;
             }
             return c;
          });
          return newChats;
      });

      setLoading(false);

      if (session && updatedChat) {
          fetch('/api/chats', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  chatId: updatedChat.id,
                  title: updatedChat.title,
                  model: updatedChat.model,
                  messages: updatedChat.messages
              })
          }).catch(console.error);
      }
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 400 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'var(--text-primary)', color: 'var(--bg)', padding: 6, borderRadius: 8 }}><Bot size={18} /></div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>SummyAI</h2>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Intelligent Research Workspace</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={createNewChat} style={{ padding: 6, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }} title="New Chat"><Plus size={16} /></button>
          <button onClick={props.onOpenManager} style={{ padding: 6, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Agent Settings"><Settings size={16} /></button>
          <button onClick={props.onClose} style={{ padding: 6, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Close"><X size={16} /></button>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '30px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {activeChat?.messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', width: '100%', maxWidth: 400 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Bot size={28} style={{ color: 'var(--text-primary)' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>How can I help you today?</div>
            <div style={{ fontSize: 14, marginBottom: 32, color: 'var(--text-muted)' }}>Ask questions about your data pipeline or upload files for deep analysis.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SUGGESTED.map(s => (
                <button key={s} onClick={() => handleSend(s)} style={{
                  padding: '14px 18px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 12, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 500
                }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-disabled)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  {s} <ArrowUp size={14} style={{ opacity: 0.5, transform: 'rotate(45deg)' }} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          activeChat?.messages.map(m => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, maxWidth: m.role === 'user' ? '85%' : '100%', width: m.role === 'user' ? 'auto' : '100%', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'assistant' && (
                  <div style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
                    <Bot size={20} color="var(--text-primary)" />
                  </div>
                )}
                
                {m.role === 'user' ? (
                  <div style={{
                    padding: '14px 18px', borderRadius: 20, fontSize: 14.5, lineHeight: 1.6,
                    background: 'var(--bg-secondary)', 
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderBottomRightRadius: 6,
                  }}>
                    {m.fileNames && m.fileNames.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {m.fileNames.map((fn, i) => (
                                <div key={i} style={{ fontSize: 11, background: 'var(--bg)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                    <Paperclip size={12} /> {fn}
                                </div>
                            ))}
                        </div>
                    )}
                    {m.content}
                  </div>
                ) : (
                  <div style={{ flex: 1, paddingRight: 10 }}>
                    {/* Professional Markdown Wrapper */}
                    <div className="markdown-body" style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-primary)' }}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const language = match ? match[1] : '';
                            
                            if (!inline && language === 'summy-chart') {
                               try {
                                 const config = JSON.parse(String(children).replace(/\n$/, ''));
                                 return (
                                   <div style={{ padding: '14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                         <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--blue-bg)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={18}/></div>
                                         <div>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{config.title || 'Data Visualization'}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Interactive Chart Artifact</div>
                                         </div>
                                      </div>
                                      <button onClick={() => setActiveArtifact({ type: 'chart', ...config })} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'transform 100ms' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>View Canvas</button>
                                   </div>
                                 );
                               } catch(e) {
                                 return <pre {...props} style={{ background: '#f8717120', color: '#ef4444', border: '1px solid #fca5a5' }}>Invalid Chart JSON</pre>;
                               }
                            }
                            return inline ? (
                              <code className={className} {...props} style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em' }}>{children}</code>
                            ) : (
                              <pre className={className} style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
                                <code {...props}>{children}</code>
                              </pre>
                            );
                          }
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                    {/* Feedback Icons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
                       <button onClick={() => handleFeedback(m.id, 1)} style={{ padding: 6, borderRadius: 6, background: m.feedback === 1 ? 'var(--green-bg)' : 'var(--bg-secondary)', color: m.feedback === 1 ? 'var(--green)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 150ms' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--green)'} onMouseLeave={e => e.currentTarget.style.color = m.feedback === 1 ? 'var(--green)' : 'var(--text-muted)'}>
                           <ThumbsUp size={14} />
                       </button>
                       <button onClick={() => handleFeedback(m.id, -1)} style={{ padding: 6, borderRadius: 6, background: m.feedback === -1 ? 'var(--red-bg)' : 'var(--bg-secondary)', color: m.feedback === -1 ? 'var(--red)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 150ms' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'} onMouseLeave={e => e.currentTarget.style.color = m.feedback === -1 ? 'var(--red)' : 'var(--text-muted)'}>
                           <ThumbsDown size={14} />
                       </button>
                       <button onClick={() => navigator.clipboard.writeText(m.content)} style={{ padding: 6, borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 150ms', marginLeft: 8 }} title="Copy">
                           <Copy size={14} />
                       </button>
                       <button onClick={() => speakText(m.content)} style={{ padding: 6, borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 150ms' }} title="Read Aloud">
                           <Volume2 size={14} />
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
              <Bot size={20} color="var(--text-primary)" />
            </div>
            <div style={{ display: 'flex', gap: 5, padding: '16px 0', alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-disabled)', animation: 'pulse 1s infinite' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-disabled)', animation: 'pulse 1s infinite 0.2s' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-disabled)', animation: 'pulse 1s infinite 0.4s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input Area Revamp */}
      <div style={{ padding: '0 24px 24px 24px', background: 'var(--bg)' }}>
        
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 20, display: 'flex', flexDirection: 'column', transition: 'border-color 200ms', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--text-disabled)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          
          {/* Attachments Preview inside input bar */}
          {attachments.length > 0 && (
              <div style={{ padding: '16px 16px 0 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {attachments.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px', fontSize: 13, fontWeight: 500 }}>
                          <Paperclip size={14} color="var(--text-muted)"/>
                          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                          <button onClick={() => removeAttachment(i)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex' }}><X size={14} /></button>
                      </div>
                  ))}
              </div>
          )}

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); } }}
            placeholder="Ask anything regarding news / trends"
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '16px 16px 12px 16px', fontSize: 15, resize: 'none', maxHeight: 160, minHeight: 64, fontFamily: 'inherit', color: 'var(--text-primary)', lineHeight: 1.5 }}
          />

          {/* Bottom Toolbar of Input */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}>
             
             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept={ACCEPT} multiple onChange={handleFileSelect} />
                <button onClick={() => fileInputRef.current?.click()} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '50%' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--border-light)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Attach File">
                   <Plus size={20} />
                </button>
                <button onClick={toggleVoice} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isListening ? 'white' : 'var(--text-secondary)', background: isListening ? 'var(--red)' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: '50%', transition: 'all 200ms', animation: isListening ? 'pulse 1.5s infinite' : 'none' }} onMouseEnter={e => { if(!isListening) e.currentTarget.style.background = 'var(--border-light)'}} onMouseLeave={e => { if(!isListening) e.currentTarget.style.background = 'transparent'}} title="Voice Input">
                   <Mic size={18} />
                </button>

                {/* Dropup Model Selector */}
                <div style={{ position: 'relative' }}>
                   <button onClick={() => setShowModelDropup(!showModelDropup)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer', border: 'none' }} onMouseEnter={e => e.currentTarget.style.background='var(--border-light)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      {MODELS.find(m => m.id === model)?.label} <ChevronUp size={14} style={{ transform: showModelDropup ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
                   </button>
                   
                   {showModelDropup && (
                      <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 6, minWidth: 220, zIndex: 50 }}>
                         <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Select Model</div>
                         {MODELS.map(m => (
                            <button key={m.id} onClick={() => { setModel(m.id); setShowModelDropup(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px', borderRadius: 8, background: model === m.id ? 'var(--bg-secondary)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', border: 'none' }} onMouseEnter={e => { if (model !== m.id) e.currentTarget.style.background = 'var(--bg-tertiary)'; }} onMouseLeave={e => { if (model !== m.id) e.currentTarget.style.background = 'transparent'; }}>
                               <m.Icon size={16} color={model === m.id ? 'var(--text-primary)' : 'var(--text-secondary)'} />
                               <div>
                                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.label}</div>
                                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                               </div>
                               {model === m.id && <CheckCheck size={14} style={{ marginLeft: 'auto', color: 'var(--text-primary)' }} />}
                            </button>
                         ))}
                      </div>
                   )}
                </div>
                {/* Time Machine RAG Date Pickers (only for Newsler) */}
                {model === 'newsler' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, borderLeft: '1px solid var(--border-light)', paddingLeft: 12 }}>
                    <Clock size={14} color="var(--text-muted)" />
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
                      title="Start Date"
                    />
                    <span style={{ color: 'var(--text-disabled)', fontSize: 10 }}>-</span>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
                      title="End Date"
                    />
                  </div>
                )}
             </div>

             <div>
                {loading ? (
                   <button onClick={handleStop} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--text-primary)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }} title="Stop generating">
                      <Square size={16} fill="currentColor" />
                   </button>
                ) : (
                   <button onClick={() => handleSend(input)} disabled={!input.trim() && attachments.length === 0} style={{ width: 36, height: 36, borderRadius: '50%', background: (input.trim() || attachments.length > 0) ? 'var(--text-primary)' : 'var(--bg-tertiary)', color: (input.trim() || attachments.length > 0) ? 'var(--bg)' : 'var(--text-disabled)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: (input.trim() || attachments.length > 0) ? 'pointer' : 'default', transition: 'all 150ms' }} onMouseEnter={e => { if (input.trim() || attachments.length > 0) e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                      <ArrowUp size={18} />
                   </button>
                )}
             </div>

          </div>
        </div>
      </div>
      </div>

      {activeArtifact && (
        <div style={{ width: '45%', minWidth: 400, borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', animation: 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <style>{`@keyframes slideLeft{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>
          
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)' }}>
             <div style={{ fontWeight: 600, fontSize: 14 }}>{activeArtifact.title || 'Interactive Canvas'}</div>
             <div style={{ display: 'flex', gap: 6 }}>
               <button onClick={handleDownload} style={{ padding: '4px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>Download</button>
               <button onClick={() => setActiveArtifact(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><X size={16}/></button>
             </div>
          </div>
          
          <div style={{ flex: 1, padding: 30, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {activeArtifact.type === 'chart' && (
               <div style={{ width: '100%', height: 400, background: 'var(--bg)', borderRadius: 16, border: '1px solid var(--border)', padding: '30px 30px 10px 10px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={activeArtifact.data}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                     <XAxis dataKey={activeArtifact.xKey} tick={{fontSize: 12, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                     <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                     <Tooltip contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} cursor={{fill: 'var(--bg-tertiary)'}} />
                     <Bar dataKey={activeArtifact.yKey} fill="var(--blue)" radius={[6, 6, 0, 0]} barSize={50} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}