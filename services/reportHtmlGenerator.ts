import type { AppNotification } from '../types';
import { BRAND_ASSETS } from '../constants';

type UserProfileSummary = {
  id?: string;
  nombre?: string;
  email?: string | null;
  birthDate?: string | null;
  age?: number;
  weight?: number;
  height?: number;
  mainObjective?: string | null;
  partnerStatus?: string | null;
  methodStartDate?: string | null;
};

type MedicalSummary = {
  edad: number;
  imc: {
    valor: string;
    categoria: string;
  };
  pesoActual: number;
  pesoIdeal: {
    minimo: number;
    maximo: number;
  };
  diaDelCiclo: number;
  cycleLengthUsado: number;
  usandoValorPorDefecto: boolean;
  diaOvulacion: number;
  ventanaFertil: {
    inicio: number;
    fin: number;
    diasFertiles: number;
  };
  fechaProximaMenstruacion: string;
  fechaInicioCicloActual: string;
  diasHastaOvulacion: number;
  diasHastaProximaRegla: number;
  probabilidadEmbarazoHoy: number;
  promedios: {
    sueno: string;
    estres: string;
    agua: number;
    vegetales: number;
    diasConAlcohol: number;
  };
  analisisEdad: {
    categoria: string;
    probabilidad: string;
    mensaje: string;
  };
};

type ReportHtmlOptions = {
  report: AppNotification;
};
type CycleInfo = {
  last_period_date?: string;
  next_period_date?: string;
  days_until_next_period?: number | null;
};

type FertyScoreSummary = {
  total: number | null;
  function: number | null;
  food: number | null;
  flora: number | null;
  flow: number | null;
  calculated_at: string;
};

function maskEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;

  const maskedLocal =
    local.length > 2 ? `${local.substring(0, 2)}***` : `${local.charAt(0)}***`;

  const [domainName, ...tldParts] = domain.split('.');
  const maskedDomain =
    domainName.length > 2 ? `${domainName.substring(0, 2)}***` : `${domainName.charAt(0)}***`;

  const tld = tldParts.join('.');
  return `${maskedLocal}@${maskedDomain}${tld ? `.${tld}` : ''}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Conversión sencilla de Markdown a HTML para el cuerpo del informe IA.
 * No pretende cubrir todo el estándar, solo lo que usamos en los prompts.
 */
function markdownBodyToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const htmlLines: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (inList && listType) {
        htmlLines.push(`</${listType}>`);
        inList = false;
        listType = null;
      }
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      if (inList && listType) {
        htmlLines.push(`</${listType}>`);
        inList = false;
        listType = null;
      }
      const text = escapeHtml(line.substring(4));
      htmlLines.push(
        `<h3 style="font-size:16px;font-weight:600;color:#1f2933;margin:18px 0 10px;">${text}</h3>`
      );
      continue;
    }

    if (line.startsWith('## ')) {
      if (inList && listType) {
        htmlLines.push(`</${listType}>`);
        inList = false;
        listType = null;
      }
      const text = escapeHtml(line.substring(3));
      htmlLines.push(
        `<h2 style="font-size:18px;font-weight:700;color:#121926;margin:22px 0 12px;">${text}</h2>`
      );
      continue;
    }

    if (line.startsWith('# ')) {
      if (inList && listType) {
        htmlLines.push(`</${listType}>`);
        inList = false;
        listType = null;
      }
      const text = escapeHtml(line.substring(2));
      htmlLines.push(
        `<h1 style="font-size:22px;font-weight:800;color:#c53030;margin:24px 0 14px;">${text}</h1>`
      );
      continue;
    }

    // Listas numeradas
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList && listType) {
          htmlLines.push(`</${listType}>`);
        }
        htmlLines.push(
          '<ol style="margin-left:20px;margin-bottom:16px;padding-left:18px;color:#4b5563;font-size:13px;">'
        );
        inList = true;
        listType = 'ol';
      }
      let itemText = numberedMatch[1];
      itemText = escapeHtml(itemText)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      htmlLines.push(`<li style="margin-bottom:6px;">${itemText}</li>`);
      continue;
    }

    // Listas con viñetas
    const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList && listType) {
          htmlLines.push(`</${listType}>`);
        }
        htmlLines.push(
          '<ul style="margin-left:20px;margin-bottom:16px;padding-left:18px;color:#4b5563;font-size:13px;">'
        );
        inList = true;
        listType = 'ul';
      }
      let itemText = bulletMatch[1];
      itemText = escapeHtml(itemText)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      htmlLines.push(`<li style="margin-bottom:6px;">${itemText}</li>`);
      continue;
    }

    // Párrafo normal
    if (inList && listType) {
      htmlLines.push(`</${listType}>`);
      inList = false;
      listType = null;
    }

    let paraText = escapeHtml(line)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
    htmlLines.push(
      `<p style="margin-bottom:10px;color:#4b5563;font-size:13px;line-height:1.6;">${paraText}</p>`
    );
  }

  if (inList && listType) {
    htmlLines.push(`</${listType}>`);
  }

  return htmlLines.join('\n');
}

function renderPatientSection(user: UserProfileSummary | undefined, report: AppNotification): string {
  const maskedEmail = maskEmail(user?.email || undefined);
  const fechaNacimiento = user?.birthDate || '—';
  const edad = user?.age ?? '—';
  const peso = user?.weight != null ? `${user.weight} kg` : '—';
  const altura = user?.height != null ? `${user.height} cm` : '—';
  const objetivo = user?.mainObjective || '—';
  const pareja = user?.partnerStatus || '—';
  const metodoInicio = user?.methodStartDate || '—';

  return `
  <section style="margin-top:24px;">
    <h2 style="font-size:16px;font-weight:700;color:#121926;margin:0 0 10px;">1. Datos de la paciente</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
      <tbody>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fdf3f0;width:35%;font-weight:600;">Nombre</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(
            user?.nombre || report.title.replace('Informe', 'Paciente')
          )}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fdf3f0;font-weight:600;">Email</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${
            maskedEmail ? escapeHtml(maskedEmail) : '—'
          }</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fdf3f0;font-weight:600;">Fecha de nacimiento</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(fechaNacimiento)}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fdf3f0;font-weight:600;">Edad</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${edad}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fdf3f0;font-weight:600;">Peso / Altura</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${peso} · ${altura}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fdf3f0;font-weight:600;">Objetivo principal</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(objetivo)}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fdf3f0;font-weight:600;">Situación de pareja</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(pareja)}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#fdf3f0;font-weight:600;">Inicio método FertyFit</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(metodoInicio)}</td>
        </tr>
      </tbody>
    </table>
  </section>
  `;
}

function renderMedicalSummarySection(summary: MedicalSummary | undefined): string {
  if (!summary) return '';

  return `
  <section style="margin-top:24px;">
    <h2 style="font-size:16px;font-weight:700;color:#121926;margin:0 0 10px;">2. Datos calculados FertyFit</h2>

    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:10px;">
      <div style="flex:1 1 160px;background:#fff;border:1px solid #fde2dd;border-radius:12px;padding:10px 12px;">
        <div style="font-size:11px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">IMC</div>
        <div style="font-size:18px;font-weight:700;color:#c53030;">${summary.imc.valor}</div>
        <div style="font-size:11px;color:#4b5563;">${escapeHtml(summary.imc.categoria)}</div>
      </div>
      <div style="flex:1 1 160px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;">
        <div style="font-size:11px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Peso ideal</div>
        <div style="font-size:13px;font-weight:600;color:#374151;">${summary.pesoIdeal.minimo}–${
          summary.pesoIdeal.maximo
        } kg</div>
      </div>
      <div style="flex:1 1 160px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;">
        <div style="font-size:11px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Probabilidad embarazo hoy</div>
        <div style="font-size:18px;font-weight:700;color:#0f766e;">${summary.probabilidadEmbarazoHoy}%</div>
      </div>
    </div>

    <h3 style="font-size:14px;font-weight:600;color:#374151;margin:16px 0 6px;">Ciclo menstrual</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;margin-bottom:10px;">
      <tbody>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;width:40%;">Día actual del ciclo</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">Día ${summary.diaDelCiclo}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;">Duración del ciclo${
            summary.usandoValorPorDefecto ? ' (estimada)' : ''
          }</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${summary.cycleLengthUsado} días</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;">Ventana fértil estimada</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">
            Días ${summary.ventanaFertil.inicio}–${summary.ventanaFertil.fin} del ciclo
          </td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;">Día estimado de ovulación</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">Día ${summary.diaOvulacion}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;">Fecha próxima regla (aprox.)</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(
            summary.fechaProximaMenstruacion
          )} (${summary.diasHastaProximaRegla} días)</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size:14px;font-weight:600;color:#374151;margin:16px 0 6px;">Hábitos (últimos 7 días)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
      <tbody>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;width:40%;">Sueño promedio</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${summary.promedios.sueno} h/noche</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;">Estrés promedio</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${summary.promedios.estres} / 5</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;">Agua</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${
            summary.promedios.agua
          } vasos/día (promedio)</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;">Vegetales</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${
            summary.promedios.vegetales
          } raciones/día (promedio)</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;">Días con alcohol</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${
            summary.promedios.diasConAlcohol
          } de los últimos 7 días</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size:14px;font-weight:600;color:#374151;margin:16px 0 6px;">Edad y fertilidad</h3>
    <p style="margin:0 0 4px;font-size:13px;color:#111827;">
      <strong>Categoría:</strong> ${escapeHtml(summary.analisisEdad.categoria)}
    </p>
    <p style="margin:0 0 4px;font-size:13px;color:#111827;">
      <strong>Probabilidad por ciclo:</strong> ${escapeHtml(summary.analisisEdad.probabilidad)}
    </p>
    <p style="margin:0 0 0;font-size:12px;color:#4b5563;">
      ${escapeHtml(summary.analisisEdad.mensaje)}
    </p>
  </section>
  `;
}

function renderCycleSection(
  reportType: string | undefined,
  cycleInfo: CycleInfo | undefined
): string {
  if (reportType !== 'BASIC' && reportType !== '360') return '';

  // Sin datos de ciclo: mostrar mensaje orientativo
  if (!cycleInfo || !cycleInfo.last_period_date || !cycleInfo.next_period_date) {
    return `
    <section style="margin-top:20px;">
      <h2 style="font-size:16px;font-weight:700;color:#121926;margin:0 0 8px;">Datos de ciclo</h2>
      <p style="font-size:13px;color:#4b5563;line-height:1.6;margin:0;">
        Aún no tenemos registrada tu última regla ni la duración de tu ciclo de forma completa.
        Para poder estimar tus fechas clave (ventana fértil y próxima menstruación), te recomendamos:
      </p>
      <ul style="margin:8px 0 0 18px;padding:0;font-size:13px;color:#4b5563;">
        <li>Registrar tu próxima menstruación en tus <strong>registros diarios</strong>.</li>
        <li>Completar los datos de ciclo en tu perfil (formulario F0 o sección de ciclo).</li>
      </ul>
    </section>
    `;
  }

  const lastDate = new Date(cycleInfo.last_period_date);
  const nextDate = new Date(cycleInfo.next_period_date);

  const lastFormatted = lastDate.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
  const nextFormatted = nextDate.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });

  const daysUntil =
    typeof cycleInfo.days_until_next_period === 'number'
      ? `${cycleInfo.days_until_next_period} día${
          cycleInfo.days_until_next_period === 1 ? '' : 's'
        }`
      : '—';

  return `
  <section style="margin-top:20px;">
    <h2 style="font-size:16px;font-weight:700;color:#121926;margin:0 0 8px;">Datos de ciclo</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
      <tbody>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;width:40%;">Fecha última regla</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${lastFormatted}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;">Fecha próxima regla (aprox.)</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${nextFormatted}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb;">Días hasta próxima regla</td>
          <td style="padding:6px 8px;border:1px solid #e5e7eb;">${daysUntil}</td>
        </tr>
      </tbody>
    </table>
  </section>
  `;
}

function renderFertyScoreSection(
  reportType: string | undefined,
  fertyScore: FertyScoreSummary | undefined
): string {
  // Por ahora mostramos el resumen FertyScore solo en BASIC (portada de preconsulta)
  if (reportType !== 'BASIC') return '';
  if (!fertyScore || fertyScore.total == null) {
    return '';
  }

  const dateText = fertyScore.calculated_at
    ? new Date(fertyScore.calculated_at).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const formatScore = (v: number | null) => (typeof v === 'number' ? `${v}` : '—');

  return `
  <section style="margin-top:20px;">
    <h2 style="font-size:16px;font-weight:700;color:#121926;margin:0 0 10px;">Resumen FertyScore</h2>
    <p style="font-size:12px;color:#4b5563;margin:0 0 10px;">
      El FertyScore resume de forma global cómo se encuentran tus cuatro pilares de fertilidad
      (Function, Food, Flora y Flow) en el momento del cálculo${dateText ? ` (${dateText})` : ''}.
    </p>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:10px;">
      <div style="flex:1 1 180px;background:#fff7f7;border:1px solid #fecaca;border-radius:12px;padding:12px 14px;">
        <div style="font-size:11px;text-transform:uppercase;color:#b91c1c;margin-bottom:4px;">FertyScore global</div>
        <div style="font-size:22px;font-weight:800;color:#b91c1c;">${formatScore(fertyScore.total)}</div>
        <div style="font-size:11px;color:#7f1d1d;margin-top:4px;">
          Cuanto más alto, más alineados están tus hábitos y tu salud general con la fertilidad.
        </div>
      </div>
      <div style="flex:1 1 140px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;">
        <div style="font-size:11px;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">Function</div>
        <div style="font-size:18px;font-weight:700;color:#111827;">${formatScore(
          fertyScore.function
        )}</div>
        <div style="font-size:11px;color:#4b5563;margin-top:2px;">
          Función reproductiva: ciclo, ovulación y salud hormonal.
        </div>
      </div>
      <div style="flex:1 1 140px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;">
        <div style="font-size:11px;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">Food</div>
        <div style="font-size:18px;font-weight:700;color:#111827;">${formatScore(
          fertyScore.food
        )}</div>
        <div style="font-size:11px;color:#4b5563;margin-top:2px;">
          Alimentación pro-fértil: calidad de la dieta y micronutrientes.
        </div>
      </div>
      <div style="flex:1 1 140px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;">
        <div style="font-size:11px;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">Flora</div>
        <div style="font-size:18px;font-weight:700;color:#111827;">${formatScore(
          fertyScore.flora
        )}</div>
        <div style="font-size:11px;color:#4b5563;margin-top:2px;">
          Microbiota y salud digestiva, base de la inflamación y absorción de nutrientes.
        </div>
      </div>
      <div style="flex:1 1 140px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;">
        <div style="font-size:11px;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">Flow</div>
        <div style="font-size:18px;font-weight:700;color:#111827;">${formatScore(
          fertyScore.flow
        )}</div>
        <div style="font-size:11px;color:#4b5563;margin-top:2px;">
          Estilo de vida: sueño, estrés, movimiento y equilibrio mente-cuerpo.
        </div>
      </div>
    </div>
  </section>
  `;
}

function renderFooterSection(): string {
  return `
  <section style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">
    <h2 style="font-size:14px;font-weight:700;color:#111827;margin:0 0 10px;">Firma y declaración de la paciente</h2>
    <p style="font-size:12px;color:#374151;margin:0 0 16px;line-height:1.6;">
      <strong>La persona que firma este informe asume la veracidad de los datos aportados y el uso responsable del contenido.</strong>
    </p>
    <p style="font-size:12px;color:#4b5563;margin:0 0 16px;line-height:1.6;">
      Este documento puede compartirse con profesionales de la salud como apoyo en la consulta, pero no sustituye la historia clínica oficial ni el juicio de un médico especialista.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:12px;color:#374151;margin-bottom:18px;">
      <tbody>
        <tr>
          <td style="padding:10px 8px;width:60%;">
            Firma de la paciente:<br/>
            <div style="margin-top:18px;border-bottom:1px solid #9ca3af;height:1px;width:100%;"></div>
          </td>
          <td style="padding:10px 8px;width:40%;">
            Fecha:<br/>
            <div style="margin-top:18px;border-bottom:1px solid #9ca3af;height:1px;width:80%;"></div>
          </td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:11px;color:#6b7280;margin:0;line-height:1.6;">
      Este informe ha sido generado por la plataforma FertyFit con fines informativos y educativos. No constituye un diagnóstico médico, ni una indicación terapéutica, ni reemplaza la evaluación individual realizada por un profesional sanitario. Para cualquier decisión relacionada con tu salud reproductiva debes consultar siempre con tu ginecólogo/a o especialista en fertilidad.
    </p>
  </section>
  `;
}

export function generateStructuredReportHtml({ report }: ReportHtmlOptions): string {
  const metadata: any = report.metadata || {};
  const reportType: string | undefined = metadata.report_type;
  const userProfileSummary: UserProfileSummary | undefined = metadata.user_profile_summary;
  const medicalSummary: MedicalSummary | undefined = metadata.medical_summary;
  const cycleInfo: CycleInfo | undefined = metadata.cycle_info;
  const fertyScore: FertyScoreSummary | undefined = metadata.fertyscore;

  const createdDate = new Date(report.created_at).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const bodyContent = markdownBodyToHtml(report.message || '');

  const patientSection = renderPatientSection(userProfileSummary, report);
  const medicalSection =
    reportType === 'BASIC' || reportType === '360'
      ? renderMedicalSummarySection(medicalSummary)
      : '';
  const cycleSection = renderCycleSection(reportType, cycleInfo);
   const fertyScoreSection = renderFertyScoreSection(reportType, fertyScore);

  const footerSection = renderFooterSection();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(report.title)}</title>
</head>
<body style="margin:0;padding:24px;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827;">
  <div style="max-width:780px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px 28px;border:1px solid #f2e7e3;box-shadow:0 14px 35px rgba(148,27,74,0.08);">
    <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #fde2dd;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:34px;height:34px;border-radius:999px;background:linear-gradient(135deg,#fb7185,#f97373);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;letter-spacing:0.03em;">
          F
        </div>
        <div>
          <div style="font-size:14px;font-weight:800;color:#111827;letter-spacing:0.06em;text-transform:uppercase;">FERTYFIT</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">Método integral de fertilidad</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;font-weight:700;color:#c53030;">${escapeHtml(report.title)}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px;">${createdDate}</div>
        ${
          reportType
            ? `<div style="margin-top:4px;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Informe ${
                reportType === 'BASIC'
                  ? 'Básico'
                  : reportType === '360'
                  ? '360º'
                  : reportType.toUpperCase()
              }</div>`
            : ''
        }
      </div>
    </header>

    ${patientSection}
    ${fertyScoreSection}
    ${reportType === '360' ? medicalSection : ''}
    ${cycleSection}

    <section style="margin-top:28px;">
      <h2 style="font-size:16px;font-weight:700;color:#121926;margin:0 0 10px;">${
        reportType === 'BASIC' ? 'Análisis según metodología FertyFit' : 'Informe narrativo completo'
      }</h2>
      <div style="font-size:13px;color:#374151;line-height:1.7;">
        ${bodyContent}
      </div>
    </section>

    ${footerSection}
  </div>
</body>
</html>`;
}

