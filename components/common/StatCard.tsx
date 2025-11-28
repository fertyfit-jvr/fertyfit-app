import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  target?: string | number;
  unit?: string;
  icon: LucideIcon;
  hideTarget?: boolean;
}

const StatCard = ({ title, value, target, unit, icon: Icon, hideTarget }: StatCardProps) => {
  const isGood = target !== undefined && parseFloat(String(value)) >= parseFloat(String(target));
  const bgClass = hideTarget ? 'bg-white' : isGood ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-[#C7958E]';

  return (
    <div className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#F4F0ED] flex items-center justify-between relative overflow-hidden group hover:border-[#C7958E]/30 transition-colors">
      <div className="relative z-10">
        <p className="text-[10px] text-[#5D7180] font-bold uppercase tracking-wider">{title}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-lg font-bold text-[#4A4A4A]">{value}</span>
          {unit && <span className="text-xs text-stone-400 ml-1">{unit}</span>}
        </div>
        {!hideTarget && target !== undefined && (
          <div className={`text-[10px] mt-1 font-medium ${isGood ? 'text-emerald-500' : 'text-[#95706B]'}`}>
            Meta: {target} {unit}
          </div>
        )}
      </div>
      <div className={`p-3.5 rounded-full ${bgClass} relative z-10 shadow-sm`}>
        <Icon size={28} className={hideTarget ? 'text-[#95706B]' : 'currentColor'} strokeWidth={1.5} />
      </div>
    </div>
  );
};

export default StatCard;

