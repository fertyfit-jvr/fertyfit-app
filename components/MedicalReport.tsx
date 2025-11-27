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

    return (
        <div className="mb-6">
            <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Resumen del Ciclo</h3>

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

            <div className="bg-white border border-[#F4F0ED] rounded-2xl shadow-sm overflow-hidden transition-all">
                <div onClick={() => setIsExpanded(!isExpanded)} className="p-4 cursor-pointer hover:bg-[#F4F0ED]/30 transition-colors">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-rose-50 rounded-full border border-rose-100 flex-shrink-0">
                                <span className="text-xs text-[#C7958E] font-bold">DÍA</span>
                                <span className="text-lg font-extrabold text-[#95706B] leading-none">{data.diaDelCiclo}</span>
                            </div>

                            <div className="flex-1">
                                <p className="font-bold text-[#4A4A4A] text-sm mb-1">
                                    Ciclo de {data.cycleLengthUsado} días
                                </p>
                                <div className="flex items-center gap-2 text-xs flex-wrap">
                                    {data.diasHastaOvulacion >= -5 && data.diasHastaOvulacion <= 1 ? (
                                        <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                                            <Heart size={10} className="fill-current" /> Ventana fértil
                                        </span>
                                    ) : data.diasHastaOvulacion > 1 ? (
                                        <span className="bg-[#F4F0ED] text-[#5D7180] px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <Calendar size={10} /> En {data.diasHastaOvulacion} días
                                        </span>
                                    ) : null}

                                    {data.probabilidadEmbarazoHoy > 0 && (
                                        <span className={`px-2 py-0.5 rounded-md font-bold ${data.probabilidadEmbarazoHoy >= 25
                                                ? 'bg-emerald-50 text-emerald-600'
                                                : 'bg-[#F4F0ED] text-[#5D7180]'
                                            }`}>
                                            {data.probabilidadEmbarazoHoy}% prob
                                        </span>
                                    )}

                                    <span className="bg-[#F4F0ED] text-[#5D7180] px-2 py-0.5 rounded-md">
                                        Regla en {data.diasHastaProximaRegla}d
                                    </span>
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

                        <div className="mb-3">
                            <span className="block text-stone-400 uppercase text-[9px] font-bold mb-2">Salud General</span>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Edad</span>
                                    <span className="font-bold text-stone-600">{data.edad} años</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">IMC</span>
                                    <span className="font-bold text-stone-600">{data.imc.valor} ({data.imc.categoria})</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Peso actual</span>
                                    <span className="font-bold text-stone-600">{data.pesoActual} kg</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Peso ideal</span>
                                    <span className="font-bold text-stone-600">{data.pesoIdeal.minimo}-{data.pesoIdeal.maximo} kg</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <span className="block text-stone-400 uppercase text-[9px] font-bold mb-2">Hábitos (últimos 7 días)</span>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Sueño</span>
                                    <span className="font-bold text-stone-600">{data.promedios.sueno}h</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Estrés</span>
                                    <span className="font-bold text-stone-600">{data.promedios.estres}/5</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Agua</span>
                                    <span className="font-bold text-stone-600">{data.promedios.agua} vasos</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <span className="block text-stone-400 text-[9px] mb-1">Vegetales</span>
                                    <span className="font-bold text-stone-600">{data.promedios.vegetales} porcs</span>
                                </div>
                                <div className="p-2 bg-white rounded-lg border border-stone-100 col-span-2">
                                    <span className="block text-stone-400 text-[9px] mb-1">Días con alcohol</span>
                                    <span className="font-bold text-stone-600">{data.promedios.diasConAlcohol}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 p-3 bg-white rounded-lg border border-stone-100">
                            <span className="block text-stone-400 uppercase text-[9px] font-bold mb-1">Análisis de Edad</span>
                            <p className="font-bold text-stone-600">{data.analisisEdad.categoria} - {data.analisisEdad.probabilidad}</p>
                            <p className="text-[10px] text-stone-500 mt-1">{data.analisisEdad.mensaje}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
