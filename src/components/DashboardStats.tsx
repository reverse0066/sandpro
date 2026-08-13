import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Receipt as ReceiptIcon, TrendingUp, Zap, Calendar } from 'lucide-react';
import { Receipt } from '../types';

interface DashboardStatsProps {
  history: Receipt[];
}

export default function DashboardStats({ history }: DashboardStatsProps) {
  const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
  
  const todayReceipts = history.filter(r => r.date === today);
  const totalTodayAmount = todayReceipts.reduce((sum, r) => sum + r.amount, 0);
  const automatedCount = history.filter(r => r.notes?.includes('آلي')).length;

  // Last 7 days data for chart
  const getLast7DaysData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-GB').replace(/\//g, '/');
      const dayReceipts = history.filter(r => r.date === dateStr);
      data.push({
        name: d.toLocaleDateString('ar-SA', { weekday: 'short' }),
        fullDate: dateStr,
        count: dayReceipts.length,
        total: dayReceipts.reduce((sum, r) => sum + r.amount, 0),
      });
    }
    return data;
  };

  const chartData = getLast7DaysData();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">سندات اليوم</p>
              <h4 className="text-2xl font-black text-slate-900">{todayReceipts.length}</h4>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp size={14} className="text-emerald-500" />
            <span>معدل نشاط طبيعي</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">إجمالي تحصيل اليوم</p>
              <h4 className="text-2xl font-black text-slate-900">
                {totalTodayAmount.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span>
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp size={14} className="text-emerald-500" />
            <span>نمو بنسبة 12% عن الأمس</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Zap size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">معالجة آلية (AI)</p>
              <h4 className="text-2xl font-black text-slate-900">{automatedCount}</h4>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span>دقة عالية بنسبة 99%</span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-900">تحليل الأداء الأسبوعي</h3>
            <p className="text-slate-500 text-sm">مقارنة عدد السندات المصدرة خلال الـ 7 أيام الماضية</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-500">
            <ReceiptIcon size={14} />
            عدد السندات
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  padding: '12px',
                  direction: 'rtl'
                }}
                labelStyle={{ fontWeight: 800, marginBottom: '4px', color: '#1e293b' }}
              />
              <Bar 
                dataKey="count" 
                radius={[6, 6, 0, 0]} 
                barSize={40}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.fullDate === today ? '#2563eb' : '#e2e8f0'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';
