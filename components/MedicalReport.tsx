import React from 'react';
import { Calendar, TrendingUp, Activity, Clock, AlertCircle } from 'lucide-react';
import { MedicalReportData } from '../services/MedicalReportHelpers';

interface MedicalReportProps {
    data: MedicalReportData;
}

export const MedicalReport: React.FC<MedicalReportProps> = ({ data }) => {
    // Estilo "Historia" - Tarjetas limpias con encabezados claros

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Activity size={18} className="text-[#C7958E]" />
                <h3 className="font-bold text-[#4A4A4A] text-lg">Tu Fertilidad Hoy</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* TARJETA PRINCIPAL: ESTADO DEL CICLO */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#F4F0ED] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#F9F6F4] rounded-bl-full -mr-4 -mt-4 opacity-50"></div>

                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                            <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Ciclo Actual</p>
                            <h4 className="text-3xl font-bold text-[#4A4A4A]">Día {data.diaDelCiclo > 0 ? data.diaDelCiclo : '-'}</h4>
                            <p className="text-xs text-[#5D7180] mt-1">
                                {data.diasHastaProximaRegla > 0
                                    ? `Faltan ${data.diasHastaProximaRegla} días para tu regla`
                                    : data.diasHastaProximaRegla < 0
                                        ? `Retraso de ${Math.abs(data.diasHastaProximaRegla)} días`
                                        : 'Tu regla debería llegar hoy'}
                            </p>
                        </div>
                        <div className="bg-[#F9F6F4] p-2 rounded-xl">
                            <Calendar size={24} className="text-[#C7958E]" />
                        </div>
                    </div>

                    <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-center text-sm border-b border-[#F4F0ED] pb-2">
                            <span className="text-[#5D7180]">Próxima Regla</span>
                            <span className="font-bold text-[#4A4A4A]">{data.fechaProximaMenstruacion}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-[#5D7180]">Probabilidad Hoy</span>
                            <span className={`font-bold px-2 py-0.5 rounded-md text-xs ${data.probabilidadEmbarazoHoy >= 25 ? 'bg-emerald-100 text-emerald-700' :
                                    data.probabilidadEmbarazoHoy >= 10 ? 'bg-amber-100 text-amber-700' :
                                        'bg-stone-100 text-stone-600'
                                }`}>
                                {data.probabilidadEmbarazoHoy}%
                                {data.probabilidadEmbarazoHoy >= 25 ? ' (Alta)' : ''}
                            </span>
                        </div>
                    </div>
                </div>

                {/* TARJETA SECUNDARIA: VENTANA FÉRTIL */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#F4F0ED] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-4 -mt-4 opacity-50"></div>

                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                            <p className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">Ventana Fértil</p>
                            <h4 className="text-xl font-bold text-[#4A4A4A]">
                                {data.ventanaFertil.inicio > 0 ? `Días ${data.ventanaFertil.inicio} - ${data.ventanaFertil.fin}` : 'Pendiente'}
                            </h4>
                            <p className="text-xs text-[#5D7180] mt-1">
                                Ovulación estimada: <span className="font-bold">Día {data.diaOvulacion}</span>
                            </p>
                        </div>
                        <div className="bg-rose-50 p-2 rounded-xl">
                            <TrendingUp size={24} className="text-rose-400" />
                        </div>
                    </div>

                    <div className="mt-4 relative z-10">
                        {data.diasHastaOvulacion > 0 ? (
                            <div className="flex items-center gap-2 text-sm text-[#5D7180] bg-[#F9F6F4] p-2 rounded-lg">
                                <Clock size={16} className="text-[#C7958E]" />
                                <span>Faltan <span className="font-bold text-[#4A4A4A]">{data.diasHastaOvulacion} días</span> para ovular</span>
                            </div>
                        ) : data.diasHastaOvulacion === 0 ? (
                            <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 p-2 rounded-lg">
                                <AlertCircle size={16} />
                                <span className="font-bold">¡Hoy es tu día de ovulación!</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-[#5D7180] bg-[#F9F6F4] p-2 rounded-lg">
                                <Clock size={16} className="text-stone-400" />
                                <span>La ovulación ya pasó este ciclo</span>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* PROMEDIOS DE HÁBITOS (Barra inferior) */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-[#F4F0ED]">
                <h4 className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-3">Promedios (Últimos 7 días)</h4>
                <div className="flex justify-between items-center text-center divide-x divide-[#F4F0ED]">

                    <div className="px-2 flex-1">
                        <span className="block text-lg font-bold text-[#4A4A4A]">{data.promedios.sueno}h</span>
                        <span className="text-[10px] text-[#5D7180] uppercase">Sueño</span>
                    </div>

                    <div className="px-2 flex-1">
                        <span className="block text-lg font-bold text-[#4A4A4A]">{data.promedios.estres}</span>
                        <span className="text-[10px] text-[#5D7180] uppercase">Estrés</span>
                    </div>

                    <div className="px-2 flex-1">
                        <span className="block text-lg font-bold text-[#4A4A4A]">{data.promedios.agua}</span>
                        <span className="text-[10px] text-[#5D7180] uppercase">Agua</span>
                    </div>

                    <div className="px-2 flex-1">
                        <span className="block text-lg font-bold text-[#4A4A4A]">{data.promedios.vegetales}</span>
                        <span className="text-[10px] text-[#5D7180] uppercase">Vegetales</span>
                    </div>

                </div>
            </div>
        </div>
    );
};
