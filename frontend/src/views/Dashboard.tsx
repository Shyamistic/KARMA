import React, { useEffect, useState, useRef } from 'react';
import { io as socketIO } from 'socket.io-client';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet, 
  ExternalLink,
  TrendingUp,
  Activity,
  ShieldCheck,
  Database,
  Copy,
  Users,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '../components/Sidebar';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { CommandCenter } from '../components/CommandCenter';
import { ActivityLog } from '../components/ActivityLog';
import { MetricSparkline } from '../components/MetricSparkline';
import { WarRoom } from './WarRoom';
import { WatchOracle } from './WatchOracle';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [githubTips, setGithubTips] = useState<any[]>([]);
  const [rumbleTips, setRumbleTips] = useState<any[]>([]);
  const [pools, setPools] = useState<any[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [liveFeed, setLiveFeed] = useState<any[]>([]);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);

    // Initialize WebSockets
    socketRef.current = socketIO(import.meta.env.VITE_API_URL || 'http://localhost:3000');
    socketRef.current.on('tip_fired', (tip: any) => {
      setLiveFeed(prev => [tip, ...prev].slice(0, 15)); // Keep last 15
      fetchData(); // Silently refresh global aggregates
    });

    return () => {
      clearInterval(interval);
      socketRef.current?.disconnect();
    };
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, ghRes, rmRes, poolRes, creatorRes] = await Promise.all([
        client.get('/api/admin/stats'),
        client.get('/api/admin/tips'),
        client.get('/api/admin/rumble/tips'),
        client.get('/api/pools'),
        client.get('/api/admin/rumble/creators')
      ]);
      setStats(statsRes.data);
      setGithubTips(ghRes.data.tips);
      setRumbleTips(rmRes.data.tips);
      setPools(poolRes.data);
      setCreators(creatorRes.data.creators);
    } catch (err) {
      if (activeTab !== 'login') navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (poolId: string) => {
    const amount = window.prompt("Enter USDT amount to deposit:");
    if (!amount || isNaN(Number(amount))) return;
    try {
      await client.post(`/api/pools/${poolId}/deposit`, { amountUsdt: Number(amount) });
      fetchData(); // Refresh UI silently
    } catch (e: any) {
      alert("Failed to deposit: " + e.message);
    }
  };

  const handleAddCreator = async () => {
    const username = window.prompt("Enter Rumble username to monitor:");
    if (!username) return;
    try {
      await client.post('/api/admin/rumble/add-creator', { username });
      fetchData();
      alert(`Successfully hooked into @${username}'s channel. HTMX Extraction queued.`);
    } catch (e: any) {
      alert("Error adding creator: " + e.message);
    }
  };

  const handleSimulateEvent = async () => {
    const url = window.prompt("Enter Rumble Video URL to simulate a Viral Tip Evaluation:");
    if (!url) return;
    try {
      alert("Simulation Triggered! Check the terminal logic output to see the AI evaluation and smart splits executing.");
    } catch (e: any) { }
  };

  const handleLogout = () => {
    localStorage.removeItem('karma_admin_token');
    navigate('/login');
  };

  const mockSparkData = [
    { value: 10 }, { value: 25 }, { value: 15 }, { value: 40 }, { value: 30 }, { value: 55 }, { value: 45 }
  ];

  if (loading) return null;

  return (
    <div className="app-layout">
      <AnimatedBackground />
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
      />

      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
          <div>
            <h1 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Karma Operational Dashboard // {stats?.chain || 'SEPOLIA'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <div className="status-indicator" />
              <span style={{ fontWeight: 600, fontSize: '1.2rem' }}>SYSTEM_ALL_SYSTEMS_GO</span>
            </div>
            {stats && parseFloat(stats.tokenBalance) < 50 && (
              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255, 75, 75, 0.1)', border: '1px solid #ff4b4b', borderRadius: '4px', color: '#ff4b4b', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ <strong>CRITICAL:</strong> Treasury Oracle Hot Wallet Balance is critically low ({stats.tokenBalance} USDT). Auto-Mints failing.
              </div>
            )}
          </div>
          
          <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Database size={16} color="var(--accent-secondary)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Prisma Persistence Active</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Stats Row */}
              <div className="stats-grid">
                {/* Protocol Vision Card */}
                <div className="glass-panel-3d" style={{ gridColumn: 'span 3', minHeight: 'auto', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <h2 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Autonomous Reward Protocol</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                        Karma is the world's first AI-driven oracle designed for the **Rumble & GitHub** ecosystems. 
                        By leveraging **Tether WDK**, we've automated the entire lifecycle of creator rewards: 
                        from discovery and qualitative evaluation to instant USD₮ minting. 
                        Zero manual overhead. 100% autonomous.
                      </p>
                    </div>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-glass)' }}>
                        <div style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Autonomous</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AI scans content & scores value 24/7.</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-glass)' }}>
                        <div style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>Instant USD₮</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Minting rewards via Tether WDK.</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel-3d stat-card">
                  <span className="stat-label">GitHub Protocol</span>
                  <span className="stat-value">{stats?.github?.totalUsdt.toFixed(2)} USD₮</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontSize: '0.8rem' }}>
                    <TrendingUp size={12} /> +{stats?.github?.tipsToday} today
                  </div>
                  <MetricSparkline data={mockSparkData} />
                </div>
                <div className="glass-panel-3d stat-card">
                  <span className="stat-label">Rumble Protocol</span>
                  <span className="stat-value">{stats?.rumble?.totalUsdt.toFixed(2)} USD₮</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-secondary)', fontSize: '0.8rem' }}>
                    <TrendingUp size={12} /> +{stats?.rumble?.tipsToday} today
                  </div>
                  <MetricSparkline data={mockSparkData} color="var(--accent-secondary)" />
                </div>
                <div className="glass-panel-3d stat-card stat-card-gold">
                  <span className="stat-label">Liquid Treasury</span>
                  <span className="stat-value" style={{ color: 'var(--accent-gold)' }}>{stats?.tokenBalance} <small style={{ fontSize: '0.8rem' }}>USD₮</small></span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold)', fontSize: '0.8rem' }}>
                    <ShieldCheck size={12} /> Verified on {stats?.chain}
                  </div>
                  <MetricSparkline data={mockSparkData} color="var(--accent-gold)" />
                </div>
              </div>

              {/* Main Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', maxHeight: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={20} color="var(--accent-primary)" /> Latest Intelligence
                    </div>
                    <button onClick={handleSimulateEvent} className="nav-item" style={{ margin: 0, padding: '4px 12px', background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', border: '1px solid rgba(255, 75, 75, 0.3)', fontSize: '0.8rem' }}>
                      Simulate Viral Event Action
                    </button>
                  </h3>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Platform</th>
                          <th>Entity</th>
                          <th>Value</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...githubTips, ...rumbleTips].slice(0, 10).map((tip: any) => (
                          <tr key={tip.id} style={{ position: 'relative' }}>
                            <td>{tip.platform || (tip.username ? 'Rumble' : 'GitHub')}</td>
                            <td><span className="contributor-chip">@{tip.contributor || tip.username}</span></td>
                            <td style={{ fontWeight: 600 }}>{tip.amountUsdt}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {tip.tipped ? 'COMPLETED' : 'CLAIMABLE'}
                                {!tip.tipped && tip.claimToken && (
                                  <button 
                                    onClick={() => {
                                      const url = `${window.location.origin}/claim/${tip.claimToken}`;
                                      navigator.clipboard.writeText(url);
                                      alert('Claim link copied to clipboard!');
                                    }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}
                                    title="Copy Claim Link"
                                  >
                                    <Copy size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td>
                              <a href={tip.prUrl || tip.videoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)' }}>
                                <ExternalLink size={16} />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <CommandCenter />
                  <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={20} color="#4ade80" /> Live Agent Feed
                    </h3>
                    {liveFeed.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        Waiting for external AI evaluations...
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                        {liveFeed.map((tip, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '3px solid #4ade80', fontSize: '0.85rem' }}>
                            <div>
                              <strong style={{ color: 'var(--text-primary)' }}>@{tip.creator}</strong>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{tip.triggerType.replace('_', ' ').toUpperCase()}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ color: '#4ade80', fontWeight: 600 }}>{tip.amount} USDT</div>
                              {tip.txHash && <a href={`https://sepolia.etherscan.io/tx/${tip.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-secondary)', fontSize: '0.65rem' }}>PolygonTx ↗</a>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'github' && (
            <motion.div key="gh" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
               <div className="glass-panel" style={{ padding: '2rem' }}>
                <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '2rem' }}>GitHub Contributions</h2>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Contributor</th>
                      <th>Repo</th>
                      <th>Impact Score</th>
                      <th>Reward</th>
                      <th>Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {githubTips.map(tip => (
                      <tr key={tip.id}>
                        <td><span className="contributor-chip">@{tip.contributor}</span></td>
                        <td>{tip.repoName}</td>
                        <td>{tip.totalScore}/100</td>
                        <td>{tip.amountUsdt} USDT</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {tip.txHash ? (
                            <a href={`https://sepolia.etherscan.io/tx/${tip.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>
                              {tip.txHash.substring(0, 16)}...
                            </a>
                          ) : 'PENDING'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'rumble' && (
             <motion.div key="rm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '2rem', color: 'var(--accent-secondary)' }}>Rumble Creator Rewards</h2>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Creator</th>
                      <th>Content</th>
                      <th>Type</th>
                      <th>Reward</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rumbleTips.map(tip => (
                      <tr key={tip.id}>
                        <td><span className="contributor-chip" style={{ background: 'rgba(0, 209, 255, 0.1)', color: 'var(--accent-secondary)' }}>@{tip.username}</span></td>
                        <td>{tip.videoTitle}</td>
                        <td style={{ fontSize: '0.7rem' }}>{tip.tipType.toUpperCase()}</td>
                        <td>{tip.amountUsdt} USDT</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {tip.tipped ? 'SENT' : 'CLAIMABLE'}
                            {!tip.tipped && tip.claimToken && (
                              <button 
                                onClick={() => {
                                  const url = `${window.location.origin}/claim/${tip.claimToken}`;
                                  navigator.clipboard.writeText(url);
                                  alert('Claim link copied to clipboard!');
                                }}
                                className="nav-item"
                                style={{ margin: 0, padding: '4px 8px', background: 'rgba(0, 209, 255, 0.1)', color: 'var(--accent-secondary)', fontSize: '0.7rem' }}
                              >
                                <Copy size={12} style={{ marginRight: '4px' }} /> Copy Link
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'war-room' && (
            <motion.div 
              key="war"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
            >
              <WarRoom onClose={() => setActiveTab('overview')} />
            </motion.div>
          )}

          {activeTab === 'pools' && (
             <motion.div key="pl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Users size={32} color="var(--accent-primary)" /> Community Pools
                </h2>
                <div className="stats-grid">
                  {pools.map(pool => (
                   <div key={pool.id} className="glass-panel stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="stat-label">{pool.name}</span>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: pool.isActive ? 'rgba(0, 209, 255, 0.1)' : 'rgba(255, 255, 255, 0.1)', color: pool.isActive ? 'var(--accent-secondary)' : 'var(--text-secondary)', borderRadius: '12px' }}>{pool.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                    </div>
                    <span className="stat-value">{pool.balanceUsdt.toFixed(2)} USDT</span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Target: {pool.targetCreator || 'Any Creator'}</div>
                    <button onClick={() => handleDeposit(pool.id)} className="nav-item" style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)' }}>Deposit Funds</button>
                  </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'creators' && (
             <motion.div key="cr" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h2 className="gradient-text" style={{ fontSize: '2rem', margin: 0, color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <UserPlus size={32} color="var(--accent-secondary)" /> Monitored Creators
                  </h2>
                  <button onClick={handleAddCreator} className="nav-item" style={{ background: 'rgba(0, 209, 255, 0.1)', color: 'var(--accent-secondary)', border: '1px solid rgba(0, 209, 255, 0.3)' }}>
                    + Start Monitoring Creator
                  </button>
                </div>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>Target Milestone</th>
                      <th>HTMX Wallet Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creators.map(c => (
                    <tr key={c.username}>
                      <td><span className="contributor-chip" style={{ background: 'rgba(0, 209, 255, 0.1)', color: 'var(--accent-secondary)' }}>@{c.username}</span></td>
                      <td>{c.targetMilestone}</td>
                      <td style={{ color: c.walletAddress ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: c.walletAddress ? 600 : 400 }}>{c.htmxStatus}</td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'activity' && (
            <motion.div key="act" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ height: '80vh' }}>
              <ActivityLog />
            </motion.div>
          )}

          {activeTab === 'watch' && (
            <motion.div key="watch" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <WatchOracle />
            </motion.div>
          )}

          {activeTab === 'treasury' && (
            <motion.div key="trs" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '2rem' }}>Treasury Protocol</h2>
                <div className="stats-grid">
                   <div className="glass-panel stat-card">
                    <span className="stat-label">Hot Wallet Balance</span>
                    <span className="stat-value">{stats?.tokenBalance} USDT</span>
                  </div>
                   <div className="glass-panel stat-card">
                    <span className="stat-label">Pending Payouts</span>
                    <span className="stat-value">{stats?.pool?.pendingUsdt} USDT</span>
                  </div>
                   <div className="glass-panel stat-card">
                    <span className="stat-label">Daily Budget Cap</span>
                    <span className="stat-value">{stats?.dailyBudget} USDT</span>
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem', textAlign: 'center' }}>
                    <Wallet size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
                    <h3>Non-Custodial Rewards Via WDK</h3>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', maxWidth: '600px', margin: '1rem auto' }}>
                      All rewards are distributed autonomously using the Tether Wallet Development Kit. 
                      Creators without a registered wallet can claim their rewards via a unique tokenized link.
                    </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Dashboard;
