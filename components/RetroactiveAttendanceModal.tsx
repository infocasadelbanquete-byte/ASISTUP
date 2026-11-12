import React, { useState } from 'react';
import { Employee, AttendanceRecord, GlobalSettings } from '../types.ts';

export interface RetroactiveMissingSlot {
  id: string;
  date: string;
  dateFormatted: string;
  shiftLabel: string;
  type: 'in' | 'out';
  suggestedTime: string;
  selectedTime: string;
  justification: string;
  otherDetails?: string;
}

interface RetroactiveAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  missingSlots: RetroactiveMissingSlot[];
  onBatchRegister: (records: AttendanceRecord[]) => void;
  onRequestAdminReview: (reason: string, details: string, slots: RetroactiveMissingSlot[]) => void;
  onProceedToToday: () => void;
}

export const RetroactiveAttendanceModal: React.FC<RetroactiveAttendanceModalProps> = ({
  isOpen,
  onClose,
  employee,
  missingSlots,
  onBatchRegister,
  onRequestAdminReview,
  onProceedToToday
}) => {
  const [activeMode, setActiveMode] = useState<'selection' | 'regularize' | 'review'>('selection');

  // Estado para las horas y justificaciones de cada marcación en el modo "Ponerse al día"
  const [slotsData, setSlotsData] = useState<Record<string, { time: string; reason: string; other: string }>>(() => {
    const initial: Record<string, { time: string; reason: string; other: string }> = {};
    missingSlots.forEach(s => {
      initial[s.id] = {
        time: s.suggestedTime,
        reason: 'OLVIDO INVOLUNTARIO',
        other: ''
      };
    });
    return initial;
  });

  // Estado para la solicitud de revisión al Administrador
  const [reviewReason, setReviewReason] = useState('COMISIÓN DE SERVICIOS EXTERNA / TRABAJO DE CAMPO');
  const [reviewDetails, setReviewDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || missingSlots.length === 0) return null;

  const handleUpdateSlot = (id: string, field: 'time' | 'reason' | 'other', value: string) => {
    setSlotsData(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { time: '08:30', reason: 'OLVIDO INVOLUNTARIO', other: '' }),
        [field]: value
      }
    }));
  };

  // Enviar regularización para ponerse al día
  const handleConfirmRegularize = () => {
    setIsSubmitting(true);
    const newRecords: AttendanceRecord[] = missingSlots.map(slot => {
      const current = slotsData[slot.id] || { time: slot.suggestedTime, reason: 'OLVIDO INVOLUNTARIO', other: '' };
      const finalJustification = current.reason === 'OTRO (DETALLAR)'
        ? `REGULARIZACIÓN RETROACTIVA: ${current.other.toUpperCase() || 'MOTIVO PARTICULAR'}`
        : `REGULARIZACIÓN RETROACTIVA: ${current.reason}`;

      const timestamp = `${slot.date}T${current.time}:00.000Z`;

      return {
        id: Math.random().toString(36).substr(2, 9),
        employeeId: employee.id,
        timestamp,
        type: slot.type,
        status: 'pending_approval' as const,
        isForgotten: true,
        justification: `[SOLICITUD REGULARIZACIÓN]: ${finalJustification}`
      };
    });

    onBatchRegister(newRecords);
    setIsSubmitting(false);
  };

  const [validationError, setValidationError] = useState('');

  // Enviar solicitud de revisión al Administrador
  const handleConfirmReview = () => {
    if (!reviewDetails.trim()) {
      setValidationError("Por favor agregue una breve explicación para el Administrador.");
      return;
    }
    setValidationError('');
    setIsSubmitting(true);
    onRequestAdminReview(reviewReason, reviewDetails.toUpperCase(), missingSlots);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="p-6 bg-gradient-to-r from-slate-900 to-blue-950 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center text-2xl shadow-inner animate-pulse">
                ⚠️
              </div>
              <div>
                <span className="px-3 py-0.5 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[8px] font-black uppercase tracking-widest rounded-full">
                  Marcaciones Pendientes Retroactivas
                </span>
                <h3 className="text-base sm:text-lg font-[950] uppercase tracking-tight mt-1">
                  Atención requerida: {employee.name} {employee.surname}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* CONTENIDO INTERACTIVO */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scroll space-y-6 flex-1">
          
          {/* MODO SELECCIÓN INICIAL */}
          {activeMode === 'selection' && (
            <div className="space-y-6 text-center animate-in fade-in">
              <div className="p-6 bg-amber-50/70 border-2 border-amber-200/80 rounded-3xl text-left space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase tracking-wider">
                  <span>📅</span> Hemos detectado {missingSlots.length} registro(s) pendiente(s) en jornadas previas
                </div>
                <p className="text-[11px] font-medium text-slate-600 leading-relaxed uppercase">
                  Para garantizar la exactitud de tus horas laboradas y evitar discrepancias o descuentos involuntarios en tu rol de pagos mensual, el sistema te brinda dos alternativas claras:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {missingSlots.slice(0, 4).map(s => (
                    <span key={s.id} className="px-3 py-1 bg-white border border-amber-300 rounded-xl text-[9px] font-mono font-black text-amber-900 shadow-sm">
                      {s.dateFormatted} ({s.shiftLabel.split(' - ')[1] || s.shiftLabel})
                    </span>
                  ))}
                  {missingSlots.length > 4 && (
                    <span className="px-2 py-1 text-[9px] font-black text-amber-700 uppercase">
                      +{missingSlots.length - 4} más...
                    </span>
                  )}
                </div>
              </div>

              {/* OPCIONES PRINCIPALES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                
                {/* OPCIÓN A: PONERSE AL DÍA */}
                <button
                  type="button"
                  onClick={() => setActiveMode('regularize')}
                  className="group p-6 rounded-3xl border-2 border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-500 transition-all shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-emerald-600/30 group-hover:scale-110 transition-transform">
                      ✍️
                    </div>
                    <div>
                      <h4 className="text-sm font-[950] text-emerald-950 uppercase tracking-tight leading-snug">
                        Opción 1: Ponerme al día
                      </h4>
                      <p className="text-[10px] font-bold text-emerald-700 uppercase mt-1">
                        Regularizar mis marcaciones ahora
                      </p>
                    </div>
                    <p className="text-[9px] text-slate-600 uppercase leading-relaxed font-medium">
                      Completa tus horas no marcadas con total transparencia. Tus registros se asientan inmediatamente para que tu rol de pagos esté completo.
                    </p>
                  </div>
                  <div className="pt-4 mt-2 border-t border-emerald-200/60 flex items-center justify-between text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                    <span>Ingresar datos ahora</span>
                    <span className="text-base group-hover:translate-x-1 transition-transform">➔</span>
                  </div>
                </button>

                {/* OPCIÓN B: SOLICITAR REVISIÓN AL ADMIN */}
                <button
                  type="button"
                  onClick={() => setActiveMode('review')}
                  className="group p-6 rounded-3xl border-2 border-blue-200 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-500 transition-all shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-blue-600/30 group-hover:scale-110 transition-transform">
                      📋
                    </div>
                    <div>
                      <h4 className="text-sm font-[950] text-blue-950 uppercase tracking-tight leading-snug">
                        Opción 2: Solicitar Revisión
                      </h4>
                      <p className="text-[10px] font-bold text-blue-700 uppercase mt-1">
                        Auditoría por parte del Administrador
                      </p>
                    </div>
                    <p className="text-[9px] text-slate-600 uppercase leading-relaxed font-medium">
                      Envía una solicitud formal si estuviste en comisión de servicio de campo, permiso médico o existió un fallo técnico ajeno a ti.
                    </p>
                  </div>
                  <div className="pt-4 mt-2 border-t border-blue-200/60 flex items-center justify-between text-blue-800 text-[9px] font-black uppercase tracking-wider">
                    <span>Solicitar a RRHH / Admin</span>
                    <span className="text-base group-hover:translate-x-1 transition-transform">➔</span>
                  </div>
                </button>
              </div>

              {/* AVISO DE CONTROL OBLIGATORIO */}
              <div className="pt-4 border-t border-slate-100 flex flex-col items-center justify-center gap-2">
                <p className="text-[8px] font-black text-amber-700 uppercase tracking-widest text-center">
                  ⚠️ Control institucional: Seleccione una de las dos opciones para habilitar el marcado habitual de hoy.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-700 text-[9px] font-black uppercase tracking-widest transition-colors py-1 px-4 cursor-pointer"
                >
                  Regresar al Teclado de Marcación
                </button>
              </div>
            </div>
          )}

          {/* MODO 1: REGULARIZACIÓN GUIADA (PONERSE AL DÍA) */}
          {activeMode === 'regularize' && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-3xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase">
                  <span>✨</span> Modo Guiado: Ponerse al Día con Honestidad y Transparencia
                </div>
                <p className="text-[10px] font-medium text-slate-600 uppercase leading-relaxed italic">
                  "Tu integridad es el valor más grande de nuestra institución. Registra la hora aproximada en que cumpliste cada jornada y el motivo por el cual no pudiste registrarte en el terminal."
                </p>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scroll pr-1">
                {missingSlots.map(slot => {
                  const current = slotsData[slot.id] || { time: slot.suggestedTime, reason: 'OLVIDO INVOLUNTARIO', other: '' };
                  return (
                    <div
                      key={slot.id}
                      className="p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-3 hover:border-emerald-300 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-2">
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">
                            {slot.dateFormatted}
                          </p>
                          <p className="text-[9px] font-bold text-blue-600 uppercase">
                            {slot.shiftLabel} • {slot.type === 'in' ? 'Entrada' : 'Salida'}
                          </p>
                        </div>
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[8px] font-black uppercase rounded-full">
                          Pendiente
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                            Hora Cumplida
                          </label>
                          <input
                            type="time"
                            value={current.time}
                            onChange={e => handleUpdateSlot(slot.id, 'time', e.target.value)}
                            className="w-full p-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:border-emerald-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                            Motivo de Inasistencia / Olvido
                          </label>
                          <select
                            value={current.reason}
                            onChange={e => handleUpdateSlot(slot.id, 'reason', e.target.value)}
                            className="w-full p-2.5 bg-white border-2 border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-800 focus:border-emerald-500 outline-none"
                          >
                            <option value="OLVIDO INVOLUNTARIO">Olvido Involuntario</option>
                            <option value="SIN ACCESO AL PANEL O TERMINAL">Sin Acceso al Panel</option>
                            <option value="TRABAJO DE CAMPO / EXTERIORES">Trabajo de Campo / Exteriores</option>
                            <option value="FALLA DE ENERGÍA / CONEXIÓN">Falla de Energía / Conexión</option>
                            <option value="OTRO (DETALLAR)">Otro (Detallar)</option>
                          </select>
                        </div>
                      </div>

                      {current.reason === 'OTRO (DETALLAR)' && (
                        <input
                          type="text"
                          placeholder="DETALLE EL MOTIVO..."
                          value={current.other}
                          onChange={e => handleUpdateSlot(slot.id, 'other', e.target.value)}
                          className="w-full p-2.5 bg-white border rounded-xl text-[9px] font-bold uppercase focus:border-emerald-500 outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* BOTONES ACCIÓN */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('selection')}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-wider cursor-pointer"
                >
                  Volver a Opciones
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRegularize}
                  disabled={isSubmitting}
                  className="flex-2 py-4 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl shadow-blue-700/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>📨</span> Solicitar Regularización al Administrador ({missingSlots.length})
                </button>
              </div>
            </div>
          )}

          {/* MODO 2: SOLICITUD DE REVISIÓN AL ADMINISTRADOR */}
          {activeMode === 'review' && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="p-5 bg-blue-50 border border-blue-200 rounded-3xl space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-black text-xs uppercase">
                  <span>⚖️</span> Auditoría y Revisión Formal por Administración / RRHH
                </div>
                <p className="text-[10px] font-medium text-slate-600 uppercase leading-relaxed italic">
                  "Tu solicitud será notificada en tiempo real a la Consola Administrativa con alerta prioritaria para que Talento Humano audite las fechas involucradas y registre la resolución oficial."
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    Tipo de Eventualidad / Causal Justificada
                  </label>
                  <select
                    value={reviewReason}
                    onChange={e => setReviewReason(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border-2 rounded-2xl text-xs font-black uppercase text-slate-800 focus:border-blue-500 outline-none"
                  >
                    <option value="COMISIÓN DE SERVICIOS EXTERNA / TRABAJO DE CAMPO">Comisión Externa / Trabajo de Campo</option>
                    <option value="PERMISO MÉDICO / ATENCIÓN IESS AVALADA">Permiso Médico / Cita IESS</option>
                    <option value="CALAMIDAD DOMÉSTICA JUSTIFICADA">Calamidad Doméstica Justificada</option>
                    <option value="FALLA TÉCNICA O BLOQUEO EN EL TERMINAL">Falla Técnica del Terminal</option>
                    <option value="PERMISO PREVIAMENTE AUTORIZADO POR JEFATURA">Permiso Autorizado Previamente</option>
                    <option value="OTRO MOTIVO JUSTIFICADO">Otro Motivo Justificado</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    Explicación y Detalles para el Administrador
                  </label>
                  <textarea
                    rows={4}
                    placeholder="DESCRIBA CLARAMENTE LO SUCEDIDO EN LAS JORNADAS PENDIENTES..."
                    value={reviewDetails}
                    onChange={e => setReviewDetails(e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 rounded-2xl text-xs font-bold uppercase focus:border-blue-500 outline-none"
                  />
                  <p className="text-[8px] font-medium text-slate-400 uppercase">
                    Esta justificación quedará asentada formalmente en la bitácora administrativa de tu expediente.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-2">
                    Jornadas incluidas en la solicitud de auditoría ({missingSlots.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {missingSlots.map(s => (
                      <span key={s.id} className="px-2.5 py-1 bg-white border rounded-lg text-[9px] font-mono font-bold text-slate-700">
                        {s.dateFormatted} • {s.shiftLabel.split(' - ')[1] || s.shiftLabel}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {validationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                  <p className="text-[10px] font-black text-red-600 uppercase">{validationError}</p>
                </div>
              )}

              {/* BOTONES ACCIÓN */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('selection')}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-wider cursor-pointer"
                >
                  Volver a Opciones
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReview}
                  disabled={isSubmitting}
                  className="flex-2 py-4 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl shadow-blue-700/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>📤</span> Enviar Solicitud a Administración
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RetroactiveAttendanceModal;
