import { motion } from 'framer-motion';

export const AnimatedBackground = () => {
  return (
    <>
      <div className="bg-mesh" />
      <div className="bg-nebula" />
      <div className="bg-dot-grid" />
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
              opacity: Math.random() * 0.3 + 0.1
            }}
            animate={{ 
              y: [null, Math.random() * -100, Math.random() * 100],
              x: [null, Math.random() * 50, Math.random() * -50],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ 
              duration: Math.random() * 10 + 10, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            style={{
              position: 'absolute',
              width: Math.random() * 4 + 2,
              height: Math.random() * 4 + 2,
              borderRadius: '50%',
              background: i % 2 === 0 ? 'var(--accent-primary)' : 'var(--accent-secondary)',
              filter: 'blur(2px)'
            }}
          />
        ))}
      </div>
    </>
  );
};
