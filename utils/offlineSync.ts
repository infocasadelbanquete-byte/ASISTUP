import { doc, setDoc, deleteDoc, compressData } from '../firebase.ts';

export type OfflineActionType =
  | 'attendance_record'
  | 'attendance_batch'
  | 'attendance_delete'
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
  retries?: number;
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
    description,
    retries: 0
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

export const hasPendingOfflineForTypes = (types: OfflineActionType[]): boolean => {
  const typeSet = new Set(types);
  return getOfflineQueue().some(item => typeSet.has(item.type));
};

/**
 * Reconcilia los datos recibidos del servidor con cambios locales aún pendientes en la cola offline,
 * evitando que una actualización remota oculte registros locales todavía no sincronizados.
 */
export const mergePendingEntityQueue = <T extends { id: string }>(
  serverItems: T[],
  batchTypes: OfflineActionType[],
  singleAddType?: OfflineActionType,
  singleDeleteType?: OfflineActionType
): T[] => {
  const queue = getOfflineQueue();
  const relevant = queue.filter(
    item =>
      batchTypes.includes(item.type) ||
      (singleAddType && item.type === singleAddType) ||
      (singleDeleteType && item.type === singleDeleteType)
  );
  if (relevant.length === 0) return serverItems;

  const map = new Map<string, T>(serverItems.map(item => [item.id, item]));

  for (const action of relevant) {
    if (action.type === 'attendance_record' && action.payload?.id) {
      map.set(action.payload.id, action.payload as T);
    } else if (action.type === 'attendance_batch' && Array.isArray(action.payload)) {
      for (const r of action.payload) {
        if (r && r.id) map.set(r.id, r as T);
      }
    } else if (action.type === 'attendance_delete' && Array.isArray(action.payload)) {
      for (const delId of action.payload) {
        map.delete(delId);
      }
    } else if (action.type === 'employee_single' && action.payload?.id) {
      map.set(action.payload.id, action.payload as T);
    } else if (action.type === 'employee_delete' && typeof action.payload === 'string') {
      map.delete(action.payload);
    } else if (action.type === 'employee_batch' && action.payload) {
      const deletedIds: string[] = action.payload.deletedIds || [];
      const changed: T[] = action.payload.changedEmps || action.payload.emps || [];
      for (const delId of deletedIds) map.delete(delId);
      for (const emp of changed) {
        if (emp && emp.id) map.set(emp.id, emp);
      }
    } else if (action.type === 'payment_batch' && action.payload) {
      const deletedIds: string[] = action.payload.deletedIds || [];
      const changed: T[] = action.payload.changedPayments || action.payload.payments || [];
      for (const delId of deletedIds) map.delete(delId);
      for (const pay of changed) {
        if (pay && pay.id) map.set(pay.id, pay);
      }
    } else if (action.type === 'saved_reports_batch' && action.payload) {
      if (Array.isArray(action.payload)) {
        for (const rep of action.payload) {
          if (rep && rep.id) map.set(rep.id, rep as T);
        }
      } else {
        const deletedIds: string[] = action.payload.deletedIds || [];
        const changed: T[] = action.payload.changedReports || action.payload.reports || [];
        for (const delId of deletedIds) map.delete(delId);
        for (const rep of changed) {
          if (rep && rep.id) map.set(rep.id, rep);
        }
      }
    }
  }

  return Array.from(map.values());
};

const runWithTimeout = <T>(promise: Promise<T>, ms = 10000): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('FIRESTORE_SYNC_TIMEOUT')), ms);
    promise
      .then(res => {
        window.clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
};

const isTransientSyncError = (err: any): boolean => {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  if (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('aborted') ||
    code.includes('internal') ||
    code.includes('resource-exhausted') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch')
  ) {
    return true;
  }
  return false;
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
            const payload = compressData(rec);
            if (payload) {
              await runWithTimeout(
                setDoc(doc(db, "attendance", rec.id), {
                  payload,
                  timestamp: rec.timestamp || new Date().toISOString()
                })
              );
            }
          }
          break;
        }

        case 'attendance_batch': {
          const recs = item.payload;
          if (Array.isArray(recs)) {
            for (const r of recs) {
              if (!r || !r.id) continue;
              const payload = compressData(r);
              if (!payload) continue;
              await runWithTimeout(
                setDoc(doc(db, "attendance", r.id), {
                  payload,
                  timestamp: r.timestamp || new Date().toISOString()
                })
              );
            }
          }
          break;
        }

        case 'attendance_delete': {
          const ids = item.payload;
          if (Array.isArray(ids)) {
            for (const delId of ids) {
              if (!delId) continue;
              await runWithTimeout(deleteDoc(doc(db, "attendance", delId)));
            }
          }
          break;
        }

        case 'employee_single': {
          const emp = item.payload;
          if (emp && emp.id) {
            const payload = compressData(emp);
            if (payload) {
              await runWithTimeout(setDoc(doc(db, "employees", emp.id), { payload }));
            }
          }
          break;
        }

        case 'employee_delete': {
          const empId = item.payload;
          if (empId) {
            await runWithTimeout(deleteDoc(doc(db, "employees", empId)));
          }
          break;
        }

        case 'employee_batch': {
          const deletedIds = item.payload?.deletedIds || [];
          const empList = item.payload?.changedEmps || item.payload?.emps || [];
          if (Array.isArray(deletedIds)) {
            for (const delId of deletedIds) {
              if (!delId) continue;
              await runWithTimeout(deleteDoc(doc(db, "employees", delId)));
            }
          }
          if (Array.isArray(empList)) {
            for (const e of empList) {
              if (!e || !e.id) continue;
              const payload = compressData(e);
              if (!payload) continue;
              await runWithTimeout(setDoc(doc(db, "employees", e.id), { payload }));
            }
          }
          break;
        }

        case 'payment_batch': {
          const deletedIds = item.payload?.deletedIds || [];
          const payList = item.payload?.changedPayments || item.payload?.payments || [];
          if (Array.isArray(deletedIds)) {
            for (const delId of deletedIds) {
              if (!delId) continue;
              await runWithTimeout(deleteDoc(doc(db, "payments", delId)));
            }
          }
          if (Array.isArray(payList)) {
            for (const p of payList) {
              if (!p || !p.id) continue;
              const payload = compressData(p);
              if (!payload) continue;
              await runWithTimeout(setDoc(doc(db, "payments", p.id), { payload }));
            }
          }
          break;
        }

        case 'company_config': {
          const comp = item.payload;
          if (comp) {
            const payload = compressData(comp);
            if (payload) {
              await runWithTimeout(setDoc(doc(db, "config", "company"), { payload }));
            }
          }
          break;
        }

        case 'settings_config': {
          const sett = item.payload;
          if (sett) {
            const payload = compressData(sett);
            if (payload) {
              await runWithTimeout(setDoc(doc(db, "config", "settings"), { payload }));
            }
          }
          break;
        }

        case 'saved_reports_batch': {
          const rawPayload = item.payload;
          const deletedIds = !Array.isArray(rawPayload) ? (rawPayload?.deletedIds || []) : [];
          const reps = Array.isArray(rawPayload)
            ? rawPayload
            : (rawPayload?.changedReports || rawPayload?.reports || []);

          if (Array.isArray(deletedIds)) {
            for (const delId of deletedIds) {
              if (!delId) continue;
              await runWithTimeout(deleteDoc(doc(db, "saved_reports", delId)));
            }
          }
          if (Array.isArray(reps)) {
            for (const r of reps) {
              if (!r || !r.id) continue;
              const payload = compressData(r);
              if (!payload) continue;
              await runWithTimeout(setDoc(doc(db, "saved_reports", r.id), { payload }));
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
    } catch (err: any) {
      console.warn(`Error al sincronizar acción offline [${item.type}]:`, err);
      errors++;
      if (isTransientSyncError(err)) {
        // Error de red/conexión transitorio: detener este ciclo y reintentar después manteniendo orden
        break;
      }
      // Para errores no transitorios (datos inválidos), contar reintentos para no bloquear indefinidamente la cola
      const currentQueue = getOfflineQueue();
      const retries = (item.retries || 0) + 1;
      if (retries >= 5) {
        saveOfflineQueue(currentQueue.filter(q => q.id !== item.id));
      } else {
        saveOfflineQueue(currentQueue.map(q => q.id === item.id ? { ...q, retries } : q));
      }
    }
  }

  return { syncedCount, errors };
};
