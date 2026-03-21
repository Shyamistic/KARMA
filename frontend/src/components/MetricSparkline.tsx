import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: any[];
  color?: string;
}

export const MetricSparkline: React.FC<SparklineProps> = ({ data, color = 'var(--accent-primary)' }) => {
  return (
    <div style={{ 
      position: 'absolute', 
      bottom: 0, 
      left: 0, 
      right: 0, 
      height: '60px', 
      pointerEvents: 'none', 
      opacity: 0.4,
      overflow: 'hidden',
      borderBottomLeftRadius: '28px',
      borderBottomRightRadius: '28px'
    }}>
      <ResponsiveContainer width="100%" height={60}>
        <LineChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={3} 
            dot={false} 
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
