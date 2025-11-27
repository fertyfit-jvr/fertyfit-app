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

    return (
        <div className="space-y-4 mb-6">
            {/* RESUMEN DEL CICLO - COLLAPSIBLE */}
            <div className="bg-white rounded-2xl border border-[#F4F0ED] shadow-sm overflow-hidden">
                {/* HEADER */}
                <div
                    className="p-4 cursor-pointer hover:bg-[#F4F0ED]/30 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-[#4A4A4A]">Resumen del Ciclo</h4>
                        {/* Drag Indicator - 5 dots */}
                        <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="w-1 h-1 rounded-full bg-[#C7958E]"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENIDO EXPANDIBLE */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-[#F9F6F4]">
                    <div className="flex justify-between items-center py-3 border-b border-[#F9F6F4]">
                        <span className="text-xs text-[#5D7180]">Día actual del ciclo</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">{data.diaDelCiclo}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-[#F9F6F4]">
                        <span className="text-xs text-[#5D7180]">Día de ovulación estimado</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">Día {data.diaOvulacion}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-[#F9F6F4]">
                        <span className="text-xs text-[#5D7180]">Ventana fértil</span>
                        <span className="text-sm font-bold text-[#C7958E]">Días {data.ventanaFertil.inicio}-{data.ventanaFertil.fin}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-[#F9F6F4]">
                        <span className="text-xs text-[#5D7180]">Próxima menstruación</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">{data.fechaProximaMenstruacion}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-[#F9F6F4]">
                        <span className="text-xs text-[#5D7180]">Días hasta próxima regla</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">{data.diasHastaProximaRegla}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                        <span className="text-xs text-[#5D7180]">Probabilidad de embarazo hoy</span>
                        <span className="text-sm font-bold text-[#4A4A4A]">{data.probabilidadEmbarazoHoy}%</span>
                    </div>
                </div>
            )}
        </div>
        </div >
    );
};
