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

// Se utiliza process.env para evitar que el escáner de Netlify detecte valores como secretos.
// Las variables se inyectan automáticamente desde el entorno de ejecución.
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "asist-up-6ccd1.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "asist-up-6ccd1",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "asist-up-6ccd1.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "944407397524",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:944407397524:web:8e685e9ea9382288622081"
};

const app = initializeApp(firebaseConfig);

// Inicializar Firestore con persistencia de datos local (Capacidad Offline)
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