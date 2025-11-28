import { useEffect } from 'react';
import { Minus, Plus, Droplets, Leaf } from 'lucide-react';
import InputField from '../../components/forms/InputField';
import LogHistoryItem from '../../components/common/LogHistoryItem';
import {
  MUCUS_OPTIONS,
  LH_OPTIONS,
  CERVIX_HEIGHT_OPTIONS,
  CERVIX_FIRM_OPTIONS,
  CERVIX_OPEN_OPTIONS
} from '../../constants';
import { ConsultationForm, DailyLog, LHResult, MucusType } from '../../types';

type SetTodayLog = (
  value: Partial<DailyLog> | ((prev: Partial<DailyLog>) => Partial<DailyLog>)
) => void;

interface TrackerViewProps {
  todayLog: Partial<DailyLog>;
  setTodayLog: SetTodayLog;
  submittedForms: ConsultationForm[];
  logs: DailyLog[];
  handleDateChange: (newDate: string) => void;
  saveDailyLog: () => void;
}

const TrackerView = ({
  todayLog,
  setTodayLog,
  submittedForms,
  logs,
  handleDateChange,
  saveDailyLog
}: TrackerViewProps) => {
  useEffect(() => {
    if (todayLog.date && todayLog.cycleDay === 1 && submittedForms.length > 0) {
      handleDateChange(todayLog.date);
    }
  }, [submittedForms, todayLog.cycleDay, todayLog.date, handleDateChange]);

  return (
    <div className="pb-24 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#4A4A4A]">Registro Diario</h2>
        <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-[#5D7180] shadow-sm font-medium">
          {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-[#F4F0ED] space-y-8">
        <div className="space-y-6">
          <h3 className="text-xs font-bold text-[#95706B] uppercase tracking-widest border-b border-[#F4F0ED] pb-2">Fisiología</h3>

          <div className="flex items-center justify-between bg-[#F4F0ED]/50 p-4 rounded-2xl">
            <div>
              <span className="text-sm font-bold text-[#5D7180] block">Día del Ciclo</span>
              <span className="text-[10px] text-[#C7958E] font-bold bg-[#C7958E]/10 px-2 py-0.5 rounded-full">Automático</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold text-[#4A4A4A] w-12 text-center">{todayLog.cycleDay || 1}</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#F4F0ED]/50 p-4 rounded-2xl">
            <span className="text-sm font-bold text-[#5D7180]">Temperatura Basal</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  setTodayLog((prev) => ({
                    ...prev,
                    bbt: parseFloat(Math.max(35.0, ((prev.bbt || 36.5) - 0.1)).toFixed(2))
                  }))
                }
                className="p-2 bg-white rounded-full shadow-sm text-[#95706B] hover:scale-110 transition-transform"
              >
                <Minus size={18} />
              </button>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="35.00"
                  max="40.00"
                  placeholder="36.50"
                  value={todayLog.bbt || ''}
                  onChange={(e) => setTodayLog({ ...todayLog, bbt: parseFloat(e.target.value) })}
                  className="w-20 text-center bg-transparent text-2xl font-bold text-[#C7958E] outline-none border-b border-transparent focus:border-[#C7958E] transition-colors p-0"
                />
                <span className="absolute -right-4 top-1 text-xs font-bold text-[#95706B]">°C</span>
              </div>
              <button
                onClick={() =>
                  setTodayLog((prev) => ({
                    ...prev,
                    bbt: parseFloat(Math.min(40.0, ((prev.bbt || 36.5) + 0.1)).toFixed(2))
                  }))
                }
                className="p-2 bg-white rounded-full shadow-sm text-[#95706B] hover:scale-110 transition-transform"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <InputField label="Moco Cervical">
            <div className="flex flex-wrap gap-2">
              {MUCUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setTodayLog({ ...todayLog, mucus: option as MucusType })}
                  className={`text-xs px-4 py-2 rounded-full border transition-all font-medium ${todayLog.mucus === option ? 'bg-[#C7958E] text-white border-[#C7958E]' : 'bg-white border-[#F4F0ED] text-[#5D7180] hover:border-[#C7958E]'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </InputField>

          <InputField label="Test LH">
            <div className="flex flex-wrap gap-2">
              {LH_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setTodayLog({ ...todayLog, lhTest: option as LHResult })}
                  className={`text-xs px-4 py-2 rounded-full border transition-all font-medium ${todayLog.lhTest === option ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-[#F4F0ED] text-[#5D7180] hover:border-indigo-200'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </InputField>

          <div className="bg-[#F4F0ED]/50 p-4 rounded-xl border border-[#F4F0ED]">
            <span className="text-xs font-bold text-[#5D7180] block mb-3 uppercase">Cérvix (Opcional)</span>
            <div className="grid grid-cols-3 gap-2">
              <select
                className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-[#5D7180]"
                value={todayLog.cervixHeight}
                onChange={(e) => setTodayLog({ ...todayLog, cervixHeight: e.target.value as any })}
              >
                <option value="">Altura...</option>
                {CERVIX_HEIGHT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-[#5D7180]"
                value={todayLog.cervixFirmness}
                onChange={(e) => setTodayLog({ ...todayLog, cervixFirmness: e.target.value as any })}
              >
                <option value="">Firmeza...</option>
                {CERVIX_FIRM_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-[#5D7180]"
                value={todayLog.cervixOpenness}
                onChange={(e) => setTodayLog({ ...todayLog, cervixOpenness: e.target.value as any })}
              >
                <option value="">Apertura...</option>
                {CERVIX_OPEN_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between bg-rose-50/50 p-4 rounded-xl border border-rose-100/50">
            <span className="font-bold text-[#95706B] text-sm">Relaciones Sexuales</span>
            <button
              onClick={() => setTodayLog({ ...todayLog, sex: !todayLog.sex })}
              className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${todayLog.sex ? 'bg-[#C7958E]' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${todayLog.sex ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="space-y-6 border-t border-[#F4F0ED] pt-6">
          <h3 className="text-xs font-bold text-[#95706B] uppercase tracking-widest">Hábitos & Bienestar</h3>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-bold text-[#5D7180]">Horas de Sueño</span>
              <span className="text-sm font-bold text-[#4A4A4A]">{todayLog.sleepHours || 0}h</span>
            </div>
            <input
              type="range"
              min="0"
              max="12"
              step="0.5"
              value={todayLog.sleepHours || 7}
              onChange={(e) => setTodayLog({ ...todayLog, sleepHours: parseFloat(e.target.value) })}
              className="w-full accent-[#5D7180] h-2 bg-[#F4F0ED] rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>0h</span>
              <span>6h</span>
              <span>12h</span>
            </div>
          </div>

          <div>
            <span className="text-sm font-bold text-[#5D7180] block mb-2">Nivel de Estrés</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setTodayLog({ ...todayLog, stressLevel: value })}
                  className={`flex-1 h-10 rounded-xl font-bold transition-all ${
                    todayLog.stressLevel === value ? 'bg-[#C7958E] text-white shadow-lg scale-105' : 'bg-[#F4F0ED] text-[#5D7180] hover:bg-stone-200'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-sm font-bold text-[#5D7180] block mb-2">Actividad (min)</span>
              <input
                type="range"
                min="0"
                max="120"
                step="15"
                value={todayLog.activityMinutes || 0}
                onChange={(e) => setTodayLog({ ...todayLog, activityMinutes: parseInt(e.target.value) })}
                className="w-full accent-[#C7958E] h-2 bg-[#F4F0ED] rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-center text-xs font-bold text-[#C7958E] mt-1">{todayLog.activityMinutes || 0} min</p>
            </div>
            <div>
              <span className="text-sm font-bold text-[#5D7180] block mb-2">Luz Solar (min)</span>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={todayLog.sunMinutes || 0}
                onChange={(e) => setTodayLog({ ...todayLog, sunMinutes: parseInt(e.target.value) })}
                className="w-full accent-amber-400 h-2 bg-[#F4F0ED] rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-center text-xs font-bold text-amber-500 mt-1">{todayLog.sunMinutes || 0} min</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold text-[#5D7180]">Agua (Vasos)</span>
                <span className="text-xs font-bold text-blue-500">{todayLog.waterGlasses || 0} / 8</span>
              </div>
              <div className="flex justify-between">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                  <button
                    key={value}
                    onClick={() => setTodayLog({ ...todayLog, waterGlasses: value === todayLog.waterGlasses ? value - 1 : value })}
                    className="hover:scale-110 transition-transform"
                  >
                    <Droplets size={20} className={value <= (todayLog.waterGlasses || 0) ? 'text-blue-400 fill-blue-400' : 'text-blue-200'} />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold text-[#5D7180]">Vegetales (Raciones)</span>
                <span className="text-xs font-bold text-emerald-600">{todayLog.veggieServings || 0} / 5</span>
              </div>
              <div className="flex justify-start gap-4">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setTodayLog({ ...todayLog, veggieServings: value === todayLog.veggieServings ? value - 1 : value })}
                    className="hover:scale-110 transition-transform"
                  >
                    <Leaf size={24} className={value <= (todayLog.veggieServings || 0) ? 'text-emerald-500 fill-emerald-500' : 'text-emerald-200'} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white border border-[#F4F0ED] p-4 rounded-xl">
            <span className="font-bold text-[#5D7180] text-sm">Consumo de Alcohol</span>
            <button
              onClick={() => setTodayLog({ ...todayLog, alcohol: !todayLog.alcohol })}
              className={`w-12 h-6 rounded-full relative transition-colors	duration-300 ${todayLog.alcohol ? 'bg-[#C7958E]' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${todayLog.alcohol ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <button onClick={saveDailyLog} className="w-full bg-[#4A4A4A] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black transition-colors mt-4">
          Guardar Registro Diario
        </button>
      </div>

      <div>
        <h3 className="font-bold text-[#4A4A4A] mb-4 flex items-center gap-2 text-sm uppercase tracking-wider opacity-80">Historial Reciente</h3>
        <div className="space-y-2">
          {logs.slice(0, 7).map((log) => (
            <LogHistoryItem key={log.date} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrackerView;

