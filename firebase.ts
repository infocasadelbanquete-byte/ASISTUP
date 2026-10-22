import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc 
} from "firebase/firestore";
import LZString from "lz-string";

/**
 * CONFIGURACIÓN DE SEGURIDAD FIRESTORE:
 * Si experimenta errores de permiso (403) al intentar crear registros, asegúrese de
 * aplicar las reglas definidas en el archivo 'firestore.rules' en su consola de Firebase.
 * El sistema ASIST UP requiere permisos de escritura en 'attendance', 'employees',
 * 'payments' y 'config' para operar correctamente.
 */

// Configuración leída desde variables de entorno (definidas en Netlify con prefijo VITE_)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "asist-up-6ccd1.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "asist-up-6ccd1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "asist-up-6ccd1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "944407397524",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:944407397524:web:6b0cdfa6a21cc6a7622081"
};

const app = initializeApp(firebaseConfig);

// Inicializar Firestore con persistencia optimizada para PWA y múltiples pestañas
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const safeStringify = (obj: any) => {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) return;
      cache.add(value);
    }
    return value;
  });
};

export const compressData = (data: any): string => {
  try {
    if (!data) return "";
    return LZString.compressToEncodedURIComponent(safeStringify(data));
  } catch (e) {
    console.error("Compresión fallida:", e);
    return "";
  }
};

export const decompressData = (compressed: any): any => {
  try {
    if (!compressed || typeof compressed !== 'string') return null;
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    return decompressed ? JSON.parse(decompressed) : null;
  } catch (e) {
    console.error("Descompresión fallida:", e);
    return null;
  }
};

export { db, collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc };
