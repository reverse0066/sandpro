/**
 * Default preset signatures as transparent SVG Data URLs
 */

export interface PresetSignatureItem {
  id: string;
  name: string;
  image: string;
}

const svgToDataUrl = (svgString: string) => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};

const PRESET_1_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120" width="300" height="120">
  <path d="M 30 70 C 50 30, 80 20, 100 60 C 120 100, 140 20, 170 50 C 190 70, 210 30, 240 60 C 260 80, 280 40, 270 75 C 250 110, 180 90, 110 85 C 80 82, 40 85, 20 80" stroke="#1e293b" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 60 45 Q 110 25, 160 35 T 230 40" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M 120 75 Q 150 95, 220 85" stroke="#1e293b" stroke-width="2" fill="none" opacity="0.8"/>
  <circle cx="265" cy="40" r="2.5" fill="#1e293b"/>
</svg>`;

const PRESET_2_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120" width="300" height="120">
  <path d="M 25 80 C 45 20, 75 15, 85 55 C 95 95, 125 35, 145 65 C 165 95, 185 45, 205 75 C 225 105, 255 55, 275 65" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 40 90 L 260 80" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M 70 30 C 130 10, 200 15, 250 25" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>`;

const PRESET_3_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120" width="300" height="120">
  <path d="M 40 65 Q 70 20, 110 50 T 180 40 T 240 60 C 260 70, 275 50, 260 85 C 240 115, 150 100, 90 95 L 280 85" stroke="#1e40af" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="230" cy="35" r="3" fill="#1e40af"/>
</svg>`;

export const DEFAULT_PRESET_SIGNATURES: PresetSignatureItem[] = [
  {
    id: 'preset_executive',
    name: 'توقيع رسمي (أنيق)',
    image: svgToDataUrl(PRESET_1_SVG),
  },
  {
    id: 'preset_manager',
    name: 'توقيع المدير (كلاسيكي)',
    image: svgToDataUrl(PRESET_2_SVG),
  },
  {
    id: 'preset_accountant',
    name: 'توقيع سريع (أزرق)',
    image: svgToDataUrl(PRESET_3_SVG),
  },
];
