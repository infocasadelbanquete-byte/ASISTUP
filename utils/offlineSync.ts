import { doc, setDoc, deleteDoc, compressData } from '../firebase.ts';

export type OfflineActionType = 
  | 'attendance_record'
  | 'attendance_batch'
  | 'employee_batch'
  | 'employee_single'
  | 'employee_delete'
  | 'payment_batch'
  | 'company_config'
  | 'settings_config'
  | 'saved_reports_batch';

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: any;
  timestamp: number;
  description: string;
}

const STORAGE_KEY = 'asistup_offline_sync_queue';

export const getOfflineQueue = (): OfflineAction[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error al leer cola offline:", e);
    return [];
  }
};

const saveOfflineQueue = (queue: OfflineAction[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Error al guardar cola offline:", e);
  }
};

export const enqueueOfflineAction = (
  type: OfflineActionType, 
  payload: any, 
  description: string
): OfflineAction => {
  const queue = getOfflineQueue();
  const newItem: OfflineAction = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
    type,
    payload,
    timestamp: Date.now(),
    description
  };

  // Optimización de colas: si es una configuración (company o settings), reemplazar la previa para evitar envíos redundantes
  let updatedQueue: OfflineAction[];
  if (type === 'company_config' || type === 'settings_config') {
    updatedQueue = [...queue.filter(item => item.type !== type), newItem];
  } else {
    updatedQueue = [...queue, newItem];
  }

  saveOfflineQueue(updatedQueue);
  return newItem;
};

export const removeOfflineAction = (id: string): void => {
  const queue = getOfflineQueue();
  saveOfflineQueue(queue.filter(item => item.id !== id));
};

export const clearOfflineQueue = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
};

export const getPendingSyncCount = (): number => {
  return getOfflineQueue().length;
};

/**
 * Procesa la cola de sincronización offline contra Firestore.
 * Cada elemento procesado exitosamente se retira de la cola.
 */
export const processOfflineSync = async (
  db: any
): Promise<{ syncedCount: number; errors: number }> => {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { syncedCount: 0, errors: 0 };

  let syncedCount = 0;
  let errors = 0;

  for (const item of queue) {
    try {
      switch (item.type) {
        case 'attendance_record': {
          const rec = item.payload;
          if (rec && rec.id) {
            await setDoc(doc(db, "attendance", rec.id), {
              payload: compressData(rec),
              timestamp: rec.timestamp
            });
          }
          break;
        }

        case 'attendance_batch': {
          const recs = item.payload;
          if (Array.isArray(recs)) {
            for (const r of recs) {
              await setDoc(doc(db, "attendance", r.id), {
                payload: compressData(r),
                timestamp: r.timestamp
              });
            }
          }
          break;
        }

        case 'employee_single': {
          const emp = item.payload;
          if (emp && emp.id) {
            await setDoc(doc(db, "employees", emp.id), {
              payload: compressData(emp)
            });
          }
          break;
        }

        case 'employee_delete': {
          const empId = item.payload;
          if (empId) {
            await deleteDoc(doc(db, "employees", empId));
          }
          break;
        }

        case 'employee_batch': {
          const { emps, deletedIds } = item.payload;
          if (Array.isArray(deletedIds)) {
            for (const delId of deletedIds) {
              await deleteDoc(doc(db, "employees", delId)).catch(() => {});
            }
          }
          if (Array.isArray(emps)) {
            for (const e of emps) {
              await setDoc(doc(db, "employees", e.id), {
                payload: compressData(e)
              });
            }
          }
          break;
        }

        case 'payment_batch': {
          const { payments, deletedIds } = item.payload;
          if (Array.isArray(deletedIds)) {
            for (const delId of deletedIds) {
              await deleteDoc(doc(db, "payments", delId)).catch(() => {});
            }
          }
          if (Array.isArray(payments)) {
            for (const p of payments) {
              await setDoc(doc(db, "payments", p.id), {
                payload: compressData(p)
              });
            }
          }
          break;
        }

        case 'company_config': {
          const comp = item.payload;
          if (comp) {
            await setDoc(doc(db, "config", "company"), {
              payload: compressData(comp)
            });
          }
          break;
        }

        case 'settings_config': {
          const sett = item.payload;
          if (sett) {
            await setDoc(doc(db, "config", "settings"), {
              payload: compressData(sett)
            });
          }
          break;
        }

        case 'saved_reports_batch': {
          const reps = item.payload;
          if (Array.isArray(reps)) {
            for (const r of reps) {
              await setDoc(doc(db, "saved_reports", r.id), {
                payload: compressData(r)
              });
            }
          }
          break;
        }

        default:
          console.warn("Tipo de acción offline no reconocida:", item.type);
      }

      // Al completar sin excepción, eliminar de la cola
      removeOfflineAction(item.id);
      syncedCount++;
    } catch (err) {
      console.warn(`Error al sincronizar acción offline [${item.type}]:`, err);
      errors++;
      // Si falló por conexión, interrumpir el bucle para evitar saturación y reintentar después
      break;
    }
  }

  return { syncedCount, errors };
};
