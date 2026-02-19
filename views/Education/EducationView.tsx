import { CheckCircle, Lock, PlayCircle, FileText as PdfIcon, Crown } from 'lucide-react';
import { BRAND_ASSETS } from '../../constants';
import { CourseModule, Lesson } from '../../types';
import { canAccessModule } from '../../services/tierGuards';

interface EducationViewProps {
  courseModules: CourseModule[];
  onSelectLesson: (lesson: Lesson) => void;
  user_type?: string;
  onNavigate?: (view: any) => void;
}


const phaseMeta = [
  { id: 0, title: 'Bienvenida', range: 'Inicio', icon: BRAND_ASSETS.phase0 },
  { id: 1, title: 'Fase 1: Despertar', range: 'Semana 1-4', icon: BRAND_ASSETS.phase1 },
  { id: 2, title: 'Fase 2: Reequilibrio', range: 'Semana 5-8', icon: BRAND_ASSETS.phase2 },
  { id: 3, title: 'Fase 3: Impulso', range: 'Semana 9-12', icon: BRAND_ASSETS.phase3 }
];

const EducationView = ({ courseModules, onSelectLesson, user_type, onNavigate }: EducationViewProps) => {
  // Ensure courseModules is always an array
  const safeCourseModules = Array.isArray(courseModules) ? courseModules : [];

  return (
    <div className="pb-24 space-y-8">
      <h2 className="text-xl font-bold text-ferty-dark">Tu Programa</h2>
      {phaseMeta.map((phase) => {
        const phaseModules = safeCourseModules.filter((module) => {
          // Ensure module has required properties
          if (!module || typeof module.phase === 'undefined') return false;
          return module.phase === phase.id;
        });
        if (phaseModules.length === 0 && phase.id !== 0) return null;

        // Verificar acceso por tier
        const hasAccess = canAccessModule(user_type, phase.id);

        return (
          <div key={phase.id} className="space-y-4">
            <div className="rounded-2xl p-1 flex items-center gap-4">
              <img src={phase.icon} alt="" className={`w-12 h-12 rounded-full object-cover shadow-sm border-2 border-white ${!hasAccess ? 'grayscale opacity-50' : ''}`} />
              <div className="flex-1">
                <h3 className="font-bold text-lg text-ferty-dark">{phase.title}</h3>
                <p className="text-xs text-ferty-gray uppercase font-medium tracking-wider">{phase.range}</p>
              </div>
              {!hasAccess && (
                <button
                  onClick={() => onNavigate?.('CHECKOUT')}
                  className="flex items-center gap-1 text-xs bg-ferty-rose text-white px-3 py-1.5 rounded-full font-bold hover:opacity-90 transition-opacity"
                >
                  <Crown size={12} />
                  Desbloquear
                </button>
              )}
            </div>
            <div className="space-y-3 pl-2">
              {phaseModules.map((module) => {
                // Ensure lessons and completedLessons are always arrays
                const safeLessons = Array.isArray(module.lessons) ? module.lessons : [];
                const safeCompletedLessons = Array.isArray(module.completedLessons) ? module.completedLessons : [];

                return (
                  <div
                    key={module.id}
                    className={`relative bg-white border rounded-xl p-5 transition-all ${!hasAccess || module.isLocked ? 'opacity-60 grayscale' : 'shadow-[0_2px_15px_rgba(0,0,0,0.03)] border-ferty-beige'}`}
                  >
                    {(!hasAccess || module.isLocked) && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl">
                        <div className="bg-ferty-dark/80 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-sm">
                          <Lock size={14} /> {!hasAccess ? 'Requiere plan Premium o VIP' : 'Bloqueado'}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-ferty-dark text-sm">{module.title}</h4>
                      {module.order_index > 0 && (
                        <span className="text-[10px] bg-ferty-beige px-2 py-1 rounded text-ferty-coral font-bold">SEM {module.order_index}</span>
                      )}
                    </div>
                    <p className="text-xs text-ferty-gray mb-4 leading-relaxed">{module.description}</p>
                    {!module.isLocked && hasAccess && (
                      <div className="space-y-2">
                        {safeLessons.map((lesson) => {
                          const isCompleted = safeCompletedLessons.includes(lesson.id);
                          return (
                            <div
                              key={lesson.id}
                              onClick={() => onSelectLesson(lesson)}
                              className="flex items-center gap-3 text-xs text-ferty-gray p-3 bg-ferty-beige/50 rounded-lg hover:bg-ferty-rose/10 cursor-pointer border border-transparent hover:border-ferty-rose/30 transition-all group"
                            >
                              <div className={`p-1.5 rounded-full shadow-sm transition-transform group-hover:scale-110 ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-ferty-rose'}`}>
                                {isCompleted ? <CheckCircle size={14} /> : lesson.type === 'video' ? <PlayCircle size={14} /> : <PdfIcon size={14} />}
                              </div>
                              <span className="font-medium flex-1">{lesson.title}</span>
                              <span className="text-ferty-coral opacity-70">{lesson.duration}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default EducationView;

