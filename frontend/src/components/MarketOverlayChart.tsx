'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Activity } from 'lucide-react';

interface DataPoint {
  date: string;
  sentiment: number;
  mentions: number;
  stock_price: number;
}

export default function MarketOverlayChart() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [company, setCompany] = useState('NVIDIA');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.financeCorrelation(company, 14);
        if (active) setData(res.timeline);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [company]);

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 20 }}>
        <select 
          value={company} 
          onChange={(e) => setCompany(e.target.value)}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
        >
          <option value="NVIDIA">NVIDIA (NVDA)</option>
          <option value="Microsoft">Microsoft (MSFT)</option>
          <option value="Apple">Apple (AAPL)</option>
        </select>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 280, width: '100%', borderRadius: 12 }}></div>
      ) : data.length === 0 ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Insufficient correlation data for {company}.
        </div>
      ) : (
        <div style={{ height: 280, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }} 
              />
              
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                stroke="var(--purple)" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11 }}
                domain={[-1, 1]}
                tickFormatter={(val) => val > 0 ? `+${val}` : val}
              />
              
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="var(--green)" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(val) => `$${val}`}
                domain={['auto', 'auto']}
              />
              
              <Tooltip 
                contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                itemStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              
              <Bar 
                yAxisId="left" 
                dataKey="sentiment" 
                name="AI Sentiment" 
                barSize={16} 
                fill="var(--purple)" 
                radius={[4, 4, 0, 0]} 
                opacity={0.8}
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="stock_price" 
                name="Price ($)" 
                stroke="var(--green)" 
                strokeWidth={2} 
                dot={{ r: 3, strokeWidth: 2 }} 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
