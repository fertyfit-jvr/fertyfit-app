import React, { useState } from 'react';
import { Check, Edit2, X } from 'lucide-react';
import { ConsultationForm, FormAnswer, UserProfile, ViewState } from '../../types';
import { formatDate } from '../../services/utils';
import { supabase } from '../../services/supabase';

interface AnalyticsViewProps {
  user: UserProfile;
  submittedForms: ConsultationForm[];
  showNotif: (msg: string, type: 'success' | 'error') => void;
  setView: (view: ViewState) => void;
  fetchUserForms: (userId: string) => Promise<void>;
}

const AnalyticsView = ({
  user,
  submittedForms,
  showNotif,
  setView,
  fetchUserForms
}: AnalyticsViewProps) => {
  // Estados para analíticas
  const [expandedExamAnswers, setExpandedExamAnswers] = useState<Record<number, boolean>>({});
  const [visibleExamFormsCount, setVisibleExamFormsCount] = useState(10);
  const [editingExamId, setEditingExamId] = useState<number | null>(null);
  const [editingExamAnswers, setEditingExamAnswers] = useState<Record<number, FormAnswer[]>>({});

  // Filtrar formularios que son exámenes (tienen exam_type en las respuestas)
  const examForms = submittedForms.filter(form => {
    if (!form.answers || !Array.isArray(form.answers)) return false;
    return form.answers.some((a: FormAnswer) => a.questionId === 'exam_type');
  });

  // Ordenar por fecha más reciente primero
  const sortedExamForms = [...examForms].sort((a, b) => {
    const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
    const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
    return dateB - dateA;
  });

  // Mostrar solo las últimas N analíticas
  const visibleForms = sortedExamForms.slice(0, visibleExamFormsCount);
  const hasMore = sortedExamForms.length > visibleExamFormsCount;

  const handleDeleteExam = async (examFormId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta analítica?')) return;
    
    try {
      const { error } = await supabase
        .from('consultation_forms')
        .delete()
        .eq('id', examFormId);
      
      if (error) throw error;
      
      showNotif('Analítica eliminada correctamente', 'success');
      await fetchUserForms(user.id!);
    } catch (error) {
      showNotif('Error al eliminar la analítica', 'error');
      console.error('Error deleting exam:', error);
    }
  };

  const handleEditExam = (examForm: ConsultationForm) => {
    setEditingExamId(examForm.id!);
    const answersCopy = examForm.answers ? [...examForm.answers] : [];
    setEditingExamAnswers(prev => ({ ...prev, [examForm.id!]: answersCopy }));
  };

  const handleCancelEditExam = (examFormId: number) => {
    setEditingExamId(null);
    setEditingExamAnswers(prev => {
      const newState = { ...prev };
      delete newState[examFormId];
      return newState;
    });
  };

  const handleSaveExam = async (examForm: ConsultationForm) => {
    if (!editingExamAnswers[examForm.id!]) return;

    try {
      const { error } = await supabase
        .from('consultation_forms')
        .update({
          answers: editingExamAnswers[examForm.id!],
          updated_at: new Date().toISOString()
        })
        .eq('id', examForm.id);

      if (error) throw error;

      showNotif('Analítica actualizada correctamente', 'success');
      setEditingExamId(null);
      setEditingExamAnswers(prev => {
        const newState = { ...prev };
        delete newState[examForm.id!];
        return newState;
      });
      await fetchUserForms(user.id!);
    } catch (error) {
      showNotif('Error al actualizar la analítica', 'error');
      console.error('Error updating exam:', error);
    }
  };

  const handleUpdateExamAnswer = (examFormId: number, questionId: string, value: any) => {
    setEditingExamAnswers(prev => {
      const answers = prev[examFormId] || [];
      const updatedAnswers = answers.map(answer =>
        answer.questionId === questionId ? { ...answer, answer: value } : answer
      );
      return { ...prev, [examFormId]: updatedAnswers };
    });
  };

  return (
    <div className="pb-24 pt-0">
      <div className="p-5 pt-0">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-ferty-dark mb-1">Analíticas</h2>
          <p className="text-[10px] text-ferty-gray">
            Tus analíticas médicas guardadas. Puedes editarlas o eliminarlas cuando lo necesites.
          </p>
        </div>
        
        {/* Links discretos para navegar */}
        <div className="mb-4 flex justify-between items-center">
          <div className="flex gap-4">
            <button
              onClick={() => setView('CONSULTATIONS')}
              className="text-xs font-bold text-ferty-dark hover:text-ferty-gray transition-colors underline"
            >
              Subir analítica →
            </button>
            <button
              onClick={() => setView('REPORTS')}
              className="text-xs text-ferty-gray hover:text-ferty-rose transition-colors underline"
            >
              Informes →
            </button>
          </div>
          <button
            onClick={() => setView('PROFILE')}
            className="text-xs text-ferty-gray hover:text-ferty-rose transition-colors underline"
          >
            Volver
          </button>
        </div>

        {examForms.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-stone-200 text-center">
            <p className="text-stone-400 text-sm">Aún no has guardado ninguna analítica</p>
            <p className="text-stone-300 text-xs mt-2">Puedes agregar analíticas desde los formularios de los pilares</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border border-ferty-beige rounded-3xl p-4 shadow-sm">
              <div className="space-y-3">
                {visibleForms.map((examForm) => {
                  const examTypeAnswer = examForm.answers?.find((a: FormAnswer) => a.questionId === 'exam_type');
                  const examType = examTypeAnswer?.answer || 'Examen';
                  const isEditing = editingExamId === examForm.id;
                  const currentAnswers = isEditing && editingExamAnswers[examForm.id!] 
                    ? editingExamAnswers[examForm.id!] 
                    : examForm.answers || [];
                  
                  // Separar el comentario de validación
                  const commentAnswer = currentAnswers.find((a: FormAnswer) => a.questionId === 'gemini_comment');
                  const examAnswers = currentAnswers.filter((a: FormAnswer) => 
                    a.questionId !== 'exam_type' && a.questionId !== 'gemini_comment'
                  );
                  
                  const isExpanded = expandedExamAnswers[examForm.id!] || false;
                  const initialShowCount = 6;
                  const showAll = isExpanded || examAnswers.length <= initialShowCount;

                  return (
                    <div key={examForm.id} className="bg-ferty-beigeLight border border-ferty-beige rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-ferty-dark">{examType}</p>
                          <p className="text-[10px] text-ferty-gray">
                            {examForm.submitted_at ? formatDate(examForm.submitted_at) : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveExam(examForm)}
                                className="p-1.5 text-ferty-rose hover:bg-ferty-beige rounded-lg transition-colors"
                                title="Guardar"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => handleCancelEditExam(examForm.id!)}
                                className="p-1.5 text-ferty-coral hover:bg-ferty-beige rounded-lg transition-colors"
                                title="Cancelar"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditExam(examForm)}
                                className="p-1.5 text-ferty-rose hover:bg-ferty-beige rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteExam(examForm.id!)}
                                className="p-1.5 text-ferty-coral hover:bg-ferty-beige rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(showAll ? examAnswers : examAnswers.slice(0, initialShowCount)).map((answer: FormAnswer) => (
                          <div key={answer.questionId} className="bg-white p-2 rounded-xl">
                            <p className="text-[10px] text-ferty-gray mb-0.5">{answer.question}</p>
                            {isEditing ? (
                              <input
                                type="text"
                                value={typeof answer.answer === 'object' ? JSON.stringify(answer.answer) : String(answer.answer || '')}
                                onChange={(e) => handleUpdateExamAnswer(examForm.id!, answer.questionId, e.target.value)}
                                className="w-full text-xs font-semibold text-ferty-dark border border-ferty-beige rounded-lg p-1 focus:border-ferty-rose focus:outline-none"
                              />
                            ) : (
                              <p className="text-xs font-semibold text-ferty-dark">
                                {typeof answer.answer === 'object' ? JSON.stringify(answer.answer) : String(answer.answer)}
                              </p>
                            )}
                          </div>
                        ))}
                        {examAnswers.length > initialShowCount && !showAll && (
                          <button
                            onClick={() => setExpandedExamAnswers(prev => ({ ...prev, [examForm.id!]: true }))}
                            className="col-span-2 text-center py-2 text-[10px] text-ferty-rose hover:text-ferty-coral font-semibold transition-colors"
                          >
                            +{examAnswers.length - initialShowCount} valores más
                          </button>
                        )}
                        {showAll && examAnswers.length > initialShowCount && (
                          <button
                            onClick={() => setExpandedExamAnswers(prev => ({ ...prev, [examForm.id!]: false }))}
                            className="col-span-2 text-center py-2 text-[10px] text-ferty-gray hover:text-ferty-dark font-semibold transition-colors"
                          >
                            Mostrar menos
                          </button>
                        )}
                      </div>
                      {/* Campo de comentario en columna completa (solo lectura) */}
                      {commentAnswer && (
                        <div className="mt-3 bg-white p-3 rounded-xl">
                          <p className="text-[10px] text-ferty-gray mb-1">
                            {commentAnswer.question.replace(' (Gemini)', '')}
                          </p>
                          <p className="text-xs font-semibold text-ferty-dark whitespace-pre-wrap">
                            {typeof commentAnswer.answer === 'string' ? commentAnswer.answer : String(commentAnswer.answer || '')}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {hasMore && (
                <button
                  onClick={() => setVisibleExamFormsCount(prev => prev + 10)}
                  className="w-full mt-4 py-2 text-xs text-ferty-rose hover:text-ferty-coral font-semibold transition-colors border border-ferty-beige rounded-xl hover:bg-ferty-beigeLight"
                >
                  Cargar más analíticas
                </button>
              )}
              {visibleExamFormsCount > 10 && visibleForms.length < sortedExamForms.length && (
                <button
                  onClick={() => setVisibleExamFormsCount(10)}
                  className="w-full mt-2 py-2 text-xs text-ferty-gray hover:text-ferty-dark transition-colors"
                >
                  Mostrar menos
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsView;

