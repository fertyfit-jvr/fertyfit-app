import React from 'react';
import { Activity, Calendar, TrendingUp, Heart, Droplet, Moon, Zap, Scale } from 'lucide-react';
import { MedicalReportData } from '../services/MedicalReportHelpers';

interface MedicalReportProps {
    data: MedicalReportData;
}

export const MedicalReport: React.FC<MedicalReportProps> = ({ data }) => {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
            {/* Grid de métricas principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

                {/* Edad */}
                <div className="bg-stone-50 p-3 rounded-xl">
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1">Edad</p>
                    <p className="text-lg font-bold text-stone-800">{data.edad} años</p>
                    <p className="text-[10px] text-stone-500 mt-1">{data.analisisEdad.categoria}</p>
                </div>

                {/* Peso (Actual vs Ideal) */}
                <div className="bg-stone-50 p-3 rounded-xl">
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Scale size={10} />
                        Peso
                    </p>
                    <p className="text-lg font-bold text-stone-800">{data.pesoActual} kg</p>
                    <p className="text-[10px] text-stone-500 mt-1">
                        Ideal: {data.pesoIdeal.minimo}-{data.pesoIdeal.maximo} kg
                    </p>
                </div>

                {/* IMC */}
                <div className="bg-stone-50 p-3 rounded-xl">
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1">IMC</p>
                    <p className="text-lg font-bold text-stone-800">{data.imc.valor}</p>
                    <p className="text-[10px] text-stone-500 mt-1">{data.imc.categoria}</p>
                </div>

                {/* Probabilidad Hoy */}
                <div className="bg-stone-50 p-3 rounded-xl">
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TrendingUp size={10} />
                        Probabilidad Hoy
                    </p>
                    <p className="text-lg font-bold text-stone-800">{data.probabilidadEmbarazoHoy}%</p>
                    <p className="text-[10px] text-stone-500 mt-1">
                        {data.probabilidadEmbarazoHoy >= 25 ? 'Alta' :
                            data.probabilidadEmbarazoHoy >= 10 ? 'Moderada' :
                                'Baja'}
                    </p>
                </div>
            </div>

            {/* Sección Ciclo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Día del Ciclo */}
                <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                    <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Calendar size={10} />
                        Día Ciclo
                    </p>
                    <p className="text-lg font-bold text-stone-800">
                        {data.diaDelCiclo > 0 ? `Día ${data.diaDelCiclo}` : '-'}
                    </p>
                </div>

                {/* Ovulación */}
                <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                    <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-1">Ovulación</p>
                    <p className="text-lg font-bold text-stone-800">
                        {data.diaOvulacion > 0 ? `Día ${data.diaOvulacion}` : '-'}
                    </p>
                    <p className="text-[10px] text-rose-400 mt-1">
                        {data.diasHastaOvulacion > 0 ? `En ${data.diasHastaOvulacion} días` : 'Pasó'}
                    </p>
                </div>

                {/* Ventana Fértil */}
                <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                    <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-1">Ventana Fértil</p>
                    <p className="text-lg font-bold text-stone-800">
                        {data.ventanaFertil.inicio > 0 ? `${data.ventanaFertil.inicio}-${data.ventanaFertil.fin}` : '-'}
                    </p>
                    <p className="text-[10px] text-rose-400 mt-1">Días del ciclo</p>
                </div>

                {/* Próxima Regla */}
                <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                    <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-1">Próxima Regla</p>
                    <p className="text-sm font-bold text-stone-800 truncate">
                        {data.fechaProximaMenstruacion}
                    </p>
                    <p className="text-[10px] text-rose-400 mt-1">
                        {data.diasHastaProximaRegla > 0 ? `En ${data.diasHastaProximaRegla} días` : 'Pendiente'}
                    </p>
                </div>
            </div>

            {/* Promedios de Hábitos */}
            <div>
                <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">
                    Promedios Últimos 7 Días
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {/* Sueño */}
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 transition-colors">
                        <div className="p-1.5 rounded-md bg-indigo-50">
                            <Moon size={12} className="text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-stone-700">{data.promedios.sueno}h</p>
                            <p className="text-[10px] text-stone-500">Horas Sueño</p>
                        </div>
                    </div>

                    {/* Estrés */}
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 transition-colors">
                        <div className="p-1.5 rounded-md bg-rose-50">
                            <Zap size={12} className="text-rose-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-stone-700">{data.promedios.estres}/5</p>
                            <p className="text-[10px] text-stone-500">Nivel Estrés</p>
                        </div>
                    </div>

                    {/* Agua */}
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 transition-colors">
                        <div className="p-1.5 rounded-md bg-blue-50">
                            <Droplet size={12} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-stone-700">{data.promedios.agua}</p>
                            <p className="text-[10px] text-stone-500">Vasos Agua</p>
                        </div>
                    </div>

                    {/* Vegetales */}
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 transition-colors">
                        <div className="p-1.5 rounded-md bg-green-50">
                            <Heart size={12} className="text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-stone-700">{data.promedios.vegetales}</p>
                            <p className="text-[10px] text-stone-500">Raciones Veg.</p>
                        </div>
                    </div>

                    {/* Alcohol */}
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 transition-colors">
                        <div className="p-1.5 rounded-md bg-amber-50">
                            <Activity size={12} className="text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-stone-700">{data.promedios.diasConAlcohol}</p>
                            <p className="text-[10px] text-stone-500">Días Alcohol</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
