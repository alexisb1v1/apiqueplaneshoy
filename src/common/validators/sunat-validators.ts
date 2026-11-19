/**
 * Validador oficial del Registro Único de Contribuyentes (RUC) de 11 dígitos
 * según el algoritmo de SUNAT (Módulo 11 con pesos ponderados).
 *
 * Prefijos válidos: 10 (Persona natural con negocio), 15/17 (Extranjeros), 20 (Persona jurídica)
 * Factores de peso: [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
 */
export function isValidRuc(ruc: string | null | undefined): boolean {
  if (!ruc) return false;
  const cleanRuc = ruc.trim();

  // 1. Debe tener exactamente 11 dígitos numéricos
  if (!/^\d{11}$/.test(cleanRuc)) {
    return false;
  }

  // 2. Prefijos oficiales de SUNAT
  const validPrefixes = ['10', '15', '17', '20'];
  const prefix = cleanRuc.substring(0, 2);
  if (!validPrefixes.includes(prefix)) {
    return false;
  }

  // 3. Algoritmo Módulo 11 ponderado
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanRuc.charAt(i), 10) * weights[i];
  }

  const remainder = sum % 11;
  const difference = 11 - remainder;

  let checkDigit = difference;
  if (difference === 10) {
    checkDigit = 0;
  } else if (difference === 11) {
    checkDigit = 1;
  }

  const actualCheckDigit = parseInt(cleanRuc.charAt(10), 10);
  return checkDigit === actualCheckDigit;
}

/**
 * Validador básico de DNI peruano (8 dígitos numéricos)
 */
export function isValidDni(dni: string | null | undefined): boolean {
  if (!dni) return false;
  return /^\d{8}$/.test(dni.trim());
}
