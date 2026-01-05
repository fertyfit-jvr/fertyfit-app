import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Printer, Mail } from 'lucide-react';
import { AppNotification } from '../types';

interface ReportViewerProps {
  report: AppNotification;
  onClose: () => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ report, onClose }) => {
  const isMarkdown = report.metadata?.format === 'markdown';
  const content = report.message;

  // Convertir Markdown a texto plano para correo
  const convertMarkdownToPlainText = (markdown: string): string => {
    return markdown
      .replace(/#{1,6}\s+/g, '') // Eliminar headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Eliminar negritas
      .replace(/\*(.*?)\*/g, '$1') // Eliminar cursivas
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Convertir links
      .replace(/^\s*[-*+]\s+/gm, '• ') // Convertir listas
      .replace(/^\s*\d+\.\s+/gm, '') // Eliminar numeración
      .trim();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    const plainText = isMarkdown ? convertMarkdownToPlainText(content) : content;
    const subject = encodeURIComponent(report.title);
    const body = encodeURIComponent(plainText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <>
      {/* Modal Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal Content */}
        <div
          className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-ferty-rose to-ferty-coral p-6 text-white flex items-center justify-between print:hidden">
            <div>
              <h2 className="text-xl font-bold">{report.title}</h2>
              <p className="text-sm text-white/80 mt-1">
                {new Date(report.created_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Cerrar"
            >
              <X size={24} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="bg-ferty-beigeLight border-b border-ferty-beige p-4 flex gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-ferty-beige rounded-xl hover:bg-ferty-beige transition-colors text-sm font-bold text-ferty-dark"
            >
              <Printer size={16} />
              Imprimir
            </button>
            <button
              onClick={handleEmail}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-ferty-beige rounded-xl hover:bg-ferty-beige transition-colors text-sm font-bold text-ferty-dark"
            >
              <Mail size={16} />
              Enviar por correo
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="prose prose-sm max-w-none">
              {isMarkdown ? (
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-2xl font-bold text-ferty-dark mb-4 mt-6 first:mt-0">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-xl font-bold text-ferty-dark mb-3 mt-5">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-lg font-bold text-ferty-dark mb-2 mt-4">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm text-ferty-gray leading-relaxed mb-3">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-3 space-y-1 text-sm text-ferty-gray">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-3 space-y-1 text-sm text-ferty-gray">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="ml-2">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-bold text-ferty-dark">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-ferty-coral">{children}</em>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              ) : (
                <div className="text-sm text-ferty-gray leading-relaxed whitespace-pre-wrap">
                  {content}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 2cm;
            size: A4;
          }
          
          body * {
            visibility: hidden;
          }
          
          .bg-white,
          .bg-white * {
            visibility: visible;
          }
          
          .bg-white {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            box-shadow: none;
            border: none;
            padding: 0;
            margin: 0;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .prose {
            max-width: 100%;
            color: #000;
          }
          
          h1, h2, h3 {
            page-break-after: avoid;
            color: #000;
          }
          
          p, li {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
};

