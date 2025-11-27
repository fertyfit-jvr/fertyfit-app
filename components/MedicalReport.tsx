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
    if (!data || !user.lastPeriodDate || !user.cycleLength) {
        return (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center mb-6">
                <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar size={32} className="text-amber-600" />
                </div>
                <h3 className="font-bold text-amber-800 text-sm mb-2">Datos de Ciclo Incompletos</h3>
                <p className="text-xs text-amber-700 mb-4">
                    Completa tu formulario F0 con tu última regla y duración de ciclo para ver predicciones.
                </p>
                <button
                    onClick={onCompleteProfile}
                    className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition-colors"
                >
                    Completar F0
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 mb-6">
            {/* CARD PRINCIPAL - DÍA DEL CICLO */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-6 rounded-2xl border border-rose-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Día del Ciclo</p>
                        <p className="text-4xl font-bold text-rose-700 mt-1">{data.diaDelCiclo}</p>
                    </div>
                    <div className="bg-white p-4 rounded-full shadow-sm">
                        <Calendar size={32} className="text-rose-500" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-rose-600">
                    <Clock size={12} />
                    <span>Próxima regla en {data.diasHastaProximaRegla} días ({data.fechaProximaMenstruacion})</span>
                </div>
            </div>

            {/* GRID - VENTANA FÉRTIL Y PROBABILIDAD */}
            <div className="grid grid-cols-2 gap-4">
                {/* VENTANA FÉRTIL */}
                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                            <Heart size={20} className="text-emerald-500" />
                        </div>
                        <p className="text-xs font-bold text-emerald-700 uppercase">Ventana Fértil</p>
                    </div>
                    {data.diasHastaOvulacion > 0 ? (
                        <div>
                            <p className="text-xs text-stone-500 mb-1">Inicio estimado:</p>
                            <p className="text-sm font-bold text-emerald-700">
                                Día {data.ventanaFertil.inicio}
                            </p>
                            <p className="text-xs text-stone-400 mt-1">En {data.diasHastaOvulacion - 5} días</p>
                        </div>
                    ) : data.diasHastaOvulacion <= 0 && data.diasHastaOvulacion >= -1 ? (
                        <div>
                            <p className="text-lg font-bold text-emerald-600">¡Estás en tu ventana fértil!</p>
                            <p className="text-xs text-emerald-700 mt-1">Días {data.ventanaFertil.inicio}-{data.ventanaFertil.fin}</p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-xs text-stone-500">Ya pasó</p>
                            <p className="text-xs text-stone-400 mt-1">Próxima en ~{user.cycleLength} días</p>
                        </div>
                    )}
                </div>

                {/* PROBABILIDAD HOY */}
                <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Sparkles size={20} className="text-purple-500" />
                        </div>
                        <p className="text-xs font-bold text-purple-700 uppercase">Probabilidad Hoy</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-purple-700">{data.probabilidadEmbarazoHoy}%</p>
                        <p className="text-xs text-stone-400 mt-1">
                            {data.probabilidadEmbarazoHoy >= 25 ? 'Alta' : data.probabilidadEmbarazoHoy >= 10 ? 'Media' : 'Baja'}
                        </p>
                    </div>
                </div>
            </div>

            {/* TABLA COMPLETA DE FERTILIDAD */}
            <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity size={14} />
                    Tu Ciclo Completo
                </h4>
                <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                        <span className="text-xs text-stone-500">Día actual del ciclo</span>
                        <span className="text-sm font-bold text-stone-700">{data.diaDelCiclo}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                        <span className="text-xs text-stone-500">Día de ovulación estimado</span>
                        <span className="text-sm font-bold text-stone-700">Día {data.diaOvulacion}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                        <span className="text-xs text-stone-500">Ventana fértil</span>
                        <span className="text-sm font-bold text-emerald-600">Días {data.ventanaFertil.inicio}-{data.ventanaFertil.fin}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                        <span className="text-xs text-stone-500">Próxima menstruación</span>
                        <span className="text-sm font-bold text-rose-600">{data.fechaProximaMenstruacion}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                        <span className="text-xs text-stone-500">Días hasta ovulación</span>
                        <span className="text-sm font-bold text-stone-700">
                            {data.diasHastaOvulacion > 0 ? data.diasHastaOvulacion : 'Ya pasó'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-stone-500">Días hasta próxima regla</span>
                        <span className="text-sm font-bold text-stone-700">{data.diasHastaProximaRegla}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
