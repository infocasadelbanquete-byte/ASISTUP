import React from 'react';
import { Employee, CompanyConfig, GlobalSettings, AttendanceRecord, Payment, VacationRecord } from '../types.ts';

interface EmployeeFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  company: CompanyConfig | null;
  settings?: GlobalSettings;
  attendance?: AttendanceRecord[];
  payments?: Payment[];
}

const EmployeeFileModal: React.FC<EmployeeFileModalProps> = ({
  isOpen,
  onClose,
  employee,
  company,
  settings,
  attendance = [],
  payments = []
}) => {
  if (!isOpen || !employee) return null;

  // Cálculo de tiempo de servicio
  const calculateTenure = () => {
    if (!employee.startDate) {
      return { years: 0, months: 0, days: 0 };
    }
    const start = new Date(employee.startDate + 'T00:00:00');
    if (isNaN(start.getTime())) {
      return { years: 0, months: 0, days: 0 };
    }
    const end = employee.status === 'terminated' && employee.terminationDate
      ? new Date(employee.terminationDate + 'T00:00:00')
      : new Date();
    if (isNaN(end.getTime())) {
      return { years: 0, months: 0, days: 0 };
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    return {
      years: Math.max(0, years || 0),
      months: Math.max(0, months || 0),
      days: Math.max(0, days || 0)
    };
  };

  const tenure = calculateTenure();

  // Cálculo de edad
  const calculateAge = (birthDateStr?: string) => {
    if (!birthDateStr) return 'N/R';
    const bDate = new Date(birthDateStr + 'T00:00:00');
    if (isNaN(bDate.getTime())) return 'N/R';
    const today = new Date();
    let age = today.getFullYear() - bDate.getFullYear();
    const m = today.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
      age--;
    }
    return age > 0 ? `${age} años` : 'N/R';
  };

  // Historial de vacaciones gozadas
  const totalVacationDaysEnjoyed = (employee.vacations || []).reduce((acc: number, v: VacationRecord) => acc + (v.days || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto print:static print:p-0 print:m-0 print:bg-transparent print:backdrop-blur-none">
      <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 print:shadow-none print:border-none print:w-full print:max-w-none print:overflow-visible print:max-h-none print:rounded-none">

        {/* BARRA SUPERIOR DE ACCIONES (NO-PRINT) */}
        <div className="p-5 md:p-6 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-xl shadow-lg">📋</span>
            <div>
              <h3 className="text-base font-[950] uppercase tracking-tight leading-none">
                Ficha Individual del Colaborador
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Expediente Institucional Completo • Formato Oficial de Hoja A4
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🖨️</span> Imprimir Ficha Oficial A4
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-lg transition-all cursor-pointer"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: HOJA A4 IMPRIMIBLE */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scroll flex-1 print:p-0 print:overflow-visible">
          <div
            id="employee-file-print"
            className="a4-sheet bg-white p-6 sm:p-10 md:p-12 border-2 border-slate-900 shadow-2xl print:shadow-none print:border-none print:p-0 print:m-0 space-y-6 text-slate-900"
          >
            {/* ENCABEZADO INSTITUCIONAL */}
            <div className="border-b-2 border-slate-900 pb-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 border-2 border-slate-900 rounded-xl flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
                    {company?.logo ? (
                      <img src={company.logo} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <span className="font-[950] text-xl text-slate-800">EMPRESA</span>
                    )}
                  </div>
                  <div>
                    <h1 className="text-lg md:text-xl font-[950] tracking-tight uppercase text-slate-900 leading-none">
                      {company?.name || 'EMPRESA INSTITUCIONAL S.A.'}
                    </h1>
                    <p className="text-[10px] font-bold text-slate-600 uppercase mt-1">
                      RUC: {company?.ruc || '1790000000001'} • Rep. Legal: {company?.legalRep || 'Gerencia General'}
                    </p>
                    <p className="text-[9px] font-medium text-slate-500 uppercase">
                      {company?.address || 'Ecuador'} • Tel: {company?.phone || '022000000'} • Email: {company?.email || 'rrhh@empresa.com'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg tracking-widest block">
                    EXPEDIENTE RH
                  </span>
                  <p className="text-[9px] font-mono font-bold text-slate-500 mt-2">
                    ID: {employee.identification}
                  </p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                    Emisión: {new Date().toLocaleDateString('es-EC')}
                  </p>
                </div>
              </div>

              <div className="text-center mt-5 pt-3 border-t border-slate-200">
                <h2 className="text-sm md:text-base font-[950] uppercase tracking-wide text-slate-900">
                  FICHA INDIVIDUAL Y EXPEDIENTE LABORAL DE PERSONAL
                </h2>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                  Conforme a la legislación laboral del Código del Trabajo y Sistema de Seguridad Social del Ecuador
                </p>
              </div>
            </div>

            {/* SECCIÓN 1: FOTO Y DATOS PERSONALES */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-300">
              <h3 className="text-[10px] font-black text-blue-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-1.5">
                <span>👤</span> I. DATOS GENERALES Y DE IDENTIFICACIÓN PERSONAL
              </h3>

              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="w-24 h-28 bg-white rounded-xl border-2 border-slate-300 overflow-hidden flex items-center justify-center shrink-0 shadow-sm mx-auto sm:mx-0">
                  {employee.photo ? (
                    <img src={employee.photo} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-slate-400">{employee.name?.[0] || 'E'}</span>
                  )}
                </div>

                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-2.5 text-[10px] uppercase font-bold">
                  <div>
                    <span className="text-[8px] font-black text-slate-400 block">Apellidos y Nombres:</span>
                    <span className="text-slate-900 font-black text-xs">{employee.surname} {employee.name}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-400 block">N° Cédula / Identificación:</span>
                    <span className="text-slate-900 font-mono font-black">{employee.identification}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-400 block">Nacionalidad / Origen:</span>
                    <span className="text-slate-800">{employee.origin || 'ECUATORIANA'}</span>
                  </div>

                  <div>
                    <span className="text-[8px] font-black text-slate-400 block">Fecha de Nacimiento:</span>
                    <span className="text-slate-800">{employee.birthDate || 'N/R'} ({calculateAge(employee.birthDate)})</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-400 block">Género / Estado Civil:</span>
                    <span className="text-slate-800">{employee.gender || 'N/R'} • {employee.civilStatus || 'N/R'}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-400 block">Tipo de Sangre:</span>
                    <span className="text-red-700 font-mono font-black">{employee.bloodType || 'O+'}</span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[8px] font-black text-slate-400 block">Dirección Domiciliaria:</span>
                    <span className="text-slate-800">{employee.address || 'NO REGISTRADA'}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-400 block">Teléfono / Celular:</span>
                    <span className="text-slate-800 font-mono">{employee.phone || 'N/R'}</span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[8px] font-black text-slate-400 block">Correo Electrónico:</span>
                    <span className="text-slate-800 lowercase">{employee.email || 'N/R'}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-400 block">Contacto de Emergencia:</span>
                    <span className="text-slate-800">{employee.emergencyContact?.name || 'N/R'} {employee.emergencyContact?.phone ? `(${employee.emergencyContact.phone})` : ''}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: VINCULACIÓN LABORAL Y CONTRATACIÓN */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-300">
              <h3 className="text-[10px] font-black text-blue-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-1.5">
                <span>💼</span> II. CONDICIONES LABORALES, CARGO Y REMUNERACIÓN
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] uppercase font-bold">
                <div>
                  <span className="text-[8px] font-black text-slate-400 block">Cargo Desempeñado:</span>
                  <span className="text-blue-700 font-black text-xs">{employee.role}</span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 block">Modalidad de Contratación:</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black ${employee.isFixed !== false ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                    {employee.isFixed !== false ? 'TRABAJADOR FIJO (INDEFINIDO)' : 'TRABAJADOR TEMPORAL (EVENTUAL)'}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 block">Fecha de Ingreso:</span>
                  <span className="text-slate-900 font-mono font-black">{employee.startDate}</span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 block">Tiempo de Servicio:</span>
                  <span className="text-slate-900 font-black">{tenure.years} años, {tenure.months} m, {tenure.days} d</span>
                </div>

                <div>
                  <span className="text-[8px] font-black text-slate-400 block">Sueldo Base Mensual:</span>
                  <span className="text-emerald-700 font-mono font-black text-xs">${employee.salary?.toFixed(2) || '482.00'}</span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 block">Estado Laboral Actual:</span>
                  <span className={`font-black ${employee.status === 'active' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {employee.status === 'active' ? '✓ ACTIVO REGULAR' : `✕ DESVINCULADO (${employee.terminationDate || ''})`}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[8px] font-black text-slate-400 block">Acreditación Bancaria:</span>
                  <span className="text-slate-800">
                    {employee.bankInfo?.ifi ? `${employee.bankInfo.ifi} • ${employee.bankInfo.type} • Cta: ${employee.bankInfo.account}` : 'PAGO POR CHEQUE / EFECTIVO'}
                  </span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: SEGURIDAD SOCIAL Y BENEFICIOS DE LEY */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-300">
              <h3 className="text-[10px] font-black text-blue-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-1.5">
                <span>🛡️</span> III. SEGURIDAD SOCIAL Y PRESTACIONES LEGALES (CRITERIO ADMINISTRATIVO)
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] uppercase font-bold">
                <div>
                  <span className="text-[8px] font-black text-slate-400 block">Afiliación al IESS:</span>
                  <span className={`font-black ${employee.isAffiliated ? 'text-blue-700' : 'text-slate-500'}`}>
                    {employee.isAffiliated ? '✓ AFILIADO ACTIVO (9.45% / 11.15%)' : '✕ NO APLICA / SIN APORTACIÓN'}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 block">Fondos de Reserva:</span>
                  <span className="text-slate-800">
                    {employee.reserveFundType === 'monthly' ? 'MENSUALIZADO (8.33%)' : employee.reserveFundType === 'accumulate' ? 'ACUMULAR EN IESS' : 'DESACTIVADO / NO APLICA'}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 block">Décimos Sueldos (13° y 14°):</span>
                  <span className="text-slate-800">
                    {employee.overSalaryType === 'monthly' ? 'MENSUALIZADOS' : employee.overSalaryType === 'accumulate' ? 'ACUMULADOS ANUALES' : 'DESACTIVADOS / NO APLICA'}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 block">Acceso Panel Asistencia:</span>
                  <span className="text-slate-800 font-mono">
                    PIN: {employee.pin ? '•••••• (CONFIGURADO)' : 'PENDIENTE'} {employee.pinNeedsReset ? '• PIDE CAMBIO' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 4: CARGAS FAMILIARES E HIJOS (ART. 97 C.T. - UTILIDADES) */}
            <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-200">
              <div className="flex justify-between items-center border-b border-purple-200 pb-1.5 mb-3">
                <h3 className="text-[10px] font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>👨‍👩‍👧‍👦</span> IV. CARGAS FAMILIARES E HIJOS (CÁLCULO DE UTILIDADES - ART. 97 CÓDIGO DEL TRABAJO)
                </h3>
                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  {employee.children?.length || 0} HIJOS ACREDITADOS
                </span>
              </div>

              {employee.children && employee.children.length > 0 ? (
                <div className="space-y-2">
                  <table className="w-full text-left border-collapse text-[9px] uppercase font-bold">
                    <thead className="bg-purple-100/70 text-purple-950 font-black">
                      <tr>
                        <th className="p-2 border border-purple-200 w-10 text-center">#</th>
                        <th className="p-2 border border-purple-200">Nombres y Apellidos Completos</th>
                        <th className="p-2 border border-purple-200 w-24 text-center">Edad (Años)</th>
                        <th className="p-2 border border-purple-200 w-32 text-center">N° Cédula</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100 bg-white">
                      {employee.children.map((ch, idx) => (
                        <tr key={ch.id || idx}>
                          <td className="p-2 border border-purple-200 text-center font-black">{idx + 1}</td>
                          <td className="p-2 border border-purple-200 text-slate-900 font-black">{ch.fullName || ch.name || 'HIJO REGISTRADO'}</td>
                          <td className="p-2 border border-purple-200 text-center font-mono">{ch.age} AÑOS</td>
                          <td className="p-2 border border-purple-200 text-center font-mono">{ch.identification || 'S/N'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[8px] font-bold text-purple-800 uppercase italic">
                    * Cargas acreditadas ante el Ministerio del Trabajo para la liquidación proporcional del 5% del fondo de utilidades legales.
                  </p>
                </div>
              ) : (
                <p className="text-[9px] font-bold text-slate-500 uppercase italic">
                  El colaborador no registra hijos ni cargas familiares declaradas para el reparto del 5% de utilidades.
                </p>
              )}
            </div>

            {/* SECCIÓN 5: HISTORIAL ADMINISTRATIVO (VACACIONES, NOVEDADES Y BAJA) */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-300">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-3 flex items-center gap-1.5">
                <span>📝</span> V. HISTORIAL ADMINISTRATIVO, VACACIONES Y NOVEDADES
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[9px] uppercase font-bold">
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[8px] font-black text-emerald-700 block">VACACIONES GOZADAS:</span>
                  <p className="text-slate-800">
                    Total días disfrutados: <strong className="text-emerald-800">{totalVacationDaysEnjoyed} días</strong>
                  </p>
                  {employee.vacations && employee.vacations.length > 0 ? (
                    <ul className="text-[8px] text-slate-600 list-disc list-inside mt-1 space-y-0.5">
                      {employee.vacations.slice(-3).map((v: VacationRecord, i: number) => (
                        <li key={i}>{v.startDate} al {v.endDate}: {v.days} días {v.notes ? `(${v.notes})` : ''}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[8px] text-slate-400 italic">Sin registros de vacaciones gozadas.</p>
                  )}
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[8px] font-black text-blue-700 block">BITÁCORA Y NOVEDADES:</span>
                  {employee.observations && employee.observations.length > 0 ? (
                    <ul className="text-[8px] text-slate-600 list-disc list-inside space-y-0.5">
                      {employee.observations.slice(-3).map((obs, i) => (
                        <li key={i}>{obs.date ? `${obs.date.split('T')[0]}: ` : ''}{obs.text || obs.observation}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[8px] text-slate-400 italic">Sin incidencias registradas en bitácora.</p>
                  )}
                </div>
              </div>

              {employee.status === 'terminated' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-[9px] uppercase font-bold">
                  <span className="text-red-700 font-black block">REGISTRO DE DESVINCULACIÓN LABORAL:</span>
                  <p className="text-red-900 mt-0.5">
                    Fecha de Salida: {employee.terminationDate} • Causal: {employee.terminationReason}
                  </p>
                  {employee.terminationDetails && (
                    <p className="text-red-800 italic mt-0.5">"{employee.terminationDetails}"</p>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN 6: DECLARACIÓN Y FIRMAS REGLAMENTARIAS */}
            <div className="pt-6 border-t-2 border-slate-900 avoid-break">
              <p className="text-[8px] font-medium leading-relaxed text-slate-600 uppercase text-justify mb-6">
                <strong>DECLARACIÓN DE VERACIDAD Y CONFORMIDAD INSTITUCIONAL:</strong> Los datos y condiciones contractuales contenidos en la presente ficha individual reflejan fielmente el expediente laboral del colaborador registrado en la base de datos de la empresa, conforme a lo establecido en el Código del Trabajo y resoluciones del Instituto Ecuatoriano de Seguridad Social (IESS).
              </p>

              <div className="grid grid-cols-3 gap-8 text-center text-[9px] uppercase font-bold">
                <div className="space-y-1">
                  <div className="h-14 flex items-end justify-center">
                    <div className="w-36 border-b-2 border-slate-900"></div>
                  </div>
                  <p className="font-black text-slate-900">{employee.surname} {employee.name}</p>
                  <p className="text-[8px] text-slate-500 font-black">FIRMA DEL COLABORADOR</p>
                  <p className="text-[7px] text-slate-400 font-mono">CI: {employee.identification}</p>
                </div>

                <div className="space-y-1">
                  <div className="h-14 flex items-end justify-center">
                    <div className="w-36 border-b-2 border-slate-900"></div>
                  </div>
                  <p className="font-black text-slate-900">TALENTO HUMANO</p>
                  <p className="text-[8px] text-slate-500 font-black">REVISADO Y AUDITADO</p>
                  <p className="text-[7px] text-slate-400">Archivo General de Personal</p>
                </div>

                <div className="space-y-1">
                  <div className="h-14 flex items-end justify-center">
                    <div className="w-36 border-b-2 border-slate-900"></div>
                  </div>
                  <p className="font-black text-slate-900">{company?.legalRep || 'GERENCIA GENERAL'}</p>
                  <p className="text-[8px] text-slate-500 font-black">REPRESENTANTE LEGAL</p>
                  <p className="text-[7px] text-slate-400 font-mono">RUC: {company?.ruc || '1790000000001'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PIE DEL MODAL (NO-PRINT) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center no-print shrink-0">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            AsistUp RH Enterprise • Ficha Laboral A4
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase text-[10px] tracking-wider cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeFileModal;
