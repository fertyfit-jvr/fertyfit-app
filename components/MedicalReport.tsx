import React, { useState } from 'react';
import { Calendar, Heart, Activity } from 'lucide-react';
import { MedicalReportData } from '../services/MedicalReportHelpers';
import { UserProfile, DailyLog } from '../types';

interface MedicalReportProps {
    data: MedicalReportData | null;
    user: UserProfile;
    logs: DailyLog[];
    onCompleteProfile: () => void;
}

export const MedicalReport: React.FC<MedicalReportProps> = ({ data, user, logs, onCompleteProfile }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!data || (!data.diaDelCiclo && !user.cycleLength)) {
        return (
            <div className="bg-[#F9F6F4] border border-[#F4F0ED] p-6 rounded-2xl text-center mb-6">
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Activity size={32} className="text-[#C7958E]" />
                </div>
                <h3 className="font-bold text-[#4A4A4A] text-sm mb-2">Configura tu Ciclo</h3>
                <p className="text-xs text-[#5D7180] mb-4">
                    Necesitamos saber tu última regla y duración de ciclo para calcular tus predicciones.
                </p>
                <button
                    onClick={onCompleteProfile}
                    className="bg-[#C7958E] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#b0847d] transition-colors text-xs uppercase tracking-wider"
                >
                    Completar Datos
                </button>
            </div>
        );
    }

    // Calcular fechas de ventana fértil
    const calcularFechasVentana = () => {
        if (!user.lastPeriodDate || !user.cycleLength) return null;

        const lastPeriod = new Date(user.lastPeriodDate);
        const cycleLength = Number(user.cycleLength);

        const hoy = new Date();
        const diasDesdeInicio = Math.floor((hoy.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24));
        const ciclosCompletados = Math.floor(diasDesdeInicio / cycleLength);

        const inicioCicloActual = new Date(lastPeriod);
        inicioCicloActual.setDate(lastPeriod.getDate() + (ciclosCompletados * cycleLength));

        const fechaInicio = new Date(inicioCicloActual);
        fechaInicio.setDate(inicioCicloActual.getDate() + data.ventanaFertil.inicio - 1);

        const fechaFin = new Date(inicioCicloActual);
        fechaFin.setDate(inicioCicloActual.getDate() + data.ventanaFertil.fin - 1);

        return {
            inicio: fechaInicio.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            fin: fechaFin.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        };
    };

    const fechasVentana = calcularFechasVentana();

    // Obtener fecha del último registro
    const ultimoLog = logs.length > 0 ? logs[0] : null;
    const fechaUltimoRegistro = ultimoLog
        ? new Date(ultimoLog.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : null;

    // Determinar si está en días fértiles
    const enDiasFertiles = data.diasHastaOvulacion >= -5 && data.diasHastaOvulacion <= 1;

    return (
        <div className="mb-6">
            <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Resumen del Ciclo</h3>

            {data.usandoValorPorDefecto && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2">
                    <span className="text-amber-600 text-lg">⚠️</span>
                    <div>
                        <p className="text-xs font-bold text-amber-800 mb-1">Usando duración estimada</p>
                        <p className="text-xs text-amber-700">
                            No tenemos tu duración de ciclo registrada en el perfil. Estamos usando 28 días por defecto.
                            <button
                                onClick={onCompleteProfile}
                                className="underline font-bold ml-1"
                            >
                                Completa el formulario F0
                            </button> para cálculos más precisos.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white border border-[#F4F0ED] rounded-2xl shadow-sm overflow-hidden transition-all">
                <div onClick={() => setIsExpanded(!isExpanded)} className="p-4 cursor-pointer hover:bg-[#F4F0ED]/30 transition-colors">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                            {/* Círculo con probabilidad */}
                            <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-full border flex-shrink-0 ${enDiasFertiles
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-rose-50 border-rose-100'
                                }`}>
                                <span className={`text-xs font-bold ${enDiasFertiles ? 'text-emerald-600' : 'text-[#C7958E]'
                                    }`}>PROB</span>
                                <span className={`text-lg font-extrabold leading-none ${enDiasFertiles ? 'text-emerald-700' : 'text-[#95706B]'
                                    }`}>{data.probabilidadEmbarazoHoy}%</span>
                            </div>

                            <div className="flex-1">
                                {/* Line 1: Fertile Window with Heart Icon */}
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Heart size={14} className="text-rose-500 fill-rose-500" />
                                    <span className="font-bold text-[#4A4A4A] text-sm">
                                        {fechasVentana ? `${fechasVentana.inicio} - ${fechasVentana.fin}` : '--'}
                                    </span>
                                    <span className="text-xs text-[#95706B] font-normal">
                                        (Días {data.ventanaFertil.inicio}-{data.ventanaFertil.fin})
                                    </span>
                                </div>

                                {/* Line 2 & 3: Period Dates (No badges) */}
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] text-[#5D7180]">
                                        <span className="font-bold">Fecha Última Regla:</span> {data.fechaInicioCicloActual !== "Pendiente" ? data.fechaInicioCicloActual : (user.lastPeriodDate ? new Date(user.lastPeriodDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '--')}
                                    </p>
                                    <p className="text-[10px] text-[#5D7180]">
                                        <span className="font-bold">Fecha próxima regla (aprox):</span> {data.fechaProximaMenstruacion}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-1 flex-shrink-0">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="w-1 h-1 rounded-full bg-[#C7958E]"></div>
                            ))}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-[#F4F0ED]/30 text-xs border-t border-[#F4F0ED]">
                        <div className="mb-3">
                            <span className="block text-stone-400 uppercase text-[9px] font-bold mb-2">Fertilidad</span>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Ventana fértil</span>
                                    <span className="font-bold text-[#C7958E]">Días {data.ventanaFertil.inicio}-{data.ventanaFertil.fin}</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Días hasta ovulación</span>
                                    <span className="font-bold text-stone-600">{data.diasHastaOvulacion}</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Día ovulación</span>
                                    <span className="font-bold text-stone-600">Día {data.diaOvulacion}</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Probabilidad hoy</span>
                                    <span className="font-bold text-stone-600">{data.probabilidadEmbarazoHoy}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-3">
                            <span className="block text-stone-400 uppercase text-[9px] font-bold mb-2">Ciclo Menstrual</span>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Duración ciclo{data.usandoValorPorDefecto ? ' (estimada)' : ''}</span>
                                    <span className={`font-bold ${data.usandoValorPorDefecto ? 'text-amber-600' : 'text-stone-600'}`}>
                                        {data.cycleLengthUsado} días
                                    </span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Próxima regla</span>
                                    <span className="font-bold text-stone-600">{data.fechaProximaMenstruacion}</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100 col-span-2">
                                    <span className="block text-stone-400 text-[9px] mb-1">Días hasta próxima regla</span>
                                    <span className="font-bold text-stone-600">{data.diasHastaProximaRegla} días</span>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};
