
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
import LZString from "lz-string";

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

export const compressData = (data: any): string => {
  try {
    return LZString.compressToEncodedURIComponent(JSON.stringify(data));
  } catch (e) {
    console.error("Error al comprimir:", e);
    return "";
  }
};

export const decompressData = (compressed: string): any => {
  try {
    if (!compressed) return null;
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    return decompressed ? JSON.parse(decompressed) : null;
  } catch (e) {
    console.error("Error al descomprimir:", e);
    return null;
  }
};

export { collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc };
