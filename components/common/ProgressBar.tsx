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

const ProgressBar = ({ 
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
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-ferty-coral uppercase tracking-wide">{label || 'Progreso'}</span>
          {showPercentage && (
            <span className="text-xs font-bold text-ferty-coral">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div 
        className={`${heightClasses[height]} w-full bg-[#F9F6F4] border border-ferty-beige rounded-full overflow-hidden ${className}`}
      >
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
};

export default ProgressBar;

