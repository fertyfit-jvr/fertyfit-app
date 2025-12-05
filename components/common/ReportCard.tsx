import { useState } from 'react';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';

interface ReportCardProps {
  report: any;
}

const ReportCard = ({ report }: ReportCardProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-ferty-beige rounded-2xl shadow-sm overflow-hidden transition-all">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-4 cursor-pointer hover:bg-ferty-beige/30 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-ferty-rose/10 text-ferty-rose">
            <Download size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-ferty-dark">{report.title}</p>
            <p className="text-[10px] text-ferty-gray uppercase font-semibold tracking-widest">
              {new Date(report.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report.pdf_url && (
            <a
              href={report.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-full bg-ferty-rose/10 text-ferty-rose hover:bg-ferty-rose hover:text-white transition-colors"
            >
              <Download size={16} />
            </a>
          )}
          {expanded ? <ChevronUp size={20} className="text-ferty-gray" /> : <ChevronDown size={20} className="text-ferty-gray" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-ferty-beige pt-4 bg-ferty-beigeLight space-y-3">
          {report.summary && (
            <div>
              <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-1">Resumen</p>
              <p className="text-sm text-ferty-dark leading-relaxed">{report.summary}</p>
            </div>
          )}

          {report.recommendations && (
            <div>
              <p className="text-xs font-bold text-ferty-coral uppercase tracking-wider mb-1">Recomendaciones</p>
              <p className="text-sm text-ferty-dark leading-relaxed whitespace-pre-wrap">{report.recommendations}</p>
            </div>
          )}

          {report.pdf_url && (
            <a
              href={report.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-xs bg-ferty-rose hover:bg-ferty-coral text-white py-2 px-4 rounded-lg transition-colors"
            >
              <Download size={14} />
              Descargar PDF Completo
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportCard;

