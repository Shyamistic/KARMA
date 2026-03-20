import React from 'react';
import { 
  LayoutDashboard, 
  Terminal, 
  Github, 
  Tv, 
  Wallet, 
  LogOut,
  Zap,
  Users,
  UserPlus,
  Play
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'pools', label: 'Community Pools', icon: Users },
    { id: 'creators', label: 'Creators', icon: UserPlus },
    { id: 'war-room', label: 'War Room', icon: Zap },
    { id: 'github', label: 'GitHub Ops', icon: Github },
    { id: 'rumble', label: 'Rumble Ops', icon: Tv },
    { id: 'watch', label: 'Watch & Tip', icon: Play },
    { id: 'activity', label: 'Live activity', icon: Terminal },
    { id: 'treasury', label: 'Treasury', icon: Wallet },
  ];

  return (
    <aside className="sidebar">
      <div style={{ marginBottom: '3rem', padding: '0 1rem' }}>
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="gradient-text" 
          style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Zap size={24} fill="currentColor" /> Karma <span style={{ fontWeight: 300, fontSize: '0.8rem', verticalAlign: 'top', marginTop: '-10px' }}>v3</span>
        </motion.div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '4px' }}>AUTONOMOUS ORACLE</p>
      </div>

      <nav style={{ flex: 1 }}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', font: 'inherit' }}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: '0 1rem' }}>
        <button 
          onClick={onLogout}
          className="nav-item"
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', font: 'inherit', color: '#ff4b4b' }}
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
