import { memo } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  target?: string | number;
  unit?: string;
  icon: LucideIcon;
  hideTarget?: boolean;
}

const StatCard = memo(({ title, value, target, unit, icon: Icon, hideTarget }: StatCardProps) => {
  const isGood = target !== undefined && parseFloat(String(value)) >= parseFloat(String(target));
  const bgClass = hideTarget ? 'bg-white' : isGood ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-ferty-rose';

  return (
    <div className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-ferty-beige flex items-center justify-between relative overflow-hidden group hover:border-ferty-rose/30 transition-colors">
      <div className="relative z-10">
        <p className="text-[10px] text-ferty-gray font-bold uppercase tracking-wider">{title}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-lg font-bold text-ferty-dark">{value}</span>
          {unit && <span className="text-xs text-stone-400 ml-1">{unit}</span>}
        </div>
        {!hideTarget && target !== undefined && (
          <div className={`text-[10px] mt-1 font-medium ${isGood ? 'text-emerald-500' : 'text-ferty-coral'}`}>
            Meta: {target} {unit}
          </div>
        )}
      </div>
      <div className={`p-3.5 rounded-full ${bgClass} relative z-10 shadow-sm`}>
        <Icon size={28} className={hideTarget ? 'text-ferty-coral' : 'currentColor'} strokeWidth={1.5} />
      </div>
    </div>
  );
});

StatCard.displayName = 'StatCard';

export default StatCard;

