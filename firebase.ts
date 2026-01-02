
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

// Configuración de Firebase utilizando variables de entorno
// FIX: Accessing API_KEY directly from process.env to avoid 'unknown' type errors when accessing window.process.env
const firebaseConfig = {
  apiKey: process.env.API_KEY || "",
  authDomain: "asist-up-6ccd1.firebaseapp.com",
  projectId: "asist-up-6ccd1",
  storageBucket: "asist-up-6ccd1.firebasestorage.app",
  messagingSenderId: "944407397524",
  appId: "1:944407397524:web:8e685e9ea9382288622081"
};

// Validar si tenemos API Key antes de inicializar para evitar errores silenciosos
if (!firebaseConfig.apiKey) {
  console.warn("ADVERTENCIA: API_KEY de Firebase no detectada. La conexión puede fallar.");
}

const app = initializeApp(firebaseConfig);

// Inicializar Firestore con persistencia optimizada
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

export const decompressData = (compressed: string): any => {
  try {
    if (!compressed) return null;
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    return decompressed ? JSON.parse(decompressed) : null;
  } catch (e) {
    console.error("Descompresión fallida:", e);
    return null;
  }
};

export { db, collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc };
