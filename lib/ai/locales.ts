export const supportedLocales = [
  'es-AR',
  'es-UY',
  'es-MX',
  'es-CO',
  'es-CL',
  'es-419',
] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export function normalizeLocale(value?: string): SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale)
    ? (value as SupportedLocale)
    : 'es-419';
}

export function localeFallbacks(locale: SupportedLocale): SupportedLocale[] {
  if (locale === 'es-419') {
    return ['es-419', 'es-AR'];
  }

  return [locale, 'es-419', 'es-AR'];
}
