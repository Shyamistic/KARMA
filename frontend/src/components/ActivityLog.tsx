import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LogEntry {
  id: string;
  timestamp: string;
  source: 'RUMBLE' | 'GITHUB' | 'CORE' | 'WDK';
  message: string;
}

export const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulated live feed for demo/experience
    const mockMessages = [
      { source: 'WDK', message: 'Checking wallet balance on Sepolia...' },
      { source: 'RUMBLE', message: 'Fetching metrics for @Asmongold...' },
      { source: 'CORE', message: 'Analyzing GitHub event payload: pull_request.merged' },
      { source: 'GITHUB', message: 'Evaluating PR #124: "Updated documentation for WDK"...' },
      { source: 'WDK', message: 'Transfer successful: 25.00 USDT → 0x8a...42' },
      { source: 'RUMBLE', message: 'Milestone reached: 1000 views for "Tether Ecosystem Update"' },
    ];

    const interval = setInterval(() => {
      const msg = mockMessages[Math.floor(Math.random() * mockMessages.length)];
      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        source: msg.source as any,
        message: msg.message
      };
      setLogs(prev => [...prev.slice(-15), newLog]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-glass)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="status-indicator" /> LIVE_ORACLE_STREAM
      </div>
      <div 
        ref={scrollRef}
        style={{ flex: 1, padding: '1rem', overflowY: 'auto', fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' }}
      >
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}
            >
              <span style={{ color: 'var(--text-secondary)', minWidth: '65px' }}>[{log.timestamp}]</span>
              <span style={{ 
                color: log.source === 'WDK' ? 'var(--accent-secondary)' : 
                       log.source === 'CORE' ? 'var(--accent-purple)' : 
                       'var(--accent-primary)',
                fontWeight: 600
              }}>[{log.source}]</span>
              <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
