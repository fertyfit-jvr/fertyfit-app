import React from 'react';
import { X, Download, CheckCircle, FileText as PdfIcon } from 'lucide-react';
import { Lesson } from '../../types';
import { getEmbedUrl } from '../../utils/videoUtils';

interface LessonModalProps {
  lesson: Lesson;
  onClose: () => void;
  onMarkComplete: (lessonId: number) => void;
}

export default function LessonModal({ lesson, onClose, onMarkComplete }: LessonModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-ferty-beige/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/50 max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-ferty-beige flex justify-between items-center bg-white sticky top-0 z-10">
          <h3 className="font-bold text-ferty-dark text-sm pr-4">{lesson.title}</h3>
          <button onClick={onClose}>
            <X size={24} className="text-ferty-coral hover:rotate-90 transition-transform" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar">
          {lesson.type === 'video' ? (
            <div className="aspect-video bg-black">
              {lesson.content_url && lesson.content_url.includes('http') ? (
                <iframe
                  src={getEmbedUrl(lesson.content_url) + '?origin=' + window.location.origin + '&rel=0'}
                  title={lesson.title}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <p>Video no disponible</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 bg-ferty-beige/30 text-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-ferty-rose">
                <PdfIcon size={40} />
              </div>
              <p className="text-xs font-bold text-ferty-coral mb-4 uppercase tracking-wider">Recurso Descargable</p>
              <a
                href={lesson.content_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-ferty-dark text-white px-6 py-3 rounded-xl font-bold text-xs shadow-lg hover:bg-black transition-colors"
              >
                <Download size={16} /> Descargar PDF
              </a>
            </div>
          )}

          <div className="p-6">
            <h4 className="text-xs font-bold text-ferty-coral uppercase tracking-widest mb-2">Acerca de esta lección</h4>
            <p className="text-sm text-ferty-gray leading-relaxed mb-8">
              {lesson.description || "No hay descripción disponible para esta lección."}
            </p>

            <button
              onClick={() => onMarkComplete(lesson.id)}
              className="w-full bg-ferty-rose text-white py-4 rounded-xl font-bold shadow-lg shadow-rose-200 hover:bg-ferty-coral transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle size={20} /> Marcar como Completada
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

