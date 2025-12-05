import { memo } from 'react';

interface ProgressBarProps {
  percentage: number;
  color?: 'rose' | 'coral' | 'flora' | 'gray' | 'rose-gradient';
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  showPercentage?: boolean;
  className?: string;
  containerClassName?: string;
}

const ProgressBar = memo(({ 
  percentage, 
  color = 'flora',
  height = 'md',
  showLabel = false,
  label,
  showPercentage = false,
  className = '',
  containerClassName = ''
}: ProgressBarProps) => {
  const colorClasses = {
    rose: 'bg-ferty-rose',
    coral: 'bg-ferty-coral',
    flora: 'bg-[#9ECCB4]', // ferty.flora.dark - usando valor directo porque Tailwind no soporta bien objetos anidados profundos
    gray: 'bg-ferty-gray',
    'rose-gradient': 'bg-gradient-to-r from-ferty-rose to-ferty-coral'
  };
  
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-1.5'
  };
  
  return (
    <div className={containerClassName}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold text-ferty-gray">{label || 'Progreso'}</p>
          {showPercentage && (
            <p className="text-[10px] font-bold text-ferty-coral">{Math.round(percentage)}%</p>
          )}
        </div>
      )}
      <div className={`${heightClasses[height]} w-full ${!className.includes('bg-') ? 'bg-white border border-ferty-beige' : ''} rounded-full overflow-hidden ${className}`}>
        <div 
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-1000`}
          style={{ 
            width: `${Math.max(0, Math.min(100, percentage))}%`,
            minWidth: percentage > 0 ? '2px' : '0px'
          }}
        />
      </div>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;

