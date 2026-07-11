// Fixed vocabulary of 768 words for local dating-chat semantic vectorization
const baseVocabulary = [
  // Common dating/app words
  'hola', 'como', 'estas', 'bien', 'todo', 'tranqui', 'vos', 'che', 'chamuyo', 'cita',
  'salida', 'jaja', 'jajaja', 'jajaja', 'jaja', 'ig', 'instagram', 'whatsapp', 'numero', 'celu',
  'foto', 'captura', 'chat', 'mensaje', 'escribir', 'hablar', 'onda', 'lindo', 'linda', 'hermosa',
  'gato', 'turra', 'intensa', 'denso', 'pesado', 'pesada', 'aburrido', 'divertido', 'copado', 'copada',
  'bueno', 'malo', 'peor', 'mejor', 'ganas', 'hacer', 'salir', 'tomar', 'birra', 'cafe',
  'vino', 'comer', 'cena', 'almorzar', 'merendar', 'boliche', 'fiesta', 'junta', 'amigos', 'amigas',
  'novio', 'novia', 'ex', 'relacion', 'casual', 'serio', 'buscar', 'encontrar', 'perfil', 'match',
  'tinder', 'bumble', 'happn', 'apps', 'redes', 'seguidores', 'seguidora', 'seguidors', 'reaccion', 'historia',
  'publicacion', 'comentario', 'like', 'corazon', 'fueguito', 'visto', 'clavado', 'responder', 'tardar',
  'ignorar', 'bloquear', 'celos', 'celosa', 'toxico', 'toxica', 'amor', 'cariño', 'beso', 'besos',
  'abrazo', 'dormir', 'cama', 'casa', 'departamento', 'barrio', 'capital', 'provincia', 'viaje', 'vacaciones',
  'trabajo', 'estudio', 'facu', 'laburo', 'laburar', 'estudiar', 'tiempo', 'libre', 'semana', 'finde',
  'sabado', 'domingo', 'viernes', 'noche', 'tarde', 'dia', 'mañana', 'temprano', 'tarde', 'noche',
  'calor', 'frio', 'lluvia', 'sol', 'invierno', 'verano', 'otoño', 'primavera', 'musica', 'peli',
  'serie', 'netflix', 'spotify', 'cine', 'teatro', 'recital', 'concierto', 'banda', 'cancion', 'bailar',
  'cantar', 'tocar', 'guitarra', 'piano', 'bici', 'auto', 'moto', 'caminar', 'correr', 'gym',
  'entrenar', 'deporte', 'futbol', 'tenis', 'padel', 'basquet', 'rugby', 'hockey', 'playa', 'montaña',
  'rio', 'pileta', 'sol', 'aire', 'libre', 'naturaleza', 'perro', 'gato', 'mascota', 'animal',
  'comida', 'pizza', 'hamburguesa', 'sushi', 'asado', 'carne', 'pasta', 'helado', 'chocolate', 'dulce',
  // Pad with generic spanish words to complete exactly 768 words
  'que', 'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'al', 'del', 'lo',
  'de', 'en', 'para', 'por', 'con', 'sin', 'sobre', 'tras', 'hasta', 'desde', 'durante', 'mediante',
  'y', 'o', 'u', 'pero', 'mas', 'sino', 'porque', 'como', 'cuando', 'donde', 'quien', 'cual',
  'cuyo', 'cuanto', 'este', 'esta', 'esto', 'estos', 'estas', 'ese', 'esa', 'eso', 'esos', 'esas',
  'aquel', 'aquella', 'aquello', 'aquellos', 'aquellas', 'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro',
  'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras', 'yo', 'tu', 'el', 'ella', 'nosotros',
  'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'me', 'te', 'se', 'nos', 'os', 'le', 'les',
  'lo', 'la', 'los', 'las', 'mi', 'ti', 'si', 'conmigo', 'contigo', 'consigo', 'nada', 'todo',
  'algo', 'alguien', 'alguno', 'alguna', 'algunos', 'algunas', 'ninguno', 'ninguna', 'ningunos', 'ningunas', 'otro', 'otra',
  'otros', 'otras', 'mismo', 'misma', 'mismos', 'mismas', 'tanto', 'tanta', 'tantos', 'tantas', 'poco', 'poca',
  'pocos', 'pocas', 'mucho', 'mucha', 'muchos', 'muchas', 'demasiado', 'demasiada', 'demasiados', 'demasiadas', 'mas', 'menos',
  'muy', 'bastante', 'casi', 'solo', 'solamente', 'ya', 'aun', 'todavia', 'incluso', 'siquiera', 'si', 'no',
  'talvez', 'quiza', 'quizas', 'acaso', 'bueno', 'malo', 'bien', 'mal', 'mejor', 'peor', 'asi', 'como',
  'despacio', 'deprisa', 'rapido', 'rapidamente', 'alto', 'bajo', 'fuere', 'adentro', 'afuera', 'arriba', 'abajo', 'delante',
  'detras', 'cerca', 'lejos', 'aqui', 'ahi', 'alli', 'alla', 'aculla', 'enfrente', 'encima', 'debajo', 'donde',
  'adonde', 'hoy', 'ayer', 'anteayer', 'mañana', 'anoche', 'antier', 'ya', 'ahora', 'antes', 'despues', 'luego',
  'entonces', 'tarde', 'temprano', 'pronto', 'siempre', 'nunca', 'jamas', 'mientras', 'todavia', 'aun', 'recien', 'cuando',
  'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
  'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta',
  'setenta', 'ochenta', 'noventa', 'cien', 'ciento', 'mil', 'millon', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto',
  'ultimo', 'unico', 'algun', 'ningun', 'primer', 'tercer', 'gran', 'cualquier', 'cualquiera', 'cualesquiera', 'quienquiera', 'quienesquiera',
  'ser', 'estar', 'haber', 'tener', 'hacer', 'poder', 'decir', 'ir', 'ver', 'dar', 'saber', 'querer',
  'llegar', 'pasar', 'deber', 'poner', 'parecer', 'quedar', 'creer', 'hablar', 'llevar', 'dejar', 'seguir', 'encontrar',
  'llamar', 'venir', 'pensar', 'salir', 'volver', 'tomar', 'conocer', 'vivir', 'sentir', 'tratar', 'mirar', 'contar',
  'empezar', 'esperar', 'buscar', 'existir', 'entrar', 'trabajar', 'escribir', 'perder', 'producir', 'ocurrir', 'entender', 'pedir',
  'recibir', 'recordar', 'terminar', 'permitir', 'aparecer', 'conseguir', 'comenzar', 'servir', 'sacar', 'necesitar', 'mantener', 'resultar',
  'leer', 'caer', 'cambiar', 'presentar', 'crear', 'abrir', 'considerar', 'oír', 'acabar', 'ganar', 'formar', 'traer',
  'partir', 'morir', 'aceptar', 'realizar', 'suponer', 'comprender', 'lograr', 'explicar', 'preguntar', 'tocar', 'reconocer', 'alcanzar',
  'dirigir', 'correr', 'utilizar', 'pagar', 'ayudar', 'gustar', 'jugar', 'escuchar', 'ofrecer', 'descubrir', 'levantar', 'intentar',
  'cantar', 'viajar', 'estudiar', 'comer', 'vender', 'recordar', 'olvidar', 'andar', 'reír', 'soñar', 'llorar', 'caminar',
  'luchar', 'matar', 'morir', 'nacer', 'crecer', 'salvar', 'proteger', 'defender', 'atacar', 'ganar', 'perder', 'vencer',
  'amar', 'odiar', 'querer', 'desear', 'temer', 'asustar', 'sorprender', 'alegrar', 'tristecer', 'enojar', 'enfadar', 'molestar',
  'aburrir', 'interesar', 'preocupar', 'importar', 'valer', 'costar', 'pagar', 'comprar', 'vender', 'gastar', 'ahorrar', 'prestar',
  'pedir', 'devolver', 'cambiar', 'elegir', 'decidir', 'preferir', 'aceptar', 'rechazar', 'permitir', 'prohibir', 'obligar', 'invitar',
  'visitar', 'saludar', 'despedir', 'abrazar', 'besar', 'tocar', 'mirar', 'observar', 'escuchar', 'oir', 'oler', 'gustar',
  'sentir', 'pensar', 'creer', 'opinar', 'considerar', 'imaginar', 'recordar', 'olvidar', 'saber', 'conocer', 'entender', 'comprender',
  'aprender', 'estudiar', 'enseñar', 'explicar', 'mostrar', 'demostrar', 'probar', 'intentar', 'tratar', 'lograr', 'conseguir', 'evitar',
  'impedir', 'permitir', 'dejar', 'hacer', 'crear', 'construir', 'destruir', 'romper', 'reparar', 'limpiar', 'ensuciar', 'pintar',
  'dibujar', 'escribir', 'leer', 'cantar', 'bailar', 'actuar', 'tocar', 'jugar', 'correr', 'saltar', 'caminar', 'pasear',
  'viajar', 'volar', 'navegar', 'conducir', 'manejar', 'subir', 'bajar', 'entrar', 'salir', 'venir', 'ir', 'volver',
  'llegar', 'partir', 'esperar', 'parar', 'detener', 'cruzar', 'pasar', 'seguir', 'continuar', 'empezar', 'comenzar', 'terminar',
  'acabar', 'morir', 'vivir', 'nacer', 'crecer', 'envejecer', 'despertar', 'dormir', 'soñar', 'descansar', 'trabajar', 'estudiar',
  'aprender', 'enseñar', 'comunicar', 'hablar', 'decir', 'contar', 'narrar', 'explicar', 'preguntar', 'responder', 'contestar', 'callar',
  'gritar', 'susurrar', 'cantar', 'llorar', 'reir', 'sonreir', 'broma', 'chiste', 'divertir', 'aburrir', 'cansar', 'relajar',
  'preocupar', 'asustar', 'temer', 'odiar', 'amar', 'querer', 'adorar', 'apreciar', 'valorar', 'respetar', 'admirar', 'despreciar',
  'ignorar', 'olvidar', 'recordar', 'pensar', 'reflexionar', 'analizar', 'evaluar', 'juzgar', 'criticar', 'elogiar', 'felicitar', 'agradecer',
  'perdonar', 'disculpar', 'pedir', 'solicitar', 'exigir', 'reclamar', 'quejar', 'protestar', 'luchar', 'pelear', 'discutir', 'debatir',
  'negociar', 'acordar', 'pactar', 'firmar', 'aprobar', 'rechazar', 'denegar', 'aceptar', 'admitir', 'confesar', 'negar', 'mentir',
  'decir', 'revelar', 'ocultar', 'esconder', 'guardar', 'proteger', 'cuidar', 'salvar', 'ayudar', 'colaborar', 'apoyar', 'defender',
  'atacar', 'dañar', 'herir', 'matar', 'destruir', 'romper', 'quemar', 'cortar', 'pegar', 'unir', 'separar', 'dividir',
  'compartir', 'repartir', 'distribuir', 'dar', 'regalar', 'ofrecer', 'entregar', 'enviar', 'mandar', 'recibir', 'tomar', 'coger',
  'agarrar', 'soltar', 'tirar', 'arrojar', 'lanzar', 'recoger', 'juntar', 'reunir', 'organizar', 'clasificar', 'ordenar', 'desordenar',
  'limpiar', 'ensuciar', 'lavar', 'secar', 'planchar', 'cocinar', 'preparar', 'servir', 'comer', 'beber', 'tomar', 'desayunar',
  'almorzar', 'cenar', 'merendar', 'picar', 'probar', 'gustar', 'saborear', 'disfrutar', 'gozar', 'divertirse', 'entretenerse', 'aburrirse',
  'cansarse', 'agotarse', 'fatigarse', 'debilitarse', 'fortalecerse', 'curarse', 'sanar', 'enfermarse', 'dolor', 'sufrir', 'llorar', 'suplicar',
  'pedir', 'rogar', 'rezar', 'orar', 'meditar', 'pensar', 'imaginar', 'crear', 'inventar', 'descubrir', 'hallar', 'encontrar'
];

// Deduplicate and cut/pad to exactly 768 words
const vocabulary = Array.from(new Set(baseVocabulary)).slice(0, 768);
while (vocabulary.length < 768) {
  vocabulary.push(`word_${vocabulary.length}`);
}

export function generateLocalEmbedding(text: string): number[] {
  const tokens = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '')     // remove punctuation
    .split(/\s+/);

  const vector = new Array(768).fill(0);
  
  // Count frequency
  for (const token of tokens) {
    const idx = vocabulary.indexOf(token);
    if (idx !== -1) {
      vector[idx] += 1;
    }
  }

  // Calculate Euclidean norm
  let norm = 0;
  for (let i = 0; i < 768; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  // Normalize to unit length (so cosine similarity is just dot product)
  if (norm > 0) {
    for (let i = 0; i < 768; i++) {
      vector[i] = vector[i] / norm;
    }
  } else {
    // If empty text, return a fallback unit vector at index 0
    vector[0] = 1.0;
  }

  return vector;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return generateLocalEmbedding(text);
}
