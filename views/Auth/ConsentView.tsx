import React, { useState } from 'react';
import { Shield, Check, Lock, Info } from 'lucide-react';
import { BRAND_ASSETS } from '../../constants';
import { supabase } from '../../services/supabase';
import { UserProfile } from '../../types';

interface ConsentViewProps {
    user: UserProfile;
    onConsentComplete: () => void;
    showNotif: (msg: string, type: 'success' | 'error') => void;
}

export default function ConsentView({ user, onConsentComplete, showNotif }: ConsentViewProps) {
    const [consents, setConsents] = useState({
        personal_data: false,
        food: false,
        flora: false,
        flow: false,
        function: false,
        daily_log: false,
        no_diagnosis: false,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const allChecked = Object.values(consents).every(Boolean);

    const handleToggle = (key: keyof typeof consents) => {
        setConsents(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleAcceptAll = () => {
        setConsents({
            personal_data: true,
            food: true,
            flora: true,
            flow: true,
            function: true,
            daily_log: true,
            no_diagnosis: true,
        });
    };

    const handleSubmit = async () => {
        if (!user.id) return;
        setIsSubmitting(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    consent_personal_data: consents.personal_data,
                    consent_food: consents.food,
                    consent_flora: consents.flora,
                    consent_flow: consents.flow,
                    consent_function: consents.function,
                    consent_daily_log: consents.daily_log,
                    consent_no_diagnosis: consents.no_diagnosis,
                    consents_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;

            showNotif('Consentimientos guardados correctamente', 'success');
            onConsentComplete();
        } catch (error) {
            console.error('Error saving consents:', error);
            showNotif('Error al guardar consentimientos', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const ConsentItem = ({
        id,
        label,
        description,
        checked,
        onChange
    }: {
        id: string;
        label: string;
        description: string;
        checked: boolean;
        onChange: () => void;
    }) => (
        <div
            onClick={onChange}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex gap-4 items-start ${checked
                    ? 'border-ferty-rose/50 bg-ferty-rose/5'
                    : 'border-ferty-beigeBorder hover:border-ferty-rose/30 bg-white'
                }`}
        >
            <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${checked
                    ? 'bg-ferty-rose border-ferty-rose text-white'
                    : 'border-ferty-gray/30 text-transparent'
                }`}>
                <Check size={14} strokeWidth={3} />
            </div>
            <div>
                <h4 className={`font-bold text-sm mb-1 ${checked ? 'text-ferty-rose' : 'text-ferty-dark'}`}>
                    {label}
                </h4>
                <p className="text-[11px] text-justify text-ferty-gray leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-ferty-beige font-sans flex flex-col">
            <div className="bg-white p-6 pb-4 shadow-sm z-10 sticky top-0">
                <div className="flex justify-center mb-4">
                    <img src={BRAND_ASSETS.logo} alt="FertyFit" className="h-12 object-contain" />
                </div>
                <h2 className="text-xl font-bold text-center text-ferty-dark mb-1">
                    Consentimiento Informado
                </h2>
                <p className="text-xs text-center text-ferty-gray max-w-xs mx-auto">
                    Para ofrecerte un análisis preciso y personalizado, necesitamos tu consentimiento explícito.
                </p>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-3 pb-32">
                <ConsentItem
                    id="personal_data"
                    label="Protección de Datos Personales"
                    description="Acepto el tratamiento de mis datos personales para la creación de mi perfil y gestión de mi cuenta, conforme a la política de privacidad de FertyFit."
                    checked={consents.personal_data}
                    onChange={() => handleToggle('personal_data')}
                />

                <ConsentItem
                    id="function"
                    label="Datos de Function (Fisiología)"
                    description="Doy mi consentimiento para procesar datos sobre mi salud reproductiva, diagnósticos previos y hábitos de vida (tabaco) para evaluar mi salud fisiológica."
                    checked={consents.function}
                    onChange={() => handleToggle('function')}
                />

                <ConsentItem
                    id="food"
                    label="Datos de Food (Nutrición)"
                    description="Doy mi consentimiento para analizar mis hábitos alimenticios, consumo de alcohol y otros factores metabólicos para generar recomendaciones nutricionales."
                    checked={consents.food}
                    onChange={() => handleToggle('food')}
                />

                <ConsentItem
                    id="flora"
                    label="Datos de Flora (Microbiota)"
                    description="Doy mi consentimiento para tratar datos sobre mi salud digestiva, vaginal y uso de antibióticos/suplementos para evaluar mi salud de microbiota."
                    checked={consents.flora}
                    onChange={() => handleToggle('flora')}
                />

                <ConsentItem
                    id="flow"
                    label="Datos de Flow (Bienestar)"
                    description="Doy mi consentimiento para procesar información sobre mi bienestar emocional, niveles de estrés y calidad de sueño."
                    checked={consents.flow}
                    onChange={() => handleToggle('flow')}
                />

                <ConsentItem
                    id="daily_log"
                    label="Registro Diario"
                    description="Acepto registrar diariamente mis biomarcadores y síntomas para permitir que el algoritmo de FertyFit detecte patrones y mi ventana fértil."
                    checked={consents.daily_log}
                    onChange={() => handleToggle('daily_log')}
                />

                <ConsentItem
                    id="no_diagnosis"
                    label="Exención de Responsabilidad Médica"
                    description="Entiendo y acepto que FertyFit es una herramienta informativa y de acompañamiento. NO realiza diagnósticos médicos ni receta tratamientos. La información proporcionada no sustituye el consejo de un profesional sanitario."
                    checked={consents.no_diagnosis}
                    onChange={() => handleToggle('no_diagnosis')}
                />
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white p-6 border-t border-ferty-beige shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
                <div className="max-w-md mx-auto space-y-3">
                    {!allChecked && (
                        <button
                            onClick={handleAcceptAll}
                            className="w-full text-ferty-rose text-xs font-bold py-2 hover:underline"
                        >
                            Marcar todo
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={!allChecked || isSubmitting}
                        className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${allChecked
                                ? 'bg-gradient-to-r from-ferty-rose to-ferty-coral text-white shadow-lg cursor-pointer hover:scale-[1.02]'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {isSubmitting ? (
                            <span>Guardando...</span>
                        ) : (
                            <>
                                <Shield size={18} />
                                <span>Aceptar y Continuar</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
