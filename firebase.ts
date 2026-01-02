import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import LZString from "https://esm.sh/lz-string@1.5.0";

const firebaseConfig = {
  apiKey: "AIzaSyBMcYKMy9zPBeVZMUYtJsjMCVXQP7K7lx4",
  authDomain: "asist-up-6ccd1.firebaseapp.com",
  projectId: "asist-up-6ccd1",
  storageBucket: "asist-up-6ccd1.firebasestorage.app",
  messagingSenderId: "944407397524",
  appId: "1:944407397524:web:8e685e9ea9382288622081"
};

// Inicialización de la App
const app = initializeApp(firebaseConfig);

// Inicialización de Firestore vinculada a la App
const db = getFirestore(app);

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