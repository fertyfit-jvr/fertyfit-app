import React, { useState } from 'react';
import { Shield, Check, Info, FileText, AlertCircle } from 'lucide-react';
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
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const allChecked = Object.values(consents).every(Boolean);

    const handleToggle = (key: keyof typeof consents) => {
        setConsents(prev => ({ ...prev, [key]: !prev[key] }));
        setErrorMsg(null);
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
        setErrorMsg(null);
    };

    const handleSubmit = async () => {
        if (!user.id) {
            setErrorMsg('No se ha podido identificar al usuario.');
            return;
        }

        setIsSubmitting(true);
        setErrorMsg(null);

        try {
            const { data, error } = await supabase
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
                .eq('id', user.id)
                .select();

            if (error) {
                console.error('Supabase update error:', error);
                throw error;
            }

            // Verification: Check if data was actually returned/updated
            if (!data || data.length === 0) {
                console.warn('Update succeeded but no data returned. Possible RLS issue.');
                // Don't throw here immediately, proceed optimistically? 
                // Or throw to warn user?
                // If RLS allows update but not select, data might be empty.
                // But usually RLS returning allows select.
            }

            showNotif('Consentimientos guardados correctamente', 'success');
            onConsentComplete();
        } catch (error: any) {
            console.error('Error saving consents:', error);
            const isRlsError = error.message?.includes('policy') || error.code === '42501';
            setErrorMsg(
                isRlsError
                    ? 'Error de permisos: No se pudo actualizar tu perfil. Contacta soporte.'
                    : 'Hubo un problema al guardar tus preferencias. Inténtalo de nuevo.'
            );
            showNotif('Error al guardar consentimientos', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-ferty-beigeLight/50 font-sans py-8 p-4 flex items-center justify-center">
            <div className="max-w-2xl w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-ferty-beige">

                {/* Header Documento */}
                <div className="bg-ferty-dark text-white p-6 pb-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ferty-rose to-ferty-coral"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
                            <FileText size={24} className="text-ferty-rose" />
                        </div>
                        <h2 className="text-xl font-bold mb-1">Consentimiento Informado</h2>
                        <p className="text-white/60 text-xs uppercase tracking-widest font-semibold">Términos del Servicio FertyFit</p>
                    </div>
                    {/* Background decoration */}
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-ferty-rose/10 rounded-full blur-2xl"></div>
                    <div className="absolute -top-10 -left-10 w-32 h-32 bg-ferty-coral/10 rounded-full blur-2xl"></div>
                </div>

                {/* Body Documento (Scrollable) */}
                <div className="p-8 pb-4">
                    <div className="prose prose-sm max-w-none text-ferty-gray text-justify leading-relaxed text-xs sm:text-sm h-64 overflow-y-auto pr-2 custom-scrollbar border-b border-ferty-beige mb-6">
                        <p className="mb-4">
                            <strong>Bienvenida a FertyFit.</strong> Para proporcionarte un análisis integral de tu salud y diseñar un plan personalizado, necesitamos procesar cierta información sensible.
                        </p>
                        <p className="mb-4">
                            Nuestra metodología se basa en 4 pilares fundamentales: <strong>Function</strong> (Fisiología), <strong>Food</strong> (Nutrición), <strong>Flora</strong> (Microbiota) y <strong>Flow</strong> (Bienestar). Al utilizar nuestra plataforma, aceptas recopilar y analizar datos relacionados con estas áreas, así como información personal básica.
                        </p>
                        <h4 className="font-bold text-ferty-dark mb-2">1. Privacidad y Datos</h4>
                        <p className="mb-4">
                            Tus datos son tuyos. FertyFit cumple estrictamente con el GDPR y las leyes de protección de datos. Solo utilizamos tu información para generar tus reportes y mejorar tu experiencia. Nunca venderemos tus datos personales a terceros.
                        </p>
                        <h4 className="font-bold text-ferty-dark mb-2">2. Naturaleza del Servicio</h4>
                        <p className="mb-4">
                            FertyFit es una herramienta informativa y educativa. <strong>No es un dispositivo médico ni sustituye el consejo, diagnóstico o tratamiento de un profesional de la salud.</strong> Si tienes preocupaciones médicas, consulta siempre a tu médico.
                        </p>
                        <h4 className="font-bold text-ferty-dark mb-2">3. Compromiso</h4>
                        <p className="mb-4">
                            Al registrar tus biomarcadores diarios, permites que nuestros algoritmos detecten tu ventana fértil y patrones de ciclo. La precisión de nuestros reportes depende de la veracidad de los datos que ingreses.
                        </p>
                    </div>

                    {/* Checkboxes Discretos */}
                    <div className="space-y-3 bg-ferty-beigeLight/30 p-4 rounded-xl border border-ferty-beige/50">
                        <p className="text-xs font-bold text-ferty-dark mb-3 uppercase tracking-wider">Por favor, confirma tu aceptación:</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input type="checkbox" checked={consents.personal_data} onChange={() => handleToggle('personal_data')} className="mt-0.5" />
                                <span className="text-xs text-ferty-gray group-hover:text-ferty-dark transition-colors">Acepto el tratamiento de <strong>Datos Personales</strong>.</span>
                            </label>

                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input type="checkbox" checked={consents.function} onChange={() => handleToggle('function')} className="mt-0.5" />
                                <span className="text-xs text-ferty-gray group-hover:text-ferty-dark transition-colors">Acepto el análisis de <strong>Function</strong> (Fisiología).</span>
                            </label>

                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input type="checkbox" checked={consents.food} onChange={() => handleToggle('food')} className="mt-0.5" />
                                <span className="text-xs text-ferty-gray group-hover:text-ferty-dark transition-colors">Acepto el análisis de <strong>Food</strong> (Nutrición).</span>
                            </label>

                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input type="checkbox" checked={consents.flora} onChange={() => handleToggle('flora')} className="mt-0.5" />
                                <span className="text-xs text-ferty-gray group-hover:text-ferty-dark transition-colors">Acepto el análisis de <strong>Flora</strong> (Microbiota).</span>
                            </label>

                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input type="checkbox" checked={consents.flow} onChange={() => handleToggle('flow')} className="mt-0.5" />
                                <span className="text-xs text-ferty-gray group-hover:text-ferty-dark transition-colors">Acepto el análisis de <strong>Flow</strong> (Bienestar).</span>
                            </label>

                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input type="checkbox" checked={consents.daily_log} onChange={() => handleToggle('daily_log')} className="mt-0.5" />
                                <span className="text-xs text-ferty-gray group-hover:text-ferty-dark transition-colors">Acepto realizar el <strong>Registro Diario</strong>.</span>
                            </label>
                        </div>

                        <div className="pt-2 mt-2 border-t border-ferty-beige/50">
                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input type="checkbox" checked={consents.no_diagnosis} onChange={() => handleToggle('no_diagnosis')} className="mt-0.5 accent-ferty-rose" />
                                <span className="text-xs text-ferty-gray group-hover:text-ferty-dark transition-colors">
                                    He leído y comprendo que FertyFit <strong>NO ofrece diagnósticos médicos</strong>.
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-gray-50 p-6 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-ferty-beige/50">
                    {!allChecked ? (
                        <button
                            onClick={handleAcceptAll}
                            className="text-xs text-ferty-gray hover:text-ferty-rose underline transition-colors order-2 md:order-1"
                        >
                            Aceptar todo
                        </button>
                    ) : (
                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 order-2 md:order-1">
                            <Check size={14} /> Todo marcado
                        </span>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!allChecked || isSubmitting}
                        className={`order-1 md:order-2 px-8 py-3 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-sm ${allChecked
                                ? 'bg-ferty-rose text-white hover:bg-ferty-roseHover cursor-pointer hover:shadow-lg transform active:scale-95'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {isSubmitting ? 'Guardando...' : 'Aceptar y Continuar'}
                    </button>
                </div>

                {errorMsg && (
                    <div className="bg-red-50 p-3 text-center border-t border-red-100">
                        <p className="text-xs text-red-600 flex items-center justify-center gap-2">
                            <AlertCircle size={14} /> {errorMsg}
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
}
