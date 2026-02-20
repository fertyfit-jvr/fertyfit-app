import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Printer, Mail, Download } from 'lucide-react';
import { AppNotification } from '../types';
import { generateStructuredReportHtml } from '../services/reportHtmlGenerator';

interface ReportViewerProps {
  report: AppNotification;
  onClose: () => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ report, onClose }) => {
  const isMarkdown = report.metadata?.format === 'markdown';
  const content = report.message;
  const hasStructuredMetadata =
    !!report.metadata?.user_profile_summary || !!report.metadata?.medical_summary;

  // Conversión legacy de Markdown a HTML (fallback cuando no hay metadata enriquecida)
  const convertMarkdownToHTMLLegacy = (markdown: string): string => {
    const lines = markdown.split('\n');
    const htmlLines: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        if (inList) {
          htmlLines.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        continue;
      }

      // Headers
      if (line.startsWith('### ')) {
        if (inList) {
          htmlLines.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        const text = line.substring(4);
        htmlLines.push(`<h3 style="font-size: 18px; font-weight: bold; color: #2d3748; margin-top: 20px; margin-bottom: 10px;">${text}</h3>`);
        continue;
      }

      if (line.startsWith('## ')) {
        if (inList) {
          htmlLines.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        const text = line.substring(3);
        htmlLines.push(`<h2 style="font-size: 20px; font-weight: bold; color: #1a202c; margin-top: 24px; margin-bottom: 12px;">${text}</h2>`);
        continue;
      }

      if (line.startsWith('# ')) {
        if (inList) {
          htmlLines.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        const text = line.substring(2);
        htmlLines.push(`<h1 style="font-size: 24px; font-weight: bold; color: #000; margin-top: 28px; margin-bottom: 16px;">${text}</h1>`);
        continue;
      }

      // Listas numeradas
      const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
      if (numberedMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) {
            htmlLines.push(`</${listType}>`);
          }
          htmlLines.push('<ol style="margin-left: 20px; margin-bottom: 16px; padding-left: 20px;">');
          inList = true;
          listType = 'ol';
        }
        let itemText = numberedMatch[1];
        itemText = itemText.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold;">$1</strong>');
        itemText = itemText.replace(/\*(.*?)\*/g, '<em style="font-style: italic;">$1</em>');
        htmlLines.push(`<li style="margin-bottom: 8px; color: #4a5568;">${itemText}</li>`);
        continue;
      }

      // Listas con viñetas
      const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) {
            htmlLines.push(`</${listType}>`);
          }
          htmlLines.push('<ul style="margin-left: 20px; margin-bottom: 16px; padding-left: 20px;">');
          inList = true;
          listType = 'ul';
        }
        let itemText = bulletMatch[1];
        itemText = itemText.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold;">$1</strong>');
        itemText = itemText.replace(/\*(.*?)\*/g, '<em style="font-style: italic;">$1</em>');
        htmlLines.push(`<li style="margin-bottom: 8px; color: #4a5568;">${itemText}</li>`);
        continue;
      }

      // Párrafo normal
      if (inList) {
        htmlLines.push(`</${listType}>`);
        inList = false;
        listType = null;
      }

      let paraText = line;
      paraText = paraText.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold; color: #2d3748;">$1</strong>');
      paraText = paraText.replace(/\*(.*?)\*/g, '<em style="font-style: italic; color: #c53030;">$1</em>');
      htmlLines.push(`<p style="margin-bottom: 12px; color: #4a5568; line-height: 1.6;">${paraText}</p>`);
    }

    // Cerrar lista si queda abierta
    if (inList && listType) {
      htmlLines.push(`</${listType}>`);
    }

    const htmlContent = htmlLines.join('\n');

    // Estructura HTML completa básica (se usará solo como respaldo)
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #2d3748; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <div style="background-color: #ffffff; padding: 24px; border-radius: 8px;">
    <h1 style="font-size: 22px; font-weight: bold; color: #c53030; margin-bottom: 16px; border-bottom: 2px solid #fed7d7; padding-bottom: 12px;">
      ${report.title}
    </h1>
    <p style="color: #718096; font-size: 12px; margin-bottom: 24px;">
      ${new Date(report.created_at).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}
    </p>
    <div style="color: #4a5568;">
      ${htmlContent}
    </div>
  </div>
</body>
</html>`;
  };

  /**
   * Genera el HTML listo para correo / PDF.
   * Si el informe tiene metadata enriquecida (perfil + resumen médico),
   * usamos el motor estructurado. Si no, usamos el conversor legacy.
   */
  const buildExportHtml = (): string => {
    if (hasStructuredMetadata) {
      return generateStructuredReportHtml({ report });
    }

    return convertMarkdownToHTMLLegacy(content);
  };

  // Convertir Markdown a texto plano (fallback)
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
    // La impresión ahora se maneja principalmente por CSS @media print
    window.print();
  };

  const handleDownloadDoc = () => {
    try {
      const htmlContent = buildExportHtml();

      // Creamos un Blob con el contenido HTML y el tipo MIME de MS Word
      // Usamos el BOM (\ufeff) para asegurar que Word detecte correctamente el mapa de caracteres (UTF-8)
      const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.title.replace(/[^a-zA-Z0-9-_]/g, '_') || 'informe-fertyfit'}.doc`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al exportar a Word:', err);
      alert('No se pudo generar el archivo Word.');
    }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(report.title);

    if (isMarkdown) {
      // Usar solo texto plano para que sea sencillo para la usuaria
      const plainText = convertMarkdownToPlainText(content);
      const body = encodeURIComponent(plainText);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } else {
      const body = encodeURIComponent(content);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
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
          <div className="bg-ferty-beigeLight border-b border-ferty-beige p-4 flex flex-wrap gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-ferty-beige rounded-xl hover:bg-ferty-beige transition-colors text-xs sm:text-sm font-bold text-ferty-dark shadow-sm"
              title="Permite imprimir o guardar como PDF"
            >
              <Printer size={16} />
              Imprimir / PDF
            </button>
            <button
              onClick={handleDownloadDoc}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-ferty-beige rounded-xl hover:bg-ferty-beige transition-colors text-xs sm:text-sm font-bold text-ferty-dark shadow-sm"
              title="Descarga el informe en formato Word"
            >
              <Download size={16} />
              Exportar a Word
            </button>
            <button
              onClick={handleEmail}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-ferty-beige rounded-xl hover:bg-ferty-beige transition-colors text-xs sm:text-sm font-bold text-ferty-dark shadow-sm"
            >
              <Mail size={16} />
              Enviar por correo
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="prose prose-sm max-w-none">
              {hasStructuredMetadata ? (
                <div
                  className="ff-report-html"
                  // Mostrar en pantalla el mismo HTML estructurado que se usa para PDF
                  dangerouslySetInnerHTML={{ __html: buildExportHtml() }}
                />
              ) : isMarkdown ? (
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
            margin: 1.5cm;
            size: A4;
          }
          
          /* Ocultar todo el body por defecto */
          body * {
            visibility: hidden !important;
          }
          
          /* Seleccionamos específicamente el contenedor del informe para mostrarlo */
          /* Suponemos que el modal con fondo blanco es .bg-white interior */
          .bg-white, .bg-white * {
            visibility: visible !important;
          }

          /* Reset de posicionamiento para impresión */
          .bg-white {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            max-width: none !important;
            overflow: visible !important;
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Ocultar elementos de UI */
          .print\\:hidden {
            display: none !important;
          }

          /* Forzar scroll visible en contenedores intermedios */
          div {
            overflow: visible !important;
            max-height: none !important;
          }

          /* Estilos de contenido */
          .prose {
            max-width: 100% !important;
            font-size: 12pt !important;
            line-height: 1.5 !important;
          }

          /* Evitar cortes feos */
          h1, h2, h3, h4 {
            page-break-after: avoid !important;
          }
          
          p, li {
            page-break-inside: avoid !important;
          }

          /* Colores precisos */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
};
