import { useState, useEffect } from 'react';
import { Activity, AlertCircle, Clock, Download, FileText, Lock, CheckCircle } from 'lucide-react';
import { ConsultationForm, DailyLog, UserProfile } from '../../types';
import { FORM_DEFINITIONS } from '../../constants/formDefinitions';
import { supabase } from '../../services/supabase';
import { calculateAverages } from '../../services/dataService';

interface ConsultationsViewProps {
  user: UserProfile;
  logs: DailyLog[];
  submittedForms: ConsultationForm[];
  showNotif: (msg: string, type: 'success' | 'error') => void;
  fetchUserForms: (userId: string) => Promise<void>;
}

const ConsultationsView = ({
  user,
  logs,
  submittedForms,
  showNotif,
  fetchUserForms
}: ConsultationsViewProps) => {
  const daysActive = user?.methodStartDate
    ? Math.floor((new Date().getTime() - new Date(user.methodStartDate).getTime()) / (1000 * 3600 * 24)) + 1
    : 0;
  const canAccessF1 = user?.methodStartDate != null;
  const canAccessF2 = daysActive >= 60;
  const canAccessF3 = daysActive >= 90;
  const [formType, setFormType] = useState<'F1' | 'F2' | 'F3'>('F1');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isEditMode, setIsEditMode] = useState(false);

  const isLocked = (formType === 'F1' && !canAccessF1) || (formType === 'F2' && !canAccessF2) || (formType === 'F3' && !canAccessF3);
  const definition = FORM_DEFINITIONS[formType];

  const submittedForm = submittedForms.find(f => f.form_type === formType);
  const isPdfGenerated = submittedForm?.generated_pdf_url;

  useEffect(() => {
    if (submittedForm) {
      const loaded: Record<string, any> = {};
      if (Array.isArray(submittedForm.answers)) {
        submittedForm.answers.forEach((a: any) => {
          loaded[a.questionId] = a.answer;
        });
      }
      setAnswers(loaded);
    } else {
      setAnswers({});
    }
    setIsEditMode(false);
  }, [formType, submittedForm]);

  const handleSubmit = async () => {
    if (!user?.id) return;

    if (isPdfGenerated) {
      showNotif('El informe ya ha sido generado. No se pueden modificar los datos.', 'error');
      return;
    }

    const missingRequired = definition.questions.filter(q => {
      if ((q as any).optional) return false;
      const value = answers[q.id];
      return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    });

    if (missingRequired.length > 0) {
      const missingText = missingRequired.length > 3
        ? `${missingRequired.length} campos obligatorios`
        : missingRequired.map(q => q.text.replace(':', '')).join(', ');
      showNotif('Faltan campos obligatorios: ' + missingText, 'error');
      return;
    }

    const formattedAnswers = definition.questions.map(q => ({
      questionId: q.id,
      question: q.text,
      answer: answers[q.id] || ''
    }));

    let error;
    if (submittedForm) {
      const { error: updateError } = await supabase.from('consultation_forms').update({
        answers: formattedAnswers,
        status: 'pending',
        snapshot_stats: calculateAverages(logs)
      }).eq('id', submittedForm.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('consultation_forms').insert({
        user_id: user.id,
        form_type: formType,
        answers: formattedAnswers,
        status: 'pending',
        snapshot_stats: calculateAverages(logs)
      });
      error = insertError;
    }

    if (!error) {
      showNotif(submittedForm ? 'Formulario actualizado correctamente.' : 'Formulario enviado correctamente.', 'success');
      fetchUserForms(user.id);
    } else {
      showNotif(error.message, 'error');
    }
  };

  return (
    <div className="pb-24 space-y-6">
      <h2 className="text-xl font-bold text-[#4A4A4A]">Consultas</h2>
      <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-[#F4F0ED] overflow-x-auto">
        {[{ id: 'F1', l: 'F1 (30d)' }, { id: 'F2', l: 'F2 (60d)' }, { id: 'F3', l: 'F3 (90d)' }].map(t => (
          <button
            key={t.id}
            onClick={() => setFormType(t.id as 'F1' | 'F2' | 'F3')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
              formType === t.id ? 'bg-[#C7958E] text-white shadow-md' : 'text-[#5D7180] hover:bg-[#F4F0ED]'
            }`}
          >
            {t.l} {submittedForms.find(f => f.form_type === t.id) && '✅'}
          </button>
        ))}
      </div>

      {isLocked ? (
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-[#F4F0ED] text-center">
          <div className="bg-[#F4F0ED] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-[#95706B]" />
          </div>
          <h3 className="font-bold text-[#4A4A4A] text-lg">Consulta Bloqueada</h3>
          <p className="text-sm text-[#5D7180] mt-2 px-4">Estará disponible cuando avances en el método.</p>
          <div className="mt-6 inline-flex items-center gap-2 bg-[#F4F0ED] px-4 py-2 rounded-full text-xs font-bold text-[#95706B]">
            <Activity size={12} /> Tu progreso actual: {daysActive} días
          </div>
        </div>
      ) : (submittedForm && isPdfGenerated) ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
          <div className="flex justify-between items-center mb-4 border-b border-[#F4F0ED] pb-4">
            <h3 className="font-bold text-lg text-[#4A4A4A]">{definition.title}</h3>
            <span className="bg-emerald-100 text-emerald-600 text-[10px] px-3 py-1 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
              <CheckCircle size={10} /> ENVIADO
            </span>
          </div>
          <div className="space-y-4 opacity-80">
            {(submittedForm.answers as any[]).map((ans: any) => (
              <div key={ans.questionId} className="bg-[#F4F0ED]/30 p-3 rounded-xl">
                <p className="text-[10px] uppercase font-bold text-[#95706B] mb-1">{ans.question}</p>
                <p className={`text-sm font-medium ${!ans.answer ? 'text-stone-400 italic' : 'text-[#4A4A4A]'}`}>
                  {Array.isArray(ans.answer) ? ans.answer.join(', ') : (ans.answer || 'Sin respuesta')}
                </p>
              </div>
            ))}
          </div>
          {submittedForm.status === 'pending' && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3">
              <div className="bg-yellow-100 p-2 rounded-full text-yellow-600"><Clock size={16} /></div>
              <div>
                <p className="text-xs font-bold text-yellow-800">En Revisión</p>
                <p className="text-[10px] text-yellow-700 mt-1">Recibirás una notificación cuando tu informe PDF esté listo para descargar.</p>
              </div>
            </div>
          )}
          {submittedForm.status === 'reviewed' && (
            <div className="mt-6 bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
              <p className="text-sm font-bold text-emerald-700 mb-2">¡Informe Listo!</p>
              <button className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 mx-auto">
                <Download size={16} /> Descargar Informe PDF
              </button>
            </div>
          )}
        </div>
      ) : (submittedForm && !isEditMode) ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
          <div className="flex justify-between items-start mb-4 border-b border-[#F4F0ED] pb-4">
            <div>
              <h3 className="font-bold text-lg text-[#4A4A4A]">{definition.title}</h3>
              <p className="text-xs text-[#5D7180] mt-1">
                Registrado: {new Date(submittedForm.submitted_at || '').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => setIsEditMode(true)}
              className="bg-[#C7958E] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#95706B] transition-colors flex items-center gap-2"
            >
              <FileText size={16} />
              Editar
            </button>
          </div>

          <div className="space-y-3">
            {(submittedForm.answers as any[]).map((ans: any) => {
              const question = definition.questions.find(q => q.id === ans.questionId);
              if (!question) return null;

              let displayValue = ans.answer;
              if (question.type === 'date' && typeof displayValue === 'string') {
                displayValue = new Date(displayValue).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                });
              }
              if (Array.isArray(displayValue)) {
                displayValue = displayValue.join(', ');
              }

              return (
                <div key={ans.questionId} className="bg-[#F4F0ED]/30 p-4 rounded-xl">
                  <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">{question.text}</p>
                  <p className={`text-sm font-medium ${!displayValue ? 'text-stone-400 italic' : 'text-[#4A4A4A]'}`}>
                    {displayValue || 'Sin respuesta'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
              <CheckCircle size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">Datos Guardados</p>
              <p className="text-xs text-emerald-700 mt-1">Tus datos están registrados. Puedes editarlos cuando quieras.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
          <h3 className="font-bold text-lg text-[#C7958E] mb-1">{definition.title}</h3>
          <p className="text-xs text-[#5D7180] mb-6 border-b border-[#F4F0ED] pb-4">{definition.description || 'Rellena los datos para tu evaluación.'}</p>
          {submittedForm && !isPdfGenerated && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 p-3 rounded-xl flex items-center gap-3 text-xs text-yellow-800">
              <AlertCircle size={16} />
              <span>Puedes editar tus respuestas hasta que el especialista genere el informe.</span>
            </div>
          )}
          <div className="space-y-6">
            {definition.questions.map(q => {
              if ((q as any).type === 'section') {
                return (
                  <div key={q.id} className="pt-4 first:pt-0">
                    <h4 className="text-sm font-bold text-[#95706B] mb-4 pb-2 border-b border-[#F4F0ED]">{q.text}</h4>
                  </div>
                );
              }

              return (
                <div key={q.id}>
                  <label className="block text-xs font-bold text-[#4A4A4A] mb-2 uppercase tracking-wide">{q.text}</label>
                  {q.type === 'textarea' ? (
                    <textarea
                      value={answers[q.id] || ''}
                      className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm h-28 bg-[#F4F0ED]/30 focus:border-[#C7958E] focus:ring-1 focus:ring-[#C7958E] outline-none transition-all"
                      onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                  ) : q.type === 'yesno' ? (
                    <div className="flex gap-3">
                      <button onClick={() => setAnswers({ ...answers, [q.id]: 'Sí' })} className={`flex-1 py-3 text-sm border rounded-xl transition-all font-bold ${answers[q.id] === 'Sí' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'border-[#F4F0ED] text-[#5D7180] hover:bg-[#F4F0ED]'}`}>Sí</button>
                      <button onClick={() => setAnswers({ ...answers, [q.id]: 'No' })} className={`flex-1 py-3 text-sm border rounded-xl transition-all font-bold ${answers[q.id] === 'No' ? 'bg-rose-50 border-rose-400 text-rose-500' : 'border[#F4F0ED] text-[#5D7180] hover:bg-[#F4F0ED]'}`}>No</button>
                    </div>
                  ) : q.type === 'select' ? (
                    <select
                      className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg-white text[#5D7180] outline-none focus:ring-2 focus:ring[#C7958E]/20"
                      value={answers[q.id] || ''}
                      onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    >
                      <option value="">Seleccionar...</option>
                      {q.options?.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : q.type === 'number' ? (
                    <input
                      type="number"
                      value={answers[q.id] || ''}
                      className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg[#F4F0ED]/30 focus:border[#C7958E] outline-none transition-all"
                      onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                  ) : (
                    <input
                      type="text"
                      value={answers[q.id] || ''}
                      className="w-full border border[#F4F0ED] rounded-xl p-3 text-sm bg[#F4F0ED]/30 focus:border[#C7958E] outline-none transition-all"
                      onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
            <button onClick={handleSubmit} className="w-full bg-[#4A4A4A] text-white py-4 rounded-xl font-bold shadow-lg mt-6 hover:bg-black transition-all flex items-center justify-center gap-2">
              Enviar a Revisión <Download size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationsView;

