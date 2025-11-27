import React from 'react';
import { Calendar, Clock, Sparkles, Heart, Activity, Moon, Zap, Droplet } from 'lucide-react';
import { MedicalReportData } from '../services/MedicalReportHelpers';
import { UserProfile } from '../types';

interface MedicalReportProps {
    data: MedicalReportData | null;
    user: UserProfile;
    onCompleteProfile: () => void;
}

export const MedicalReport: React.FC<MedicalReportProps> = ({ data, user, onCompleteProfile }) => {
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

    return (
        <div className="space-y-4 mb-6">
            {/* CARD PRINCIPAL - DÍA DEL CICLO */}
            <div className="bg-white p-6 rounded-2xl border border-[#F4F0ED] shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#F9F6F4] rounded-bl-full -mr-8 -mt-8 opacity-50"></div>

                <div className="flex items-center justify-between mb-4 relative z-10">
                    <div>
                        <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider">Día del Ciclo</p>
                        <p className="text-4xl font-bold text-[#4A4A4A] mt-1">{data.diaDelCiclo}</p>
                    </div>
                    <div className="bg-[#F9F6F4] p-4 rounded-full shadow-sm">
                        <Calendar size={32} className="text-[#C7958E]" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#5D7180] relative z-10">
                    <Clock size={12} className="text-[#C7958E]" />
                    <span>Próxima regla en <span className="font-bold text-[#4A4A4A]">{data.diasHastaProximaRegla} días</span> ({data.fechaProximaMenstruacion})</span>
                </div>
            </div>

            {/* GRID - VENTANA FÉRTIL Y PROBABILIDAD */}
            <div className="grid grid-cols-2 gap-4">
                {/* VENTANA FÉRTIL */}
                <div className="bg-white p-5 rounded-2xl border border-[#F4F0ED] shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-[#F9F6F4] rounded-lg">
                            <Heart size={20} className="text-[#C7958E]" />
                        </div>
                        <p className="text-xs font-bold text-[#95706B] uppercase">Ventana Fértil</p>
                    </div>
                    {data.diasHastaOvulacion > 0 ? (
                        <div>
                            <p className="text-xs text-[#5D7180] mb-1">Inicio estimado:</p>
                            <p className="text-sm font-bold text-[#4A4A4A]">
                                Día {data.ventanaFertil.inicio}
                            </p>
                            <p className="text-xs text-[#95706B] mt-1">En {Math.max(0, data.diasHastaOvulacion - 5)} días</p>
                        </div>
                    ) : data.diasHastaOvulacion <= 0 && data.diasHastaOvulacion >= -5 ? (
                        <div>
                            <p className="text-lg font-bold text-[#C7958E]">¡Días Fértiles!</p>
                            <p className="text-xs text-[#5D7180] mt-1">Días {data.ventanaFertil.inicio}-{data.ventanaFertil.fin}</p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-xs text-[#5D7180]">Ya pasó</p>
                            <p className="text-xs text-[#95706B] mt-1">Próxima en ~{user.cycleLength} días</p>
                        </div>
                    )}
                </div>

                {/* PROBABILIDAD HOY */}
                <div className="bg-white p-5 rounded-2xl border border-[#F4F0ED] shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-[#F9F6F4] rounded-lg">
                            <Sparkles size={20} className="text-[#C7958E]" />
                        </div>
                        <p className="text-xs font-bold text-[#95706B] uppercase">Probabilidad</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[#4A4A4A]">{data.probabilidadEmbarazoHoy}%</p>
                        <p className="text-xs text-[#5D7180] mt-1">
                            {data.probabilidadEmbarazoHoy >= 25 ? 'Alta' : data.probabilidadEmbarazoHoy >= 10 ? 'Media' : 'Baja'}
                        </p>
                    </div>
                </div>
            </div>

            {/* TABLA COMPLETA DE FERTILIDAD */}
            <div className="bg-white p-6 rounded-2xl border border-[#F4F0ED] shadow-sm">
                <h4 className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity size={14} />
                    Tu Ciclo Completo
                </h4>
                <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-[#F9F6F4]">
                        <span className="text-xs text-[#5D7180]">Día actual del ciclo</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">{data.diaDelCiclo}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-[#F9F6F4]">
                        <span className="text-xs text-[#5D7180]">Día de ovulación estimado</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">Día {data.diaOvulacion}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-[#F9F6F4]">
                        <span className="text-xs text-[#5D7180]">Ventana fértil</span>
                        <span className="text-sm font-bold text-[#C7958E]">Días {data.ventanaFertil.inicio}-{data.ventanaFertil.fin}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-[#F9F6F4]">
                        <span className="text-xs text-[#5D7180]">Próxima menstruación</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">{data.fechaProximaMenstruacion}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-[#F9F6F4]">
                        <span className="text-xs text-[#5D7180]">Días hasta ovulación</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">
                            {data.diasHastaOvulacion > 0 ? data.diasHastaOvulacion : 'Ya pasó'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-[#5D7180]">Días hasta próxima regla</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">{data.diasHastaProximaRegla}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
