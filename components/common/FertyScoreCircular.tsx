import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface FertyScoreCircularProps {
  totalScore: number;
  functionScore: number;
  foodScore: number;
  floraScore: number;
  flowScore: number;
  size?: number;
}

interface PillarData {
  name: string;
  score: number;
  label: string;
  gradient: { start: string; end: string };
}

const FertyScoreCircular = ({
  totalScore,
  functionScore,
  foodScore,
  floraScore,
  flowScore,
  size = 320 // Aumentado de 280 a 320
}: FertyScoreCircularProps) => {
  const [hoveredPillar, setHoveredPillar] = useState<string | null>(null);

  const center = size / 2;
  const radius = size / 2 - 25; // Más cerca del centro
  const innerRadius = size / 2 - 75; // Más integrado

  // Configuración de cada pilar con colores del sistema FertyFit
  // Nota: Los colores se mantienen como hex para uso en SVG gradients
  // pero corresponden a los colores definidos en tailwind.config.js
  const pillars: PillarData[] = [
    {
      name: 'function',
      score: functionScore,
      label: 'Function',
      gradient: { start: '#E8B4B8', end: '#D4A5A9' } // ferty.function.light y dark
    },
    {
      name: 'food',
      score: foodScore,
      label: 'Food',
      gradient: { start: '#A8C8E0', end: '#8BB0D1' } // ferty.food.light y dark
    },
    {
      name: 'flora',
      score: floraScore,
      label: 'Flora',
      gradient: { start: '#B8D4C8', end: '#9ECCB4' } // ferty.flora.light y dark
    },
    {
      name: 'flow',
      score: flowScore,
      label: 'Flow',
      gradient: { start: '#E5D4E8', end: '#D8C4E0' } // ferty.flow.light y dark
    }
  ];

  // Función para obtener la flecha y color según el score (regla: -50 rojo, +50 verde)
  const getArrowIndicator = (score: number) => {
    const diff = score - 50; // Diferencia respecto a 50 (mitad)
    if (diff < 0) {
      return { 
        icon: 'down' as const, 
        color: '#EF4444' // Rojo si está por debajo de 50
      };
    } else {
      return { 
        icon: 'up' as const, 
        color: '#10B981' // Verde si está por encima de 50
      };
    }
  };

  // Convertir coordenadas polares a cartesianas
  const polarToCartesian = (
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number
  ) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  // Función para crear un arco SVG
  const createArc = (
    startAngle: number,
    endAngle: number,
    innerR: number,
    outerR: number
  ): string => {
    const start = polarToCartesian(center, center, outerR, endAngle);
    const end = polarToCartesian(center, center, outerR, startAngle);
    const innerStart = polarToCartesian(center, center, innerR, endAngle);
    const innerEnd = polarToCartesian(center, center, innerR, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M', start.x, start.y,
      'A', outerR, outerR, 0, largeArcFlag, 0, end.x, end.y,
      'L', innerEnd.x, innerEnd.y,
      'A', innerR, innerR, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
      'Z'
    ].join(' ');
  };

  // Calcular los ángulos para completar 360 grados proporcionalmente
  // Cada pilar ocupa una fracción del círculo completo según su score
  const totalScoreSum = pillars.reduce((sum, p) => sum + Math.max(0, p.score), 0);
  const normalizedScores = totalScoreSum > 0 
    ? pillars.map(p => Math.max(0, p.score) / totalScoreSum)
    : pillars.map(() => 0.25); // Si todos son 0, distribuir equitativamente

  let currentAngle = 0;
  
  const arcs = pillars.map((pillar, index) => {
    // Calcular cuántos grados ocupa este pilar proporcionalmente
    const angleForPillar = normalizedScores[index] * 360;
    
    // Mínimo de 10 grados para que se vea
    const actualAngle = Math.max(10, angleForPillar);
    
    const startAngle = currentAngle;
    const endAngle = startAngle + actualAngle;
    
    currentAngle = endAngle;
    
    const path = createArc(startAngle, endAngle, innerRadius, radius);
    
    return {
      ...pillar,
      path,
      startAngle,
      endAngle
    };
  });

  return (
    <div className="relative flex flex-col items-center">
      <h3 className="font-bold text-ferty-dark text-lg mb-6">Tu FertyScore</h3>
      
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 transition-transform duration-300"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(199, 149, 142, 0.15))' }}
        >
          <defs>
            {/* Gradientes para cada pilar */}
            {arcs.map((pillar) => {
              const midAngle = (pillar.startAngle + pillar.endAngle) / 2;
              const midAngleRad = ((midAngle - 90) * Math.PI) / 180;
              const gradientX = center + (size / 5) * Math.cos(midAngleRad);
              const gradientY = center + (size / 5) * Math.sin(midAngleRad);
              
              return (
                <radialGradient
                  key={`gradient-${pillar.name}`}
                  id={`gradient-${pillar.name}`}
                  cx={`${(gradientX / size) * 100}%`}
                  cy={`${(gradientY / size) * 100}%`}
                  r="75%"
                >
                  <stop offset="0%" stopColor={pillar.gradient.start} stopOpacity="1" />
                  <stop offset="100%" stopColor={pillar.gradient.end} stopOpacity="0.9" />
                </radialGradient>
              );
            })}
            
            {/* Filtros para efectos de superposición */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.15"/>
            </filter>
          </defs>

          {/* Capas superpuestas para efecto de profundidad */}
          {arcs.map((arc) => {
            const isHovered = hoveredPillar === arc.name;
            const opacity = hoveredPillar && !isHovered ? 0.3 : 0.4;
            
            const overlayRadius = radius + 8;
            const overlayInnerRadius = innerRadius - 8;
            const overlayPath = createArc(arc.startAngle, arc.endAngle, overlayInnerRadius, overlayRadius);
            
            return (
              <path
                key={`overlay-${arc.name}`}
                d={overlayPath}
                fill={`url(#gradient-${arc.name})`}
                opacity={opacity}
                style={{
                  mixBlendMode: 'multiply'
                }}
              />
            );
          })}

          {/* Capa principal de segmentos */}
          {arcs.map((arc) => {
            const isHovered = hoveredPillar === arc.name;
            const opacity = hoveredPillar && !isHovered ? 0.4 : 1;

            return (
              <g key={arc.name}>
                <path
                  d={arc.path}
                  fill={`url(#gradient-${arc.name})`}
                  opacity={opacity}
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    filter: isHovered
                      ? 'drop-shadow(0 0 12px rgba(199, 149, 142, 0.6)) brightness(1.15) url(#glow)'
                      : 'url(#shadow)',
                    transformOrigin: `${center}px ${center}px`,
                    zIndex: isHovered ? 10 : 1
                  }}
                  onMouseEnter={() => setHoveredPillar(arc.name)}
                  onMouseLeave={() => setHoveredPillar(null)}
                />
                
                {/* Borde sutil para separación */}
                <path
                  d={arc.path}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth="2"
                  opacity={opacity}
                />
              </g>
            );
          })}
        </svg>

        {/* Centro del círculo con el FertyScore en rosa apagado */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            {/* Círculo blanco de fondo para efecto superpuesto */}
            <div 
              className="absolute inset-0 bg-white rounded-full border-4 border-white"
              style={{
                width: size / 2.5,
                height: size / 2.5,
                transform: 'translate(-50%, -50%) scale(1.15)',
                left: '50%',
                top: '50%',
                filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))',
                zIndex: 5
              }}
            ></div>
            
            {/* Círculo principal con gradiente rosa apagado */}
            <div
              className="relative text-white rounded-full flex items-center justify-center shadow-xl border-4 border-white transition-all duration-500"
              style={{
                width: size / 2.8,
                height: size / 2.8,
                background: 'linear-gradient(135deg, #E8B4B8 0%, #D4A5A9 100%)', // Rosa apagado
                boxShadow: '0 10px 30px rgba(232, 180, 184, 0.3)',
                animation: 'fertyScorePulse 2s ease-in-out infinite',
                zIndex: 6
              }}
            >
              <div className="text-center">
                <div className="text-4xl font-bold leading-none">{totalScore > 0 ? totalScore : '-'}</div>
                <div className="text-[8px] opacity-90 mt-1 uppercase tracking-wider font-medium">FertyScore</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Labels debajo del gráfico con los valores de cada pilar - más cerca */}
      <div className="mt-4 grid grid-cols-4 gap-2 w-full max-w-xs">
        {pillars.map((pillar) => {
          const arrowInfo = getArrowIndicator(pillar.score);
          return (
            <div
              key={pillar.name}
              className="text-center p-2 rounded-xl bg-ferty-beige/50 transition-all duration-200 hover:bg-ferty-beige cursor-pointer"
              onMouseEnter={() => setHoveredPillar(pillar.name)}
              onMouseLeave={() => setHoveredPillar(null)}
              style={{
                opacity: hoveredPillar && hoveredPillar !== pillar.name ? 0.5 : 1
              }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <div className="text-lg font-bold text-ferty-dark">
                  {pillar.score > 0 ? pillar.score : '-'}
                </div>
                {/* Flechita indicadora */}
                {arrowInfo.icon === 'up' ? (
                  <ChevronUp 
                    size={14} 
                    style={{ color: arrowInfo.color }}
                    className="flex-shrink-0"
                  />
                ) : (
                  <ChevronDown 
                    size={14} 
                    style={{ color: arrowInfo.color }}
                    className="flex-shrink-0"
                  />
                )}
              </div>
              <div className="text-[10px] text-ferty-coral font-bold uppercase mt-1">
                {pillar.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FertyScoreCircular;
