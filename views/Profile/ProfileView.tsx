import { useMemo } from 'react';
import { Award, Check, Edit2, FileText, LogOut } from 'lucide-react';
import { AppNotification, ConsultationForm, DailyLog, UserProfile, AdminReport, NotificationAction, ViewState } from '../../types';
import { FORM_DEFINITIONS } from '../../constants/formDefinitions';
import { NotificationList } from '../../components/NotificationSystem';
import ReportCard from '../../components/common/ReportCard';
import { supabase } from '../../services/supabase';

interface ProfileHeaderProps {
  user: UserProfile;
  logs: DailyLog[];
  logsCount: number;
  scores: { total: number; function: number; food: number; flora: number; flow: number };
  submittedForms: ConsultationForm[];
}

const ProfileHeader = ({ user, logs, logsCount, scores, submittedForms }: ProfileHeaderProps) => {
  const daysActive = useMemo(() => {
    if (!user.methodStartDate) return 0;
    const start = new Date(user.methodStartDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
  }, [user.methodStartDate]);

  const level = logsCount > 30 ? 'Experta' : logsCount > 7 ? 'Comprometida' : 'Iniciada';
  const currentWeek = daysActive > 0 ? Math.ceil(daysActive / 7) : 0;

  const monthsTrying = useMemo(() => {
    const f0Form = submittedForms.find(f => f.form_type === 'F0');
    const answer = f0Form?.answers?.find(a => a.questionId === 'q3_time_trying');
    return answer?.answer ? parseInt(answer.answer as string) : null;
  }, [submittedForms]);

  return (
    <div className="bg-gradient-to-br from-[#C7958E] to-[#95706B] pt-10 pb-8 px-6 rounded-b-[2.5rem] shadow-lg mb-6 text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      <div className="relative z-10">
        <div className="flex items-center gap-5 mb-3">
          <div className="w-18 h-18 bg-white text-[#C7958E] rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white/20 shadow-inner">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{user.name}</h2>
            <div className="flex items-center gap-1 text-rose-50 bg-black/10 px-3 py-1 rounded-full w-fit mt-1 backdrop-blur-sm">
              <Award size={12} />
              <span className="text-xs font-medium">Nivel {level}</span>
            </div>
          </div>
        </div>
        <div className="mb-4 text-sm text-white/90 ml-1">
          <p className="flex items-center gap-2">
            <span className="opacity-75">Días Método:</span>
            <span className="font-semibold">{daysActive}</span>
            <span className="opacity-50">•</span>
            <span className="opacity-75">Registros:</span>
            <span className="font-semibold">{logsCount}</span>
            <span className="opacity-50">•</span>
            <span className="opacity-75">Semana:</span>
            <span className="font-semibold">{currentWeek}</span>
          </p>
          {monthsTrying !== null && (
            <p className="text-[11px] opacity-75 mt-1">
              Buscando embarazo desde hace <span className="font-semibold">{monthsTrying}</span> meses
            </p>
          )}
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-75 mb-1">Ferty Score</p>
              <p className="text-3xl font-bold">{scores.total}<span className="text-lg opacity-75">/100</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-75 mb-1">Pilares</p>
              <div className="flex gap-3 text-[10px]">
                {(['function', 'food', 'flora', 'flow'] as const).map(key => (
                  <div key={key} className="flex flex-col items-center">
                    <span className="font-bold text-lg">{(scores as any)[key]}</span>
                    <span className="opacity-75">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ProfileViewProps {
  user: UserProfile;
  logs: DailyLog[];
  submittedForms: ConsultationForm[];
  reports: AdminReport[];
  scores: { total: number; function: number; food: number; flora: number; flow: number };
  visibleNotifications: AppNotification[];
  profileTab: 'PROFILE' | 'HISTORIA';
  setProfileTab: (tab: 'PROFILE' | 'HISTORIA') => void;
  isEditingProfile: boolean;
  setIsEditingProfile: (value: boolean) => void;
  editName: string;
  setEditName: (value: string) => void;
  onSaveProfile: () => Promise<void>;
  isEditingF0: boolean;
  setIsEditingF0: (value: boolean) => void;
  f0Answers: Record<string, any>;
  setF0Answers: (answers: Record<string, any>) => void;
  showNotif: (msg: string, type: 'success' | 'error') => void;
  setView: (view: ViewState) => void;
  fetchUserForms: (userId: string) => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  markNotificationRead: (id: number) => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  onNotificationAction: (notification: AppNotification, action: NotificationAction) => Promise<void>;
  onRestartMethod: () => Promise<void>;
  onLogout: () => Promise<void>;
}

const ProfileView = ({
  user,
  logs,
  submittedForms,
  reports,
  scores,
  visibleNotifications,
  profileTab,
  setProfileTab,
  isEditingProfile,
  setIsEditingProfile,
  editName,
  setEditName,
  onSaveProfile,
  isEditingF0,
  setIsEditingF0,
  f0Answers,
  setF0Answers,
  showNotif,
  setView,
  fetchUserForms,
  setUser,
  markNotificationRead,
  deleteNotification,
  onNotificationAction,
  onRestartMethod,
  onLogout
}: ProfileViewProps) => {
  const handleProfileEditClick = () => {
    if (isEditingProfile) {
      onSaveProfile();
    } else {
      setIsEditingProfile(true);
    }
  };

  const handleRestartClick = async () => {
    const confirmed = confirm('¿Estás segura de que deseas reiniciar el método?');
    if (!confirmed) return;
    await onRestartMethod();
  };

  const handleF0Save = async (f0Form: ConsultationForm) => {
    if (!user?.id) return;

    const formattedAnswers = FORM_DEFINITIONS.F0.questions.map(q => ({
      questionId: q.id,
      question: q.text,
      answer: f0Answers[q.id] || ''
    }));

    const { error } = await supabase
      .from('consultation_forms')
      .update({ answers: formattedAnswers, status: 'pending' })
      .eq('id', f0Form.id);

    if (error) {
      showNotif(error.message, 'error');
      return;
    }

    const updates: Partial<UserProfile> = {};
    if (f0Answers['q2_weight']) updates.weight = parseFloat(f0Answers['q2_weight']);
    if (f0Answers['q2_height']) updates.height = parseFloat(f0Answers['q2_height']);
    if (f0Answers['q4_objective']) updates.mainObjective = f0Answers['q4_objective'];
    if (f0Answers['q8_last_period']) updates.lastPeriodDate = f0Answers['q8_last_period'];

    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update({
        weight: updates.weight,
        height: updates.height,
        main_objective: updates.mainObjective,
        last_period_date: updates.lastPeriodDate
      }).eq('id', user.id);
      setUser({ ...user, ...updates });
    }

    showNotif('Ficha Personal actualizada correctamente', 'success');
    setIsEditingF0(false);
    fetchUserForms(user.id);
  };

  return (
    <div className="pb-24">
      <ProfileHeader
        user={user}
        logs={logs}
        logsCount={logs.length}
        scores={scores}
        submittedForms={submittedForms}
      />

      <div className="p-5 pt-0">
        <div className="flex gap-2 mb-6 bg-white p-1 rounded-2xl shadow-sm">
          <button
            onClick={() => setProfileTab('PROFILE')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${profileTab === 'PROFILE'
              ? 'bg-[#C7958E] text-white shadow-md'
              : 'text-[#5D7180] hover:bg-[#F4F0ED]'}`}
          >
            Mi Perfil
          </button>
          <button
            onClick={() => setProfileTab('HISTORIA')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${profileTab === 'HISTORIA'
              ? 'bg-[#C7958E] text-white shadow-md'
              : 'text-[#5D7180] hover:bg-[#F4F0ED]'}`}
          >
            Historia
          </button>
        </div>

        {profileTab === 'PROFILE' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h3 className="font-bold text-[#4A4A4A] text-sm">Datos Personales</h3>
                  <p className="text-[10px] text-[#5D7180] mt-0.5">
                    Miembro desde: {new Date(user.joinedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={handleProfileEditClick}
                  className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                >
                  {isEditingProfile ? <Check size={16} /> : <Edit2 size={16} />}
                </button>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#F4F0ED] space-y-4">
                <div className="border-b border-[#F4F0ED] pb-3">
                  <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Nombre</p>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full text-sm text-[#4A4A4A] border-b border-[#C7958E] focus:outline-none py-1"
                    />
                  ) : (
                    <p className="text-sm text-[#4A4A4A]">{user.name}</p>
                  )}
                </div>
                <div className="border-b border-[#F4F0ED] pb-3">
                  <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">Email</p>
                  <p className="text-sm text-[#4A4A4A] opacity-70">{user.email} <span className="text-[10px] italic">(No editable)</span></p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Mis Informes</h3>
              {reports.length > 0 ? (
                <div className="space-y-3">
                  {reports.map(report => (
                    <ReportCard key={report.id} report={report} />
                  ))}
                </div>
              ) : (
                <div className="bg-white p-6 rounded-2xl border border-dashed border-stone-200 text-center text-stone-400 text-xs italic">
                  Aún no tienes informes disponibles
                </div>
              )}
            </div>

            <div>
              <NotificationList
                notifications={visibleNotifications}
                onMarkRead={markNotificationRead}
                deleteNotification={deleteNotification}
                onAction={onNotificationAction}
              />
            </div>

            {user.methodStartDate && (
              <button
                onClick={handleRestartClick}
                className="w-full py-2 text-xs text-stone-400 hover:text-[#C7958E] transition-colors underline"
              >
                Reiniciar Método
              </button>
            )}

            <button
              onClick={onLogout}
              className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors border border-rose-100"
            >
              <LogOut size={20} />
              Cerrar Sesión
            </button>
          </div>
        )}

        {profileTab === 'HISTORIA' && (() => {
          const f0Form = submittedForms.find(f => f.form_type === 'F0');
          if (!f0Form) {
            return (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-stone-200 text-center">
                <FileText size={48} className="mx-auto text-stone-300 mb-4" />
                <p className="text-stone-400 text-sm">Aún no has completado el formulario F0</p>
                <button
                  onClick={() => setView('CONSULTATIONS')}
                  className="mt-4 bg-[#C7958E] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#95706B] transition-colors"
                >
                  Completar F0
                </button>
              </div>
            );
          }

          const formatDate = (dateStr: string) =>
            new Date(dateStr).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });

          const handleEditF0Click = () => {
            const initialAnswers: Record<string, any> = {};
            f0Form.answers.forEach((a: any) => { initialAnswers[a.questionId] = a.answer; });
            setF0Answers(initialAnswers);
            setIsEditingF0(true);
          };

          return (
            <div className="space-y-4">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h3 className="font-bold text-[#4A4A4A] text-sm">Ficha Personal (F0)</h3>
                  <p className="text-[10px] text-[#5D7180] mt-0.5">
                    Registrado: {formatDate(f0Form.submitted_at || new Date().toISOString())}
                  </p>
                  {f0Form.pdf_generated_at && (
                    <p className="text-[10px] text-[#5D7180] mt-0.5">
                      Última actualización: {formatDate(f0Form.pdf_generated_at)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (isEditingF0) {
                      handleF0Save(f0Form);
                    } else {
                      handleEditF0Click();
                    }
                  }}
                  className="text-[#C7958E] hover:bg-[#F4F0ED] p-1.5 rounded-lg transition-colors"
                >
                  {isEditingF0 ? <Check size={16} /> : <Edit2 size={16} />}
                </button>
              </div>

              {isEditingF0 ? (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#F4F0ED]">
                  <h3 className="font-bold text-lg text-[#C7958E] mb-1">{FORM_DEFINITIONS.F0.title}</h3>
                  <p className="text-xs text-[#5D7180] mb-6 border-b border-[#F4F0ED] pb-4">{FORM_DEFINITIONS.F0.description}</p>
                  <div className="space-y-6">
                    {FORM_DEFINITIONS.F0.questions.map(q => (
                      <div key={q.id}>
                        <label className="block text-xs font-bold text-[#4A4A4A] mb-2 uppercase tracking-wide">{q.text}</label>
                        {q.type === 'textarea' ? (
                          <textarea
                            value={f0Answers[q.id] || ''}
                            className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm h-28 bg-[#F4F0ED]/30 focus:border-[#C7958E] focus:ring-1 focus:ring-[#C7958E] outline-none transition-all"
                            onChange={e => setF0Answers({ ...f0Answers, [q.id]: e.target.value })}
                          />
                        ) : q.type === 'yesno' ? (
                          <div className="flex gap-3">
                            {['Sí', 'No'].map(option => (
                              <button
                                key={option}
                                onClick={() => setF0Answers({ ...f0Answers, [q.id]: option })}
                                className={`flex-1 py-3 text-sm border rounded-xl transition-all font-bold ${f0Answers[q.id] === option
                                  ? option === 'Sí'
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
                                    : 'bg-rose-50 border-rose-400 text-rose-500'
                                  : 'border-[#F4F0ED] text-[#5D7180] hover:bg-[#F4F0ED]'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        ) : q.type === 'buttons' ? (
                          <div className="flex gap-3">
                            {q.options?.map(option => (
                              <button
                                key={option}
                                onClick={() => setF0Answers({ ...f0Answers, [q.id]: option })}
                                className={`flex-1 py-3 text-sm border rounded-xl transition-all font-bold ${f0Answers[q.id] === option
                                  ? 'bg-[#C7958E] border-[#C7958E] text-white'
                                  : 'border-[#F4F0ED] text-[#5D7180] hover:bg-[#F4F0ED]'}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        ) : q.type === 'date' ? (
                          <input
                            type="date"
                            value={f0Answers[q.id] || ''}
                            className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg-[#F4F0ED]/30 focus:border-[#C7958E] outline-none transition-all"
                            onChange={e => setF0Answers({ ...f0Answers, [q.id]: e.target.value })}
                          />
                        ) : (
                          <input
                            type={q.type === 'number' ? 'number' : 'text'}
                            value={f0Answers[q.id] || ''}
                            className="w-full border border-[#F4F0ED] rounded-xl p-3 text-sm bg-[#F4F0ED]/30 focus:border-[#C7958E] outline-none transition-all"
                            onChange={e => setF0Answers({ ...f0Answers, [q.id]: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleF0Save(f0Form)}
                    className="w-full bg-[#5D7180] text-white py-4 rounded-xl font-bold shadow-lg mt-8 hover:bg-[#4A5568] transition-all flex items-center justify-center gap-2"
                  >
                    Guardar cambios
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#F4F0ED] space-y-4">
                  {f0Form.answers.map((answer, idx) => {
                    const question = FORM_DEFINITIONS.F0.questions.find(q => q.id === answer.questionId);
                    if (!question) return null;

                    let displayValue = answer.answer;
                    if (question.type === 'date' && typeof displayValue === 'string') {
                      displayValue = formatDate(displayValue);
                    }
                    if (Array.isArray(displayValue)) {
                      displayValue = displayValue.join(', ');
                    }

                    return (
                      <div key={idx} className="border-b border-[#F4F0ED] pb-3 last:border-0">
                        <p className="text-xs font-bold text-[#95706B] uppercase tracking-wider mb-1">{question.text}</p>
                        <p className="text-sm text-[#4A4A4A]">{displayValue || '-'}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ProfileView;

