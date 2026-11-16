
export const MOTIVATIONAL_MESSAGES_START = [
  "¡Buen día! Hoy será un gran día para brillar.",
  "¡Bienvenido! Tu esfuerzo hace la diferencia.",
  "¡Hola! Listos para alcanzar nuevas metas.",
  "¡Empecemos con energía positiva!",
  "¡Tu talento es el motor de esta empresa!",
  "¡Ánimo! Cada minuto cuenta para tu éxito."
];

export const MOTIVATIONAL_MESSAGES_END = [
  "¡Gran trabajo hoy! Descansa bien.",
  "¡Misión cumplida! Nos vemos mañana.",
  "¡Buen descanso! Te lo has ganado.",
  "¡Gracias por tu dedicación hoy!",
  "¡Excelente jornada! Disfruta tu tiempo libre.",
  "¡Mañana será otro día de grandes logros!"
];

export const DAILY_QUOTES = [
  "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
  "El único modo de hacer un gran trabajo es amar lo que haces.",
  "La motivación es lo que te pone en marcha, el hábito es lo que te hace seguir.",
  "No cuentes los días, haz que los días cuenten.",
  "La excelencia no es un acto, sino un hábito.",
  "Tu trabajo va a llenar gran parte de tu vida, la única manera de estar satisfecho es hacer lo que crees que es un gran trabajo.",
  "Cree que puedes y casi habrás llegado.",
  "El talento gana partidos, pero el trabajo en equipo gana campeonatos.",
  "La mejor forma de predecir el futuro es creándolo.",
  "La disciplina es el puente entre las metas y los logros."
];

export const ACTIVE_BREAKS = [
  {
    title: "Estiramiento de Cuello",
    description: "Incline la cabeza hacia el hombro derecho y mantenga 10 segundos. Repita hacia la izquierda para liberar tensión cervical.",
    icon: "🧘‍♂️"
  },
  {
    title: "Descanso Visual 20-20-20",
    description: "Cada 20 minutos, mire un objeto a 20 pies (6 metros) durante 20 segundos para reducir la fatiga ocular.",
    icon: "👁️"
  },
  {
    title: "Movilidad de Muñecas",
    description: "Extienda los brazos y realice círculos suaves con las muñecas hacia ambos lados durante 15 segundos.",
    icon: "👋"
  },
  {
    title: "Respiración Diafragmática",
    description: "Inhale profundamente por la nariz expandiendo el abdomen, retenga 3 segundos y exhale lentamente por la boca.",
    icon: "🌬️"
  },
  {
    title: "Estiramiento de Espalda",
    description: "Entrelace las manos y estire los brazos hacia el techo, alargando la columna lo más posible.",
    icon: "🧍"
  }
];

export const APP_NAME = "ASIST UP";

export const SYSTEM_VERSION = "v3.7.0";

export const DEFAULT_SYSTEM_UPDATE = {
  version: "v3.7.0",
  releaseDate: "2026-11-16",
  title: "Actualización v3.7.0: Nómina Fijos/Extras, Normativa Laboral por Año, Ajustes Maestros Protegidos y Caché Netlify",
  description: "Actualización obligatoria para todas las terminales y navegadores. Incorpora nómina separada de Empleados Fijos y Extras (Temporales) sin redondeo y con guardado persistente, impresión A4 limpia del rol individual, cálculos regidos por Ajustes del Sistema Maestro con transición anual automática y autorización por clave administrativa, y renovación automática de caché PWA en Netlify.",
  changelog: [
    "Separación integral de Nómina Empleados Fijos y Nómina Empleados Extras (Temporales) con guardado persistente de ajustes.",
    "Cálculo exacto sin redondeo de días trabajados, horas en decimal y tasas según normativa laboral vigente de Ecuador por año.",
    "Impresión individual optimizada en formato A4 limpio sin imágenes ni recortes.",
    "Ajustes del Sistema Maestro con cambio automático al iniciar cada año fiscal y autorización obligatoria mediante contraseña de administrador.",
    "Renovación automática de Service Worker y cabeceras sin caché en Netlify para garantizar visualización inmediata de cada actualización."
  ],
  isMandatory: true,
  publishedAt: "2026-11-16T16:45:00.000Z"
};

export const ECUADOR_HOLIDAYS = [
  { name: "Año Nuevo", month: 0, day: 1, duration: 7 },
  { name: "San Valentín", month: 1, day: 14 },
  { name: "Carnaval", month: 1, day: 20 },
  { name: "Fundación de Cuenca", month: 3, day: 12 },
  { name: "Día de la Madre", month: 4, day: 13 },
  { name: "Día del Padre", month: 5, day: 17 },
  { name: "Día del Niño", month: 5, day: 1 },
  { name: "Batalla del Pichincha", month: 4, day: 24 },
  { name: "Primer Grito de Independencia", month: 7, day: 10 },
  { name: "Independencia de Guayaquil", month: 9, day: 9 },
  { name: "Independencia de Cuenca", month: 10, day: 3 },
  { name: "Navidad", month: 11, day: 25 }
];
