import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Server, 
  ShieldCheck, 
  Settings, 
  Bell, 
  LogOut, 
  TrendingUp, 
  Activity,
  Globe,
  Database
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// Mock data for initial UI
const usageData = [
  { name: '00:00', usage: 400 },
  { name: '04:00', usage: 300 },
  { name: '08:00', usage: 600 },
  { name: '12:00', usage: 800 },
  { name: '16:00', usage: 500 },
  { name: '20:00', usage: 900 },
  { name: '23:59', usage: 700 },
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    totalUsers: '1,284',
    activeSessions: '342',
    serverLoad: '64%',
    revenue: '$12,490'
  });

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-container" style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="nerox-gradient" style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={24} color="#fff" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px' }}>NEROX <span style={{ color: 'var(--accent-primary)' }}>VPN</span></h2>
        </div>

        <nav style={{ flex: 1 }}>
          <SidebarLink 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarLink 
            icon={<Users size={20} />} 
            label="Users" 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')} 
          />
          <SidebarLink 
            icon={<Server size={20} />} 
            label="Servers" 
            active={activeTab === 'servers'} 
            onClick={() => setActiveTab('servers')} 
          />
          <SidebarLink 
            icon={<TrendingUp size={20} />} 
            label="Analytics" 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')} 
          />
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '20px 0' }} />
          <SidebarLink 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>

        <div className="user-profile" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>A</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: '600' }}>Admin</p>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Superuser</p>
          </div>
          <LogOut size={16} color="var(--text-secondary)" style={{ cursor: 'pointer' }} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '32px', marginBottom: '4px' }}>Welcome back, <span className="text-gradient">Admin</span></h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Here's what's happening with Nerox VPN today.</p>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div className="glass" style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Bell size={20} color="var(--text-secondary)" />
            </div>
            <button className="nerox-gradient" style={{ border: 'none', padding: '0 24px', borderRadius: '12px', color: '#fff', fontWeight: '600', height: '44px', cursor: 'pointer' }}>
              Add New Server
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
          <StatCard icon={<Users color="var(--accent-primary)" />} label="Total Users" value={stats.totalUsers} trend="+12% vs last week" />
          <StatCard icon={<Activity color="#3B82F6" />} label="Active Sessions" value={stats.activeSessions} trend="24 online now" />
          <StatCard icon={<Database color="#F59E0B" />} label="Server Load" value={stats.serverLoad} trend="Optimal performance" />
          <StatCard icon={<TrendingUp color="#10B981" />} label="Total Revenue" value={stats.revenue} trend="+5% this month" />
        </div>

        {/* Charts Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div className="glass card">
            <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Globe size={18} color="var(--accent-primary)" /> Network Usage Trend
            </h3>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageData}>
                  <defs>
                    <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}MB`} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="usage" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorUsage)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass card">
            <h3 style={{ marginBottom: '24px' }}>Recent Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <ActivityItem user="John Doe" action="Connected to USA-1" time="2m ago" />
              <ActivityItem user="Sarah Smith" action="Upgraded to Premium" time="15m ago" />
              <ActivityItem user="Mike Ross" action="Changed Protocol to WireGuard" time="45m ago" />
              <ActivityItem user="Admin" action="Added Frankfurt Server" time="1h ago" />
              <ActivityItem user="Dave Lee" action="Reported Login Issue" time="2h ago" />
            </div>
            <button style={{ marginTop: '24px', width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '500' }}>
              View All Logs
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        padding: '12px 16px', 
        borderRadius: '10px', 
        marginBottom: '4px',
        cursor: 'pointer',
        transition: 'var(--transition-smooth)',
        backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
        fontWeight: active ? '600' : '500'
      }}
      className="sidebar-link"
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatCard({ icon, label, value, trend }: { icon: any, label: string, value: string, trend: string }) {
  return (
    <div className="glass card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>{icon}</div>
        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 'bold' }}>LIVE</span>
      </div>
      <p className="stat-label" style={{ marginTop: '16px' }}>{label}</p>
      <h2 className="stat-value">{value}</h2>
      <p style={{ fontSize: '12px', color: trend.includes('+') ? 'var(--success)' : 'var(--text-secondary)', marginTop: '8px', fontWeight: '500' }}>{trend}</p>
    </div>
  );
}

function ActivityItem({ user, action, time }: { user: string, action: string, time: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: '600' }}>{user}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{action}</p>
        </div>
      </div>
      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{time}</span>
    </div>
  );
}

export default App;
