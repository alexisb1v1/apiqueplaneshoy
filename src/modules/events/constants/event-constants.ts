export interface EventCategory {
  id: string;
  label: string;
  icon: string;
  badgeStyle: string;
}

export interface AgeRestriction {
  id: string;
  label: string;
  icon: string;
}

export interface EventCity {
  id: string;
  name: string;
  departmentCode: string;
}

export const EVENT_CATEGORIES: EventCategory[] = [
  { id: 'CONCERTS', label: 'Conciertos', icon: '🎵', badgeStyle: 'bg-purple-100 text-purple-700' },
  { id: 'THEATER', label: 'Teatro & Musicales', icon: '🎭', badgeStyle: 'bg-orange-100 text-orange-700' },
  { id: 'SPORTS', label: 'Deportes', icon: '⚽', badgeStyle: 'bg-blue-100 text-blue-700' },
  { id: 'FESTIVALS', label: 'Festivales', icon: '🎪', badgeStyle: 'bg-pink-100 text-pink-700' },
  { id: 'COMEDY', label: 'Comedia & Stand Up', icon: '🎤', badgeStyle: 'bg-yellow-100 text-yellow-700' },
  { id: 'GASTRONOMY', label: 'Gastronomía', icon: '🍔', badgeStyle: 'bg-green-100 text-green-700' },
];

export const EVENT_CITIES: EventCity[] = [
  { id: 'LIMA', name: 'Lima', departmentCode: '15' },
  { id: 'PUCALLPA', name: 'Pucallpa', departmentCode: '25' },
  { id: 'AREQUIPA', name: 'Arequipa', departmentCode: '04' },
  { id: 'CUSCO', name: 'Cusco', departmentCode: '08' },
  { id: 'TRUJILLO', name: 'Trujillo', departmentCode: '13' },
  { id: 'CHICLAYO', name: 'Chiclayo', departmentCode: '14' },
  { id: 'PIURA', name: 'Piura', departmentCode: '20' },
  { id: 'IQUITOS', name: 'Iquitos', departmentCode: '16' },
  { id: 'HUANCAYO', name: 'Huancayo', departmentCode: '12' },
  { id: 'TARAPOTO', name: 'Tarapoto', departmentCode: '22' },
];

export const PERU_DEPARTMENTS: Record<string, string> = {
  '01': 'Amazonas',
  '02': 'Áncash',
  '03': 'Apurímac',
  '04': 'Arequipa',
  '05': 'Ayacucho',
  '06': 'Cajamarca',
  '07': 'Callao',
  '08': 'Cusco',
  '09': 'Huancavelica',
  '10': 'Huánuco',
  '11': 'Ica',
  '12': 'Huancayo',
  '13': 'Trujillo',
  '14': 'Chiclayo',
  '15': 'Lima',
  '16': 'Iquitos',
  '17': 'Madre de Dios',
  '18': 'Moquegua',
  '19': 'Pasco',
  '20': 'Piura',
  '21': 'Puno',
  '22': 'Tarapoto',
  '23': 'Tacna',
  '24': 'Tumbes',
  '25': 'Pucallpa',
};

export const AGE_RESTRICTIONS: AgeRestriction[] = [
  { id: 'ALL_AGES', label: 'Para toda la familia', icon: '👨👩👧👦' },
  { id: 'PLUS_14', label: '+14 Años', icon: '⚠️' },
  { id: 'PLUS_18', label: 'Solo Mayores de 18', icon: '🔞' },
];

export const getCategoryById = (id: string): EventCategory =>
  EVENT_CATEGORIES.find((category) => category.id === id) || EVENT_CATEGORIES[0];

export const getAgeRestrictionById = (id: string): AgeRestriction =>
  AGE_RESTRICTIONS.find((item) => item.id === id) || AGE_RESTRICTIONS[0];

export const resolveCityFromUbigeo = (
  ubigeoCode?: string | null,
): { id: string; name: string; departmentCode: string } => {
  if (!ubigeoCode || ubigeoCode.length < 2) {
    return { id: 'LIMA', name: 'Lima', departmentCode: '15' };
  }
  const depCode = ubigeoCode.substring(0, 2);
  const foundKnownCity = EVENT_CITIES.find((c) => c.departmentCode === depCode);
  if (foundKnownCity) {
    return foundKnownCity;
  }
  const depName = PERU_DEPARTMENTS[depCode] || 'Lima';
  return {
    id: depName.toUpperCase().replace(/\s+/g, '_'),
    name: depName,
    departmentCode: depCode,
  };
};

