import { useState } from 'react';
import { X } from 'lucide-react';
import { BRAND_ASSETS } from '../../constants';

interface PhaseIntroModalProps {
  phase: number;
  onClose: (dontShowAgain: boolean) => void;
}

const PHASE_CONTENT = [
  { title: 'Bienvenida', description: 'Antes de empezar, configura tu perfil y revisa la introducción.', tasks: ['Rellenar F0', 'Ver Video Bienvenida', 'Iniciar Método'] },
  { title: 'Fase 1: Despertar', description: 'Semanas 1-4. Nos enfocamos en la conciencia corporal y registro.', tasks: ['Registro Diario', 'Detox de Hogar', 'Suplementación Base'] },
  { title: 'Fase 2: Reequilibrio', description: 'Semanas 5-8. Ajustes profundos en nutrición y manejo de estrés.', tasks: ['Analíticas Hormonales', 'Protocolo Microbiota', 'Mindset Fértil'] },
  { title: 'Fase 3: Impulso', description: 'Semanas 9-12. Preparación final y decisión de ruta.', tasks: ['Plan Maestro', 'Relato Clínico', 'Consulta F3'] }
];

const PhaseIntroModal = ({ phase, onClose }: PhaseIntroModalProps) => {
  const [dontShow, setDontShow] = useState(false);
  const info = PHASE_CONTENT[phase] || PHASE_CONTENT[0];

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2rem] max-w-sm w-full p-8 shadow-2xl relative overflow-hidden border-4 border-white">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#F4F0ED] to-white -z-10"></div>
        <button
          onClick={() => onClose(dontShow)}
          className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm hover:scale-110 transition-transform"
        >
          <X size={20} className="text-[#95706B]" />
        </button>

        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-full shadow-lg shadow-rose-100">
            <img
              src={BRAND_ASSETS[`phase${phase}` as keyof typeof BRAND_ASSETS] || BRAND_ASSETS.phase0}
              className="w-16 h-16 object-cover"
            />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-[#4A4A4A] mb-2">{info.title}</h2>
        <p className="text-center text-[#5D7180] text-sm mb-8 leading-relaxed">{info.description}</p>

        <div className="bg-[#F4F0ED]/50 rounded-xl p-5 mb-6 border border-[#F4F0ED]">
          <h4 className="text-[10px] uppercase font-bold text-[#95706B] tracking-widest mb-3">Objetivos Clave</h4>
          <ul className="space-y-3">
            {info.tasks.map((task, i) => (
              <li key={task} className="flex items-center gap-3 text-sm font-bold text-[#4A4A4A]">
                <div className="w-5 h-5 rounded-full bg-[#C7958E] text-white flex items-center justify-center text-[10px] shadow-sm">{i + 1}</div>
                {task}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 mb-6 justify-center">
          <input
            type="checkbox"
            id="dontShow"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-[#C7958E] focus:ring-[#C7958E]"
          />
          <label htmlFor="dontShow" className="text-xs text-[#5D7180]">No volver a mostrar esta pantalla</label>
        </div>

        <button
          onClick={() => onClose(dontShow)}
          className="w-full bg-[#4A4A4A] text-white py-4 rounded-xl font-bold shadow-xl hover:scale-[1.02] transition-transform"
        >
          ¡Vamos allá!
        </button>
      </div>
    </div>
  );
};

export default PhaseIntroModal;

