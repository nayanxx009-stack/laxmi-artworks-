import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { IndianRupee, Users, ShoppingBag, TrendingUp } from 'lucide-react';

export default function AdminAnalytics({ stats, orders, users }: any) {
  // Simple data generation for the graph based on real data
  const revenueByDay = orders.reduce((acc: any, order: any) => {
    if (order.paymentStatus !== 'Paid') return acc;
    const date = new Date(order.createdAt).toLocaleDateString();
    if (!acc[date]) acc[date] = 0;
    acc[date] += Number(order.amount) || 0;
    return acc;
  }, {});

  const data = Object.keys(revenueByDay).map(date => ({
    date,
    revenue: revenueByDay[date]
  })).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-14); // Last 14 days with sales

  return (
    <div className="p-6 text-white space-y-8">
      <h2 className="text-2xl font-display font-medium">Dashboard Analytics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <IndianRupee size={20} />
            <span className="font-bold uppercase tracking-widest text-xs">Total Revenue</span>
          </div>
          <div className="text-3xl font-bold">₹{stats.totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <ShoppingBag size={20} />
            <span className="font-bold uppercase tracking-widest text-xs">Total Orders</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalOrders}</div>
        </div>
        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <Users size={20} />
            <span className="font-bold uppercase tracking-widest text-xs">Total Users</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalUsers}</div>
        </div>
        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <TrendingUp size={20} />
            <span className="font-bold uppercase tracking-widest text-xs">Conversion</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalUsers > 0 ? Math.round((stats.totalOrders / stats.totalUsers) * 100) : 0}%</div>
        </div>
      </div>

      <div className="bg-neutral-800/50 p-6 rounded-2xl border border-white/5 h-96">
        <h3 className="text-lg font-bold mb-6 text-neutral-300">Revenue Trend (Days with Sales)</h3>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px' }}
                itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-500">Not enough sales data to generate graph.</div>
        )}
      </div>
    </div>
  );
}
