import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Target, Zap, Globe, Cpu, X } from 'lucide-react';
import { ActivityLog } from '../components/ActivityLog';

export const WarRoom: React.FC<{ onClose: () => void }> = ({ onClose }) => {

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'var(--bg-darker)', 
      zIndex: 100, 
      display: 'flex', 
      flexDirection: 'column',
      padding: '2rem'
    }}>
      <div className="bg-nebula" style={{ opacity: 0.3 }} />
      <div className="bg-dot-grid" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Zap size={32} color="var(--accent-primary)" fill="currentColor" />
          <div>
            <h1 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 800 }}>KARMA_WAR_ROOM</h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '2px' }}>V3.0 // OPERATIONAL_INTELLIGENCE</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="status-indicator" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>AGENT_LEVEL_01_ACTIVE</span>
          </div>
          <button 
            onClick={onClose}
            className="glass-panel" 
            style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,50,50,0.1)', color: 'white', border: '1px solid rgba(255,50,50,0.2)' }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '2rem', flex: 1 }}>
        
        {/* Left Side: System Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="glass-panel-3d" 
            style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}
          >
            <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>CORE_REASONING</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Cpu size={24} color="var(--accent-primary)" />
              <span style={{ fontWeight: 600 }}>GEMINI_PRO_FLASH_1.5</span>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="glass-panel-3d" 
            style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-secondary)' }}
          >
            <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>HACKATHON_TRACK</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Shield size={24} color="var(--accent-secondary)" />
              <span style={{ fontWeight: 600 }}>TIPPING_BOT_V3</span>
            </div>
          </motion.div>
        </div>

        {/* Center: Tactical Map (Orbital View) */}
        <div className="glass-panel-3d" style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            style={{ 
              width: '400px', 
              height: '400px', 
              border: '1px dashed rgba(0, 255, 189, 0.2)', 
              borderRadius: '50%',
              position: 'relative'
            }}
          >
            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)' }}>
              <div className="status-indicator" />
            </div>
            <div style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)' }}>
               <Target size={20} color="var(--accent-secondary)" />
            </div>
          </motion.div>

          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
              style={{ padding: '2rem', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', border: '1px solid var(--border-glass)' }}
            >
              <Globe size={64} className="gradient-text" />
            </motion.div>
            <h2 style={{ marginTop: '1rem', fontWeight: 800 }}>SCANNING_RUMBLE</h2>
          </div>
        </div>

        {/* Right Side: Activity Log */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ActivityLog />
        </div>
      </div>
    </div>
  );
};
