import type { SupportedLocale } from './locales';

const safetyRules = [
  'Respect an explicit or implicit rejection and never suggest repeated pursuit.',
  'Never use threats, humiliation, jealousy, deception, impersonation, or emotional pressure.',
  'Do not sexualize minors or help evade consent.',
  'Prefer a graceful exit when interest is absent or ambiguous.',
];

const voiceByLocale: Record<SupportedLocale, string[]> = {
  'es-AR': [
    'Use natural voseo and concise Argentine phrasing.',
    'Avoid stacking slang or imitating a stereotype.',
  ],
  'es-UY': [
    'Use natural voseo and restrained Uruguayan phrasing.',
    'Keep the tone warm and understated; avoid caricatured slang.',
  ],
  'es-MX': [
    'Use natural Mexican Spanish and tuteo.',
    'Prefer widely understood phrasing over forced regional slang.',
  ],
  'es-CO': [
    'Use natural Colombian Spanish and default to respectful tuteo.',
    'Keep regionalisms light unless the conversation already uses them.',
  ],
  'es-CL': [
    'Use natural Chilean Spanish without phonetic spelling.',
    'Avoid dense slang that could sound imitative or unclear.',
  ],
  'es-419': [
    'Use concise, natural Latin American Spanish.',
    'Avoid country-specific slang and choose broadly understood wording.',
  ],
};

export function buildLocaleRuleSet(locale: SupportedLocale) {
  return {
    locale,
    name: 'LATAM Dating DM Rules',
    version: 1,
    systemPrompt: voiceByLocale[locale].join('\n'),
    rules: [...voiceByLocale[locale], ...safetyRules],
    active: true,
  };
}

export const reviewedLocaleRuleSets = (
  Object.keys(voiceByLocale) as SupportedLocale[]
).map(buildLocaleRuleSet);
