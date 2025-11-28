import { CheckCircle, Lock, PlayCircle, FileText as PdfIcon } from 'lucide-react';
import { BRAND_ASSETS } from '../../constants';
import { CourseModule, Lesson } from '../../types';

interface EducationViewProps {
  courseModules: CourseModule[];
  onSelectLesson: (lesson: Lesson) => void;
}

const phaseMeta = [
  { id: 0, title: 'Bienvenida', range: 'Inicio', icon: BRAND_ASSETS.phase0 },
  { id: 1, title: 'Fase 1: Despertar', range: 'Semana 1-4', icon: BRAND_ASSETS.phase1 },
  { id: 2, title: 'Fase 2: Reequilibrio', range: 'Semana 5-8', icon: BRAND_ASSETS.phase2 },
  { id: 3, title: 'Fase 3: Impulso', range: 'Semana 9-12', icon: BRAND_ASSETS.phase3 }
];

const EducationView = ({ courseModules, onSelectLesson }: EducationViewProps) => (
  <div className="pb-24 space-y-8">
    <h2 className="text-xl font-bold text-[#4A4A4A]">Tu Programa</h2>
    {phaseMeta.map((phase) => {
      const phaseModules = courseModules.filter((module) => module.phase === phase.id);
      if (phaseModules.length === 0 && phase.id !== 0) return null;

      return (
        <div key={phase.id} className="space-y-4">
          <div className="rounded-2xl p-1 flex items-center gap-4">
            <img src={phase.icon} alt="" className="w-12 h-12 rounded-full object-cover shadow-sm border-2 border-white" />
            <div>
              <h3 className="font-bold text-lg text-[#4A4A4A]">{phase.title}</h3>
              <p className="text-xs text-[#5D7180] uppercase font-medium tracking-wider">{phase.range}</p>
            </div>
          </div>
          <div className="space-y-3 pl-2">
            {phaseModules.map((module) => (
              <div
                key={module.id}
                className={`relative bg-white border rounded-xl p-5 transition-all ${module.isLocked ? 'opacity-60 grayscale' : 'shadow-[0_2px_15px_rgba(0,0,0,0.03)] border-[#F4F0ED]'}`}
              >
                {module.isLocked && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl">
                    <div className="bg-[#4A4A4A]/80 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-sm">
                      <Lock size={14} /> Bloqueado
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-[#4A4A4A] text-sm">{module.title}</h4>
                  {module.order_index > 0 && (
                    <span className="text-[10px] bg-[#F4F0ED] px-2 py-1 rounded text-[#95706B] font-bold">SEM {module.order_index}</span>
                  )}
                </div>
                <p className="text-xs text-[#5D7180] mb-4 leading-relaxed">{module.description}</p>
                {!module.isLocked && (
                  <div className="space-y-2">
                    {module.lessons.map((lesson) => {
                      const isCompleted = module.completedLessons.includes(lesson.id);
                      return (
                        <div
                          key={lesson.id}
                          onClick={() => onSelectLesson(lesson)}
                          className="flex items-center gap-3 text-xs text-[#5D7180] p-3 bg-[#F4F0ED]/50 rounded-lg hover:bg-[#C7958E]/10 cursor-pointer border border-transparent hover:border-[#C7958E]/30 transition-all group"
                        >
                          <div className={`p-1.5 rounded-full shadow-sm transition-transform group-hover:scale-110 ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-[#C7958E]'}`}>
                            {isCompleted ? <CheckCircle size={14} /> : lesson.type === 'video' ? <PlayCircle size={14} /> : <PdfIcon size={14} />}
                          </div>
                          <span className="font-medium flex-1">{lesson.title}</span>
                          <span className="text-[#95706B] opacity-70">{lesson.duration}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

export default EducationView;

