import React, { useState } from 'react';
import { Calendar, Heart, Activity } from 'lucide-react';
import { MedicalReportData } from '../services/MedicalReportHelpers';
import { UserProfile } from '../types';

interface MedicalReportProps {
    data: MedicalReportData | null;
    user: UserProfile;
    onCompleteProfile: () => void;
}

export const MedicalReport: React.FC<MedicalReportProps> = ({ data, user, onCompleteProfile }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Si no hay datos calculados (ni siquiera inferidos), mostrar estado vacío
    // Pero ahora con la inferencia, es difícil que llegue null si hay cycleDayOverride
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

    // Calcular fechas de calendario para ventana fértil
    const calcularFechasVentana = () => {
        if (!user.lastPeriodDate || !user.cycleLength) return null;

        const lastPeriod = new Date(user.lastPeriodDate);
        const cycleLength = Number(user.cycleLength);

        // Calcular cuántos ciclos han pasado
        const hoy = new Date();
        const diasDesdeInicio = Math.floor((hoy.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24));
        const ciclosCompletados = Math.floor(diasDesdeInicio / cycleLength);

        // Inicio del ciclo actual
        const inicioCicloActual = new Date(lastPeriod);
        inicioCicloActual.setDate(lastPeriod.getDate() + (ciclosCompletados * cycleLength));

        // Fechas de ventana fértil
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

    return (
        <div className="mb-6">
            {/* TÍTULO FUERA DE LA CAJA */}
            <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Resumen del Ciclo</h3>

            {/* AVISO SI USA VALOR POR DEFECTO */}
            {data.usandoValorPorDefecto && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2">
                    <span className="text-amber-600 text-lg">⚠️</span>
                    <div>
                        <p className="text-xs font-bold text-amber-800 mb-1">Usando duración estimada</p>
                        <p className="text-xs text-amber-700">
                            No has especificado tu duración de ciclo. Estamos usando 28 días por defecto.
                            <button
                                onClick={onCompleteProfile}
                                className="underline font-bold ml-1"
                            >
                                Actualiza tu perfil
                            </button> para cálculos más precisos.
                        </p>
                    </div>
                </div>
            )}

            {/* CAJA COLAPSABLE */}
            <div className="bg-white border border-[#F4F0ED] rounded-2xl shadow-sm overflow-hidden transition-all">
                <div onClick={() => setIsExpanded(!isExpanded)} className="p-4 cursor-pointer hover:bg-[#F4F0ED]/30 transition-colors">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Ventana Fértil</p>
                            <p className="text-lg font-bold text-[#4A4A4A]">
                                Días {data.ventanaFertil.inicio}-{data.ventanaFertil.fin}
                            </p>
                            {fechasVentana && (
                                <p className="text-[10px] text-[#5D7180] mt-1">
                                    {fechasVentana.inicio} - {fechasVentana.fin}
                                </p>
                            )}
                        </div>

                        {/* Drag Indicator - 5 dots */}
                        <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="w-1 h-1 rounded-full bg-[#C7958E]"></div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* CONTENIDO EXPANDIBLE */}
                {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-[#F4F0ED]/30 text-xs space-y-2 border-t border-[#F4F0ED]">
                        {/* Datos básicos */}
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Edad</span>
                            <span className="font-bold text-[#4A4A4A]">{data.edad} años</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">IMC</span>
                            <span className="font-bold text-[#4A4A4A]">{data.imc.valor} ({data.imc.categoria})</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Peso actual</span>
                            <span className="font-bold text-[#4A4A4A]">{data.pesoActual} kg</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Peso ideal</span>
                            <span className="font-bold text-[#4A4A4A]">{data.pesoIdeal.minimo}-{data.pesoIdeal.maximo} kg</span>
                        </div>
                        {/* Datos de ciclo */}
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Día actual del ciclo</span>
                            <span className="font-bold text-[#4A4A4A]">{data.diaDelCiclo}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Duración de ciclo{data.usandoValorPorDefecto ? ' (estimada)' : ''}</span>
                            <span className={`font-bold ${data.usandoValorPorDefecto ? 'text-amber-600' : 'text-[#4A4A4A]'}`}>
                                {data.cycleLengthUsado} días
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Días hasta ovulación</span>
                            <span className="font-bold text-[#4A4A4A]">{data.diasHastaOvulacion}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Día de ovulación estimado</span>
                            <span className="font-bold text-[#4A4A4A]">Día {data.diaOvulacion}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Ventana fértil</span>
                            <span className="font-bold text-[#C7958E]">Días {data.ventanaFertil.inicio}-{data.ventanaFertil.fin}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Próxima menstruación</span>
                            <span className="font-bold text-[#4A4A4A]">{data.fechaProximaMenstruacion}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Días hasta próxima regla</span>
                            <span className="font-bold text-[#4A4A4A]">{data.diasHastaProximaRegla}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Probabilidad de embarazo hoy</span>
                            <span className="font-bold text-[#4A4A4A]">{data.probabilidadEmbarazoHoy}%</span>
                        </div>
                        {/* Promedios hábitos */}
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Sueño (hrs)</span>
                            <span className="font-bold text-[#4A4A4A]">{data.promedios.sueno}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Estrés</span>
                            <span className="font-bold text-[#4A4A4A]">{data.promedios.estres}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Agua (vasos)</span>
                            <span className="font-bold text-[#4A4A4A]">{data.promedios.agua}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Vegetales (porciones)</span>
                            <span className="font-bold text-[#4A4A4A]">{data.promedios.vegetales}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Días con alcohol</span>
                            <span className="font-bold text-[#4A4A4A]">{data.promedios.diasConAlcohol}</span>
                        </div>
                        {/* Análisis edad */}
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[#5D7180]">Análisis edad</span>
                            <span className="font-bold text-[#4A4A4A]">{data.analisisEdad.categoria} - {data.analisisEdad.probabilidad}</span>
                        </div>
                        <p className="text-xs text-[#5D7180] mt-1">{data.analisisEdad.mensaje}</p>
                    </div>
                )}

            </div>
        </div>
    );
};
