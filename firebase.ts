
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

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBMcYKMy9zPBeVZMUYtJsjMCVXQP7K7lx4",
  authDomain: "asist-up-6ccd1.firebaseapp.com",
  projectId: "asist-up-6ccd1",
  storageBucket: "asist-up-6ccd1.firebasestorage.app",
  messagingSenderId: "944407397524",
  appId: "1:944407397524:web:8e685e9ea9382288622081"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * Comprime un objeto JS a una cadena Base64
 */
export const compressData = (data: any): string => {
  try {
    const jsonString = JSON.stringify(data);
    return LZString.compressToEncodedURIComponent(jsonString);
  } catch (e) {
    console.error("Error al comprimir:", e);
    return "";
  }
};

/**
 * Descomprime una cadena Base64 a un objeto JS
 */
export const decompressData = (compressed: string): any => {
  try {
    if (!compressed) return null;
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    return decompressed ? JSON.parse(decompressed) : null;
  } catch (e) {
    console.error("Error al descomprimir datos:", e);
    return null;
  }
};

export { collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc };
