import { useState } from 'react';
import { AlertCircle, Droplets, Heart, Moon, Thermometer, Zap } from 'lucide-react';
import { DailyLog } from '../../types';

interface Props {
  log: DailyLog;
}

const LogHistoryItem = ({ log }: Props) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-[#F4F0ED] rounded-2xl shadow-sm overflow-hidden transition-all mb-3">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-4 cursor-pointer hover:bg-[#F4F0ED]/30 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center justify-center w-12 h-12 bg-rose-50 rounded-full border border-rose-100">
              <span className="text-xs text-[#C7958E] font-bold">DÍA</span>
              <span className="text-lg font-extrabold text-[#95706B] leading-none">{log.cycleDay}</span>
            </div>

            <div>
              <p className="font-bold text-[#4A4A4A] text-sm flex items-center gap-2">
                {new Date(log.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                {log.sex && <Heart size={12} className="text-rose-500 fill-current" />}
              </p>
              <div className="flex items-center gap-3 text-xs text-[#5D7180] mt-1">
                <span className="flex items-center gap-1 bg-[#F4F0ED] px-2 py-0.5 rounded-md">
                  <Thermometer size={10} /> {log.bbt ? `${log.bbt}º` : '--'}
                </span>
                <span className="flex items-center gap-1 bg-[#F4F0ED] px-2 py-0.5 rounded-md">
                  <Droplets size={10} /> {log.mucus || '--'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {log.symptoms.length > 0 && (
              <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <AlertCircle size={10} /> {log.symptoms.length}
              </span>
            )}
            <div className="flex gap-1">
              {[...Array(log.stressLevel || 0)].map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-300"></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-[#F4F0ED]/30 text-xs space-y-2 border-t border-[#F4F0ED]">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-white rounded-lg border border-stone-100">
              <span className="block text-stone-400 uppercase text-[9px] font-bold mb-1">Sueño & Energía</span>
              <div className="flex items-center gap-2">
                <Moon size={14} className="text-indigo-300" />
                <span className="font-medium text-stone-600">
                  {log.sleepHours}h <span className="text-stone-300">|</span> Calidad {log.sleepQuality}/5
                </span>
              </div>
            </div>
            <div className="p-2 bg-white rounded-lg border border-stone-100">
              <span className="block text-stone-400 uppercase text-[9px] font-bold mb-1">Estrés</span>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-400" />
                <span className="font-medium text-stone-600">Nivel {log.stressLevel}/5</span>
              </div>
            </div>
          </div>

          {(log.cervixHeight || log.cervixFirmness || log.cervixOpenness) && (
            <div className="p-2 bg-white rounded-lg border border-stone-100">
              <span className="block text-stone-400 uppercase text-[9px] font-bold">Cérvix</span>
              <span className="font-medium text-stone-600">
                {log.cervixHeight || '-'} • {log.cervixFirmness || '-'} • {log.cervixOpenness || '-'}
              </span>
            </div>
          )}

          {log.symptoms.length > 0 && (
            <div>
              <span className="block text-stone-400 uppercase text-[9px] font-bold mb-1">Síntomas Registrados</span>
              <div className="flex flex-wrap gap-1">
                {log.symptoms.map((s) => (
                  <span key={s} className="bg-white border border-rose-100 text-[#C7958E] px-2 py-0.5 rounded-md shadow-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="p-2 bg-white rounded-lg border border-stone-100 mt-2 flex justify-between">
            <span className="text-stone-400 uppercase text-[9px] font-bold">Consumo de Alcohol</span>
            <span className={`font-bold ${log.alcohol ? 'text-rose-500' : 'text-emerald-500'}`}>
              {log.alcohol ? 'Sí' : 'No (¡Bien!)'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 bg-white rounded-lg border border-stone-100 flex items-center justify-between">
              <span className="text-stone-400 uppercase text-[9px] font-bold">Movimiento</span>
              <span className="font-bold text-stone-600">{log.activityMinutes}m</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-stone-100 flex items-center justify-between">
              <span className="text-stone-400 uppercase text-[9px] font-bold">Luz Solar</span>
              <span className="font-bold text-stone-600">{log.sunMinutes}m</span>
            </div>
          </div>

          <div className="p-2 bg-white rounded-lg border border-stone-100 mt-2 flex justify-between">
            <span className="text-stone-400 uppercase text-[9px] font-bold">Test LH</span>
            <span className={`font-bold ${log.lhTest === 'Positivo' ? 'text-rose-500' : 'text-stone-600'}`}>
              {log.lhTest}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogHistoryItem;

