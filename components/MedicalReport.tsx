import React from 'react';
import { Activity, Calendar, TrendingUp, Heart, Droplet, Moon, Zap } from 'lucide-react';
import { MedicalReportData } from '../services/MedicalReportHelpers';

interface MedicalReportProps {
    data: MedicalReportData;
}

export const MedicalReport: React.FC<MedicalReportProps> = ({ data }) => {
    // Helper para determinar color según valor
    const getColorClass = (value: number, thresholds: { good: number; warning: number }) => {
        if (value >= thresholds.good) return 'text-emerald-600';
        if (value >= thresholds.warning) return 'text-amber-600';
        return 'text-rose-600';
    };

    return (
        <div className="bg-white rounded-2xl border border-[#F4F0ED] shadow-sm p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-[#4A4A4A] uppercase tracking-wider flex items-center gap-2">
                    <Activity size={16} className="text-[#C7958E]" />
                    Informe Médico
                </h3>
                <span className="text-xs text-[#95706B] font-medium">
                    Actualizado hoy
                </span>
            </div>

            {/* Grid de métricas */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                {/* Edad */}
                <div className="bg-[#F9F6F4] p-3 rounded-xl">
                    <p className="text-[10px] text-[#95706B] font-bold uppercase tracking-wider mb-1">Edad</p>
                    <p className="text-lg font-bold text-[#4A4A4A]">{data.edad} años</p>
                    <p className="text-[10px] text-[#5D7180] mt-1">{data.analisisEdad.categoria}</p>
                </div>

                {/* IMC */}
                <div className="bg-[#F9F6F4] p-3 rounded-xl">
                    <p className="text-[10px] text-[#95706B] font-bold uppercase tracking-wider mb-1">IMC</p>
                    <p className="text-lg font-bold text-[#4A4A4A]">{data.imc.valor}</p>
                    <p className="text-[10px] text-[#5D7180] mt-1">{data.imc.categoria}</p>
                </div>

                {/* Peso Ideal */}
                <div className="bg-[#F9F6F4] p-3 rounded-xl">
                    <p className="text-[10px] text-[#95706B] font-bold uppercase tracking-wider mb-1">Peso Ideal</p>
                    <p className="text-lg font-bold text-[#4A4A4A]">
                        {data.pesoIdeal.minimo}-{data.pesoIdeal.maximo} kg
                    </p>
                    <p className="text-[10px] text-[#5D7180] mt-1">Rango saludable</p>
                </div>

                {/* Día del Ciclo */}
                <div className="bg-[#F9F6F4] p-3 rounded-xl">
                    <p className="text-[10px] text-[#95706B] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Calendar size={10} />
                        Día del Ciclo
                    </p>
                    <p className="text-lg font-bold text-[#4A4A4A]">Día {data.diaDelCiclo}</p>
                    <p className="text-[10px] text-[#5D7180] mt-1">Ciclo actual</p>
                </div>

                {/* Día de Ovulación */}
                <div className="bg-[#F9F6F4] p-3 rounded-xl">
                    <p className="text-[10px] text-[#95706B] font-bold uppercase tracking-wider mb-1">Ovulación</p>
                    <p className="text-lg font-bold text-[#4A4A4A]">Día {data.diaOvulacion}</p>
                    <p className="text-[10px] text-[#5D7180] mt-1">Estimado</p>
                </div>

                {/* Ventana Fértil */}
                <div className="bg-[#F9F6F4] p-3 rounded-xl">
                    <p className="text-[10px] text-[#95706B] font-bold uppercase tracking-wider mb-1">Ventana Fértil</p>
                    <p className="text-lg font-bold text-[#4A4A4A]">
                        Días {data.ventanaFertil.inicio}-{data.ventanaFertil.fin}
                    </p>
                    <p className="text-[10px] text-[#5D7180] mt-1">{data.ventanaFertil.diasFertiles} días</p>
                </div>

                {/* Próxima Menstruación */}
                <div className="bg-[#F9F6F4] p-3 rounded-xl col-span-2">
                    <p className="text-[10px] text-[#95706B] font-bold uppercase tracking-wider mb-1">Próxima Regla</p>
                    <p className="text-lg font-bold text-[#4A4A4A]">{data.fechaProximaMenstruacion}</p>
                    <p className="text-[10px] text-[#5D7180] mt-1">
                        En {data.diasHastaProximaRegla} día{data.diasHastaProximaRegla !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* Días hasta Ovulación */}
                <div className="bg-[#F9F6F4] p-3 rounded-xl">
                    <p className="text-[10px] text-[#95706B] font-bold uppercase tracking-wider mb-1">Hasta Ovulación</p>
                    <p className="text-lg font-bold text-[#4A4A4A]">
                        {data.diasHastaOvulacion > 0 ? data.diasHastaOvulacion : 'Pasó'}
                    </p>
                    <p className="text-[10px] text-[#5D7180] mt-1">
                        {data.diasHastaOvulacion > 0 ? 'días' : 'este ciclo'}
                    </p>
                </div>

                {/* Probabilidad de Embarazo Hoy */}
                <div className="bg-[#F9F6F4] p-3 rounded-xl col-span-2">
                    <p className="text-[10px] text-[#95706B] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TrendingUp size={10} />
                        Probabilidad Hoy
                    </p>
                    <p className="text-lg font-bold text-[#4A4A4A]">{data.probabilidadEmbarazoHoy}%</p>
                    <p className="text-[10px] text-[#5D7180] mt-1">
                        {data.probabilidadEmbarazoHoy >= 25 ? 'Alta fertilidad' :
                            data.probabilidadEmbarazoHoy >= 10 ? 'Fertilidad moderada' :
                                'Baja fertilidad'}
                    </p>
                </div>
            </div>

            {/* Promedios de Hábitos (últimos 7 días) */}
            <div className="mt-6 pt-6 border-t border-[#F4F0ED]">
                <h4 className="text-xs font-bold text-[#4A4A4A] uppercase tracking-wider mb-4">
                    Promedios Últimos 7 Días
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {/* Sueño */}
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-indigo-50">
                            <Moon size={14} className="text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#4A4A4A]">{data.promedios.sueno}h</p>
                            <p className="text-[10px] text-[#5D7180]">Sueño</p>
                        </div>
                    </div>

                    {/* Estrés */}
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-rose-50">
                            <Zap size={14} className="text-rose-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#4A4A4A]">{data.promedios.estres}/5</p>
                            <p className="text-[10px] text-[#5D7180]">Estrés</p>
                        </div>
                    </div>

                    {/* Agua */}
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-50">
                            <Droplet size={14} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#4A4A4A]">{data.promedios.agua}</p>
                            <p className="text-[10px] text-[#5D7180]">Vasos</p>
                        </div>
                    </div>

                    {/* Vegetales */}
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-green-50">
                            <Heart size={14} className="text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#4A4A4A]">{data.promedios.vegetales}</p>
                            <p className="text-[10px] text-[#5D7180]">Vegetales</p>
                        </div>
                    </div>

                    {/* Alcohol */}
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-amber-50">
                            <Activity size={14} className="text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#4A4A4A]">{data.promedios.diasConAlcohol}</p>
                            <p className="text-[10px] text-[#5D7180]">Días alcohol</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-4 p-3 bg-[#F9F6F4] rounded-lg">
                <p className="text-[10px] text-[#5D7180] leading-relaxed">
                    ℹ️ <span className="font-bold">Importante:</span> Estos son cálculos estimados basados en promedios.
                    La ovulación real puede variar ±2 días. Para decisiones médicas, consulta con un especialista.
                </p>
            </div>
        </div>
    );
};
