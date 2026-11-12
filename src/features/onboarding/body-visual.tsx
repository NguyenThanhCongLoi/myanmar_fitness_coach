import type { FocusArea } from '@/shared/body-preferences';

/** Original vector diagrams. Highlighted areas indicate intent, not predicted body changes. */
export function BodyVisual({ area = 'full', variant = 'strong' }: { area?: FocusArea; variant?: string }) {
  const active = (a: FocusArea) => area === a || area === 'full';
  const waistLeft = area === 'waist' && (variant === 'slim' || variant === 'reduce') ? 72 : area === 'waist' && variant === 'fuller' ? 59 : 66;
  const hipLeft = area === 'glutes' && (variant === 'small' || variant === 'reduce') ? 63 : area === 'glutes' && (variant === 'fuller' || variant === 'build') ? 49 : 57;
  return <svg className={`body-visual body-${variant}`} viewBox={area === 'waist' ? '36 62 88 80' : area === 'glutes' ? '34 93 92 90' : '0 0 160 200'} fill="none" aria-hidden="true">
    <circle cx="80" cy="23" r="15" className="body-base"/>
    <path d={`M69 43Q80 47 91 43L93 49Q105 50 110 63L122 104Q125 113 118 115Q112 117 109 107L99 78Q97 96 ${160 - waistLeft} 109Q${160 - hipLeft} 126 ${160 - hipLeft} 138L100 182Q99 191 92 191Q85 191 85 183L81 143L79 143L75 183Q75 191 68 191Q61 191 60 182L${hipLeft} 138Q${hipLeft} 126 ${waistLeft} 109Q63 96 61 78L51 107Q48 117 42 115Q35 113 38 104L50 63Q55 50 67 49Z`} className="body-base"/>
    {active('upper') && <path d="M65 53Q80 59 95 53L95 78Q80 85 65 78Z" className="body-highlight"/>}
    {active('waist') && <><path d={`M68 84Q80 89 92 84L${158 - waistLeft} 107Q80 115 ${waistLeft + 2} 107Z`} className="body-highlight"/>{variant === 'strong' && <path d="M80 88V108M71 95H89M71 102H89" className="body-detail"/>}{variant === 'reduce' && <path d="M43 94H60M55 89L60 94L55 99M117 94H100M105 89L100 94L105 99" className="body-arrow"/>}</>}
    {active('glutes') && <><path d={`M66 113Q80 119 94 113L${158 - hipLeft} 133Q89 148 80 136Q71 148 ${hipLeft + 2} 133Z`} className="body-highlight"/><path d="M80 119V134" className="body-detail"/>{variant === 'build' && <path d="M43 125L50 118M43 125L50 132M117 125L110 118M117 125L110 132" className="body-arrow"/>}</>}
    {active('legs') && <path d="M62 143L75 145L72 177L64 177ZM85 145L98 143L96 177L88 177Z" className="body-highlight"/>}
  </svg>;
}
