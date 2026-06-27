import React, { useState, useEffect } from 'react';
import { BarChart as BarChartIcon, TrendingUp, Users, Activity, Clock, Download, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Analytics = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/analytics`)
      .then(res => res.json())
      .then(resData => setData(resData))
      .catch(err => console.error('Failed to fetch analytics:', err));
  }, []);

  if (!data) {
    return (
      <div className="flex justify-center items-center h-screen w-full">
        <div className="w-12 h-12 border-4 border-white/20 border-t-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col p-8 animate-fade-in-up">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <BarChartIcon className="w-8 h-8 text-white" />
            Analytics Dashboard
          </h1>
          <p className="text-gray-400 font-medium">Track your content performance and processing metrics.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl transition-all">
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="flex items-center text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-md">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +14.5%
            </span>
          </div>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Total Views (Generated Clips)</p>
          <p className="text-3xl font-bold text-white">{data.views}</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="flex items-center text-xs font-bold text-gray-400 bg-white/10 px-2 py-1 rounded-md">
              Real Data
            </span>
          </div>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Avg Virality Score</p>
          <p className="text-3xl font-bold text-white">{data.avgVirality}</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="flex items-center text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-md">
              <ArrowDownRight className="w-3 h-3 mr-1" /> -2.1%
            </span>
          </div>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Engagement Rate</p>
          <p className="text-3xl font-bold text-white">{data.engagementRate}</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <span className="flex items-center text-xs font-bold text-gray-400 bg-white/10 px-2 py-1 rounded-md">
              Real Data
            </span>
          </div>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Processing Time Saved</p>
          <p className="text-3xl font-bold text-white">{data.timeSaved}</p>
        </div>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl">
          <h3 className="text-lg font-bold text-white mb-6">Processing Volume vs Virality</h3>
          <div className="h-64 w-full flex items-end gap-2 px-4 pb-4 border-b border-l border-white/10 relative">
            {/* Mock Chart Bars */}
            {[40, 60, 45, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2 group relative">
                <div 
                  className="w-full bg-gradient-to-t from-white/10/40 to-purple-400/80 rounded-t-sm group-hover:from-purple-400/60 group-hover:to-purple-300 transition-all"
                  style={{ height: `${val}%` }}
                ></div>
                {/* Tooltip on hover */}
                <div className="absolute -top-10 bg-black/80 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Vol: {val * 10}
                </div>
              </div>
            ))}
            <div className="absolute left-0 bottom-0 w-full flex justify-between text-[10px] text-gray-500 font-bold uppercase -mb-6">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            </div>
            <div className="absolute left-0 bottom-0 h-full flex flex-col justify-between items-end text-[10px] text-gray-500 font-bold uppercase -ml-8 py-4">
              <span>100</span><span>50</span><span>0</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">Top Performing Categories</h3>
          <div className="flex-1 flex flex-col gap-6 justify-center">
            {[
              { name: 'Podcasts', percent: 45, color: 'bg-white' },
              { name: 'Educational', percent: 30, color: 'bg-white' },
              { name: 'Gaming', percent: 15, color: 'bg-white' },
              { name: 'Vlogs', percent: 10, color: 'bg-blue-500' },
            ].map(cat => (
              <div key={cat.name}>
                <div className="flex justify-between text-sm font-bold text-gray-300 mb-2">
                  <span>{cat.name}</span>
                  <span>{cat.percent}%</span>
                </div>
                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                  <div className={`h-full ${cat.color}`} style={{ width: `${cat.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
