import React from 'react';
import { AlertCircle } from 'lucide-react';

interface DisclaimerViewProps {
  onAccept: () => void;
}

export default function DisclaimerView({ onAccept }: DisclaimerViewProps) {
  return (
    <div className="p-6 bg-white min-h-screen flex flex-col items-center justify-center">
      <div className="bg-[#F4F0ED] p-8 rounded-3xl border border-[#C7958E]/20 max-w-sm w-full shadow-xl">
        <h3 className="font-bold text-[#95706B] mb-4 flex items-center gap-2 text-lg">
          <AlertCircle size={24} /> Aviso Importante
        </h3>
        <p className="text-sm text-[#5D7180] leading-relaxed text-justify mb-6">
          FertyFit es un programa educativo. La información aquí presentada no sustituye el consejo médico profesional, diagnóstico o tratamiento.
          Al continuar, aceptas que eres responsable de tu salud y consultarás con tu médico cualquier cambio.
        </p>
        <button
          onClick={onAccept}
          className="w-full bg-[#C7958E] text-white py-4 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-[#95706B] transition-colors"
        >
          Acepto y Continuar
        </button>
      </div>
    </div>
  );
}

