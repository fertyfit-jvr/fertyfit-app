import { useEffect, useState } from 'react';
import { Minus, Plus, Droplets, Leaf, X, Heart } from 'lucide-react';
import InputField from '../../components/forms/InputField';
import LogHistoryItem from '../../components/common/LogHistoryItem';
import {
  MUCUS_OPTIONS,
  LH_OPTIONS,
  CERVIX_HEIGHT_OPTIONS,
  CERVIX_FIRM_OPTIONS,
  CERVIX_OPEN_OPTIONS,
  PERIOD_SYMPTOM_OPTIONS
} from '../../constants';
import { ConsultationForm, DailyLog, LHResult, MucusType, UserProfile } from '../../types';
import { supabase } from '../../services/supabase';
import { handlePeriodConfirmed } from '../../services/RuleEngine';
import { calcularCicloPromedio, calcularDiaDelCiclo } from '../../services/CycleCalculations';
import { parseLocalDateOrToday } from '../../services/dateUtils';
import { calcularVentanaFertil, calcularFechaInicioCicloActual } from '../../services/CycleCalculations';
import { formatDate, formatCurrentDate } from '../../services/utils';
import { logger } from '../../lib/logger';

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
  user: UserProfile | null;
  onUserUpdate?: (updatedUser: UserProfile) => void;
  showNotif?: (msg: string, type: 'success' | 'error') => void;
  fetchUserForms?: (userId: string) => Promise<void>;
}

const TrackerView = ({
  todayLog,
  setTodayLog,
  submittedForms,
  logs,
  handleDateChange,
  saveDailyLog,
  user,
  onUserUpdate,
  showNotif,
  fetchUserForms
}: TrackerViewProps) => {
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [lastPeriodDate, setLastPeriodDate] = useState(user?.lastPeriodDate || '');
  const [selectedPeriodSymptoms, setSelectedPeriodSymptoms] = useState<string[]>([]);
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);

  // Calcular ventana fértil
  const ventanaFertil = user?.cycleLength
    ? calcularVentanaFertil(user.cycleLength)
    : null;

  // Determinar fase del ciclo
  const getFaseCiclo = (cycleDay: number, cycleLength: number): string => {
    if (!cycleDay || !cycleLength) return '';

    const diaOvulacion = cycleLength - 14; // Fórmula estándar: ciclo - 14 días

    if (cycleDay < diaOvulacion) {
      return 'Fase Folicular';
    } else if (cycleDay >= diaOvulacion && cycleDay <= diaOvulacion + 1) {
      return 'Fase Ovulatoria';
    } else {
      return 'Fase Lútea';
    }
  };

  const faseActual = user?.cycleLength && todayLog.cycleDay
    ? getFaseCiclo(todayLog.cycleDay, user.cycleLength)
    : null;

  useEffect(() => {
    if (!user) return;

    setLastPeriodDate(user.lastPeriodDate || '');

    // Actualizar el día del ciclo cuando cambia el usuario o sus datos del ciclo
    // Solo actualizar si realmente cambió lastPeriodDate o cycleLength
    if (user.lastPeriodDate && user.cycleLength) {
      try {
        const currentCycleDay = calcularDiaDelCiclo(user.lastPeriodDate, user.cycleLength);
        if (currentCycleDay > 0) {
          setTodayLog(prev => {
            // Solo actualizar si el cicloDay es diferente para evitar loops
            if (prev.cycleDay !== currentCycleDay) {
              return {
                ...prev,
                cycleDay: currentCycleDay
              };
            }
            return prev;
          });
        }
      } catch (error) {
        logger.error('Error calculating cycle day:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.lastPeriodDate, user?.cycleLength]);


  // Inicializar datos cuando se abre el modal de ciclo
  useEffect(() => {
    if (isCycleModalOpen && user) {
      // Sincronizar fecha de última regla
      setLastPeriodDate(user.lastPeriodDate || '');

      // Buscar log del día de la última regla para cargar síntomas existentes
      if (user.lastPeriodDate) {
        const lastPeriodLog = logs.find(log => log.date === user.lastPeriodDate);
        if (lastPeriodLog?.symptoms) {
          setSelectedPeriodSymptoms(lastPeriodLog.symptoms);
        } else {
          setSelectedPeriodSymptoms([]);
        }
      } else {
        setSelectedPeriodSymptoms([]);
      }
    }
  }, [isCycleModalOpen, user, logs]);

  // Guardar período actualizado (desde el modal de edición)
  const handleSaveCycleData = async () => {
    if (!user || !user.id || !lastPeriodDate) {
      showNotif?.('Por favor, indica la fecha de tu última regla', 'error');
      return;
    }

    setIsSavingPeriod(true);

    try {
      // 1. Usar handlePeriodConfirmed para actualizar fecha y auto-calcular ciclo promedio
      const result = await handlePeriodConfirmed(user.id, lastPeriodDate);

      // 2. Crear/actualizar log del día con los síntomas seleccionados
      const { error: logError } = await supabase
        .from('daily_logs')
        .upsert({
          user_id: user.id,
          date: lastPeriodDate,
          cycle_day: 1, // Día 1 es cuando viene la regla
          symptoms: selectedPeriodSymptoms.length > 0 ? selectedPeriodSymptoms : []
        }, {
          onConflict: 'user_id,date'
        });

      if (logError) {
        logger.error('Error al crear log del período:', logError);
        // No fallar si el log no se puede crear
      }

      // 3. Recargar perfil completo para obtener el nuevo ciclo promedio calculado
      const { data: refreshedProfile } = await supabase
        .from('profiles')
        .select('last_period_date, cycle_length, period_history')
        .eq('id', user.id)
        .single();

      if (refreshedProfile && user) {
        const updatedUser = {
          ...user,
          lastPeriodDate: refreshedProfile.last_period_date,
          cycleLength: refreshedProfile.cycle_length,
          periodHistory: refreshedProfile.period_history || []
        };

        // Recalcular día del ciclo para el log actual
        const logDate = todayLog.date || new Date().toISOString().split('T')[0];
        const lastPeriod = parseLocalDateOrToday(refreshedProfile.last_period_date || lastPeriodDate || undefined);
        const logDateObj = parseLocalDateOrToday(logDate);
        lastPeriod.setHours(0, 0, 0, 0);
        logDateObj.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((logDateObj.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && refreshedProfile.cycle_length) {
          let cycleDayForLogDate = diffDays + 1;

          if (cycleDayForLogDate > refreshedProfile.cycle_length) {
            const cyclesPassed = Math.floor((cycleDayForLogDate - 1) / refreshedProfile.cycle_length);
            cycleDayForLogDate = cycleDayForLogDate - (cyclesPassed * refreshedProfile.cycle_length);
          }

          setTodayLog(prev => ({
            ...prev,
            cycleDay: cycleDayForLogDate > 0 ? cycleDayForLogDate : 1
          }));
        }

        onUserUpdate?.(updatedUser);
      }

      showNotif?.('Fecha de última regla actualizada correctamente. El ciclo promedio se ha ajustado automáticamente.', 'success');
      setIsCycleModalOpen(false);
    } catch (error: any) {
      logger.error('Error guardando período:', error);
      showNotif?.('Error al guardar. Por favor, intenta nuevamente.', 'error');
    } finally {
      setIsSavingPeriod(false);
    }
  };

  // Toggle síntomas del período
  const togglePeriodSymptom = (symptom: string) => {
    if (symptom === 'Sin síntomas') {
      setSelectedPeriodSymptoms(['Sin síntomas']);
    } else {
      setSelectedPeriodSymptoms(prev => {
        const filtered = prev.filter(s => s !== 'Sin síntomas');
        if (filtered.includes(symptom)) {
          return filtered.filter(s => s !== symptom);
        }
        return [...filtered, symptom];
      });
    }
  };

  return (
    <div className="pb-24 space-y-6">
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-ferty-dark mb-1">Registro Diario</h2>
            <p className="text-[10px] text-ferty-gray">
              Hoy es: {formatCurrentDate()}
            </p>
          </div>
          <button
            onClick={() => setIsCycleModalOpen(true)}
            className="w-10 h-10 rounded-full bg-ferty-rose text-white flex items-center justify-center shadow-lg shadow-rose-200 hover:scale-105 transition-transform flex-shrink-0"
            title="Editar ciclo menstrual"
          >
            <Droplets size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-ferty-beige space-y-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-bold text-ferty-coral uppercase tracking-widest border-b border-ferty-beige pb-2">Fisiología</h3>
            {(() => {
              // Calcular fecha de inicio del ciclo actual (igual que Dashboard)
              const fechaInicioCicloActual = user?.lastPeriodDate && user?.cycleLength
                ? calcularFechaInicioCicloActual(user.lastPeriodDate, user.cycleLength)
                : null;

              const fechaAMostrar = fechaInicioCicloActual || user?.lastPeriodDate || lastPeriodDate;

              return fechaAMostrar ? (
                <p className="text-[10px] text-ferty-gray mt-2">
                  Última Regla: {formatDate(fechaAMostrar)}
                </p>
              ) : null;
            })()}
          </div>

          <div className="flex items-center justify-between bg-ferty-beige/50 p-4 rounded-2xl">
            <div>
              <span className="text-sm font-bold text-ferty-dark block">Día del Ciclo</span>
              {ventanaFertil && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-ferty-rose font-bold bg-ferty-rose/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Heart size={10} className="text-red-500 fill-red-500" />
                    <span className="text-[9px]">(Días {ventanaFertil.inicio}-{ventanaFertil.fin})</span>
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold text-ferty-dark w-12 text-center">{todayLog.cycleDay || 1}</span>
              {faseActual && (
                <span className="text-[9px] text-ferty-gray opacity-60 font-medium">{faseActual}</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between bg-ferty-beige/50 p-4 rounded-2xl">
            <span className="text-sm font-bold text-ferty-dark">Temperatura Basal</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  setTodayLog((prev) => ({
                    ...prev,
                    bbt: parseFloat(Math.max(35.0, ((prev.bbt || 36.5) - 0.1)).toFixed(2))
                  }))
                }
                className="p-2 bg-white rounded-full shadow-sm text-ferty-coral hover:scale-110 transition-transform"
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
                  className="w-20 text-center bg-transparent text-2xl font-bold text-ferty-rose outline-none border-b border-transparent focus:border-ferty-rose transition-colors p-0"
                />
                <span className="absolute -right-4 top-1 text-xs font-bold text-ferty-coral">°C</span>
              </div>
              <button
                onClick={() =>
                  setTodayLog((prev) => ({
                    ...prev,
                    bbt: parseFloat(Math.min(40.0, ((prev.bbt || 36.5) + 0.1)).toFixed(2))
                  }))
                }
                className="p-2 bg-white rounded-full shadow-sm text-ferty-coral hover:scale-110 transition-transform"
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
                  className={`text-xs px-4 py-2 rounded-full border transition-all font-medium ${todayLog.mucus === option ? 'bg-ferty-rose text-white border-ferty-rose' : 'bg-white border-ferty-beige text-ferty-gray hover:border-ferty-rose'}`}
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
                  className={`text-xs px-4 py-2 rounded-full border transition-all font-medium ${todayLog.lhTest === option ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-ferty-beige text-ferty-gray hover:border-indigo-200'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </InputField>

          <div className="bg-ferty-beige/50 p-4 rounded-2xl">
            <span className="text-xs font-bold text-ferty-dark block mb-3 uppercase">Cérvix (Opcional)</span>
            <div className="grid grid-cols-3 gap-2">
              <select
                className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-ferty-gray"
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
                className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-ferty-gray"
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
                className="text-xs p-2 rounded-lg border-none bg-white shadow-sm outline-none text-ferty-gray"
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

          <div className="flex items-center justify-between bg-ferty-beige/50 p-4 rounded-2xl">
            <span className="font-bold text-ferty-dark text-sm">Relaciones Sexuales</span>
            <button
              onClick={() => setTodayLog({ ...todayLog, sex: !todayLog.sex })}
              className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${todayLog.sex ? 'bg-ferty-rose' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${todayLog.sex ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="space-y-6 border-t border-ferty-beige pt-6">
          <h3 className="text-xs font-bold text-ferty-coral uppercase tracking-widest">Hábitos & Bienestar</h3>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-bold text-ferty-dark">Horas de Sueño</span>
              <span className="text-sm font-bold text-ferty-dark">{todayLog.sleepHours || 0}h</span>
            </div>
            <input
              type="range"
              min="0"
              max="12"
              step="0.5"
              value={todayLog.sleepHours || 7}
              onChange={(e) => setTodayLog({ ...todayLog, sleepHours: parseFloat(e.target.value) })}
              className="w-full accent-ferty-gray h-2 bg-ferty-beige rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>0h</span>
              <span>6h</span>
              <span>12h</span>
            </div>
          </div>

          <div>
            <span className="text-sm font-bold text-ferty-dark block mb-2">Nivel de Estrés</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setTodayLog({ ...todayLog, stressLevel: value })}
                  className={`flex-1 h-10 rounded-xl font-bold transition-all ${todayLog.stressLevel === value ? 'bg-ferty-rose text-white shadow-lg scale-105' : 'bg-ferty-beige text-ferty-gray hover:bg-stone-200'
                    }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-sm font-bold text-ferty-dark block mb-2">Actividad (min)</span>
              <input
                type="range"
                min="0"
                max="120"
                step="15"
                value={todayLog.activityMinutes || 0}
                onChange={(e) => setTodayLog({ ...todayLog, activityMinutes: parseInt(e.target.value) })}
                className="w-full accent-ferty-rose h-2 bg-ferty-beige rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-center text-xs font-bold text-ferty-rose mt-1">{todayLog.activityMinutes || 0} min</p>
            </div>
            <div>
              <span className="text-sm font-bold text-ferty-dark block mb-2">Luz Solar (min)</span>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={todayLog.sunMinutes || 0}
                onChange={(e) => setTodayLog({ ...todayLog, sunMinutes: parseInt(e.target.value) })}
                className="w-full accent-amber-400 h-2 bg-ferty-beige rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-center text-xs font-bold text-amber-500 mt-1">{todayLog.sunMinutes || 0} min</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="bg-ferty-beige/50 p-4 rounded-2xl">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold text-ferty-dark">Agua (Vasos)</span>
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

            <div className="bg-ferty-beige/50 p-4 rounded-2xl">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold text-ferty-dark">Vegetales (Raciones)</span>
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

          <div className="flex items-center justify-between bg-ferty-beige/50 p-4 rounded-2xl">
            <span className="font-bold text-ferty-dark text-sm">Consumo de Alcohol</span>
            <button
              onClick={() => setTodayLog({ ...todayLog, alcohol: !todayLog.alcohol })}
              className={`w-12 h-6 rounded-full relative transition-colors	duration-300 ${todayLog.alcohol ? 'bg-ferty-rose' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${todayLog.alcohol ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <button onClick={saveDailyLog} className="w-full bg-ferty-gray text-white py-4 rounded-xl font-bold shadow-lg hover:bg-ferty-grayHover transition-colors mt-4">
          Guardar Registro Diario
        </button>
      </div>

      <div>
        <h3 className="font-bold text-ferty-dark mb-4 flex items-center gap-2 text-sm uppercase tracking-wider opacity-80">Historial Reciente</h3>
        <div className="space-y-2">
          {logs.slice(0, 7).map((log) => (
            <LogHistoryItem key={log.date} log={log} />
          ))}
        </div>
      </div>

      {/* Modal para actualizar última regla */}
      {isCycleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsCycleModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md mx-4 p-6 space-y-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ferty-dark">Actualizar Última Regla</h3>
              <button
                onClick={() => setIsCycleModalOpen(false)}
                className="text-ferty-gray hover:bg-ferty-beige p-1.5 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-ferty-coral uppercase tracking-wider block mb-2">
                  Fecha de tu última regla *
                </label>
                <input
                  type="date"
                  value={lastPeriodDate}
                  onChange={(e) => setLastPeriodDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]} // No permitir fechas futuras
                  className="w-full px-4 py-3 bg-ferty-beigeLight border border-ferty-beige rounded-xl text-ferty-dark focus:outline-none focus:ring-2 focus:ring-ferty-rose"
                  required
                />
                <p className="text-[10px] text-ferty-gray mt-1">
                  El ciclo promedio se calculará automáticamente basado en tu historial
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-ferty-coral uppercase tracking-wider block mb-3">
                  ¿Qué síntomas tuviste?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PERIOD_SYMPTOM_OPTIONS.map((symptom) => {
                    const isSelected = selectedPeriodSymptoms.includes(symptom);
                    return (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => togglePeriodSymptom(symptom)}
                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${isSelected
                            ? 'bg-ferty-rose text-white shadow-md'
                            : 'bg-ferty-beige text-ferty-gray hover:bg-ferty-beigeDisabled'
                          }`}
                      >
                        {symptom}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsCycleModalOpen(false)}
                className="flex-1 px-4 py-3 bg-ferty-beige text-ferty-gray rounded-xl font-bold hover:bg-ferty-beigeDisabled transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCycleData}
                disabled={!lastPeriodDate || isSavingPeriod}
                className={`flex-1 px-4 py-3 rounded-xl font-bold transition-colors ${!lastPeriodDate || isSavingPeriod
                    ? 'bg-ferty-beigeDisabled text-ferty-grayDisabled cursor-not-allowed'
                    : 'bg-ferty-rose text-white hover:bg-ferty-roseHoverAlt shadow-md'
                  }`}
              >
                {isSavingPeriod ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackerView;

