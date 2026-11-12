
export enum Role {
  SUPER_ADMIN = 'Super Administrador',
  PARTIAL_ADMIN = 'Administrador Parcial',
  EMPLOYEE = 'Empleado'
}

export enum Gender {
  MASCULINO = 'Masculino',
  FEMENINO = 'Femenino'
}

export enum CivilStatus {
  SOLTERO = 'Soltero/a',
  CASADO = 'Casado/a',
  DIVORCIADO = 'Divorciado/a',
  VIUDO = 'Viudo/a'
}

export enum BloodType {
  A_POS = 'A+', A_NEG = 'A-', B_POS = 'B+', B_NEG = 'B-',
  AB_POS = 'AB+', AB_NEG = 'AB-', O_POS = 'O+', O_NEG = 'O-'
}

export enum TerminationReason {
  VOLUNTARY = 'Renuncia Voluntaria',
  LAYOFF = 'Despido Intempestivo',
  MUTUAL_AGREEMENT = 'Mutuo Acuerdo',
  UNILATERAL = 'Terminación Unilateral',
  BILATERAL = 'Terminación Bilateral',
  VISTO_BUENO = 'Visto Bueno',
  TRIAL_PERIOD = 'Fin Período de Prueba',
  OTHER = 'Otro'
}

export interface SettlementRubrics {
  workedDaysInMonth: number;
  proportionalSalary: number;
  thirteenthSalary: number;
  thirteenthDays: number;
  fourteenthSalary: number;
  fourteenthDays: number;
  fourteenthRegion: 'sierra' | 'costa';
  vacationAmount: number;
  vacationPendingDays: number;
  vacationAccruedDays?: number;
  vacationEnjoyedDays?: number;
  desahucioAmount: number;
  yearsOfService: number;
  completedYears: number;
  layoffIndemnity: number; // Art. 188 Código de Trabajo
  reserveFunds: number;
  otherBonuses: number;
  otherBonusesReason: string;
  // Deducciones
  iessContribution: number;
  advancesDiscount: number;
  otherDiscounts: number;
  otherDiscountsReason: string;
  // Totales
  totalEarnings: number;
  totalDeductions: number;
  netPayable: number;
}

export interface SettlementRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCedula: string;
  employeeRole: string;
  companyName: string;
  companyRuc: string;
  companyLegalRep: string;
  companyAddress: string;
  startDate: string;
  terminationDate: string;
  tenureYears: number;
  tenureMonths: number;
  tenureDays: number;
  baseSalary: number;
  reason: TerminationReason | string;
  notes: string;
  rubrics: SettlementRubrics;
  status: 'draft' | 'confirmed';
  confirmedAt?: string;
  confirmedBy?: string;
  voucherCode?: string;
}

export interface NotificationMessage {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'alert' | 'critical';
  isRead: boolean;
  isProcessed: boolean;
}

export interface AbsenceRecord {
  id: string;
  date: string;
  type: 'Falta' | 'Permiso' | 'Atraso';
  reason: string;
  justified: boolean;
  documentUrl?: string;
}

export interface VacationRecord {
  id: string;
  startDate: string; // Fecha en la que inicia sus vacaciones
  endDate: string;   // Fecha en la que termina las mismas
  days: number;      // Días de vacaciones gozados
  notes?: string;
  registeredAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  timestamp: string;
  type: 'in' | 'out' | 'half_day';
  status: 'confirmed' | 'pending_approval' | 'rejected';
  isForgotten?: boolean;
  isLate?: boolean;
  isContinuousShift?: boolean;
  freeBreakMinutes?: number;
  justification?: string;
  validatedAt?: string;
}

export interface Payment {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  month: string;
  year: string;
  type: 'Salary' | 'Loan' | 'Bonus' | 'Settlement' | 'Emergency' | 'Thirteenth' | 'Fourteenth' | 'Vacation' | 'ExtraHours' | 'BackPay' | 'SalaryBalance' | 'Advance' | 'Fine';
  method: 'Efectivo' | 'Transferencia' | 'Cheque' | 'Dual';
  concept: string;
  status: 'paid' | 'void';
  voucherCode?: string;
  bankSource?: 'Banco del Austro' | 'Banco Guayaquil';
  checkDetails?: {
    client: string;
    bank: string;
    number: string;
    value: number;
  };
  dualDetails?: {
    method1: 'Efectivo' | 'Transferencia' | 'Cheque';
    value1: number;
    method2: 'Efectivo' | 'Transferencia' | 'Cheque';
    value2: number;
    bankSource?: 'Banco del Austro' | 'Banco Guayaquil';
  };
  voidJustification?: string;
}

export interface EmployeeChild {
  id: string;
  fullName: string;
  name?: string;
  age: number;
  identification?: string;
  birthDate?: string;
}

export interface NovedadReason {
  id: string;
  name: string;
  isPermission: boolean;
  isCustom?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  surname: string;
  identification: string;
  birthDate: string;
  gender: Gender;
  civilStatus: CivilStatus;
  origin: string;
  address: string;
  phone: string;
  email: string;
  bloodType: BloodType;
  emergencyContact: { name: string; phone: string; };
  startDate: string;
  role: Role;
  isFixed: boolean;
  salary: number;
  isAffiliated: boolean;
  overSalaryType: 'accumulate' | 'monthly' | 'none'; // Para Décimos
  reserveFundType?: 'monthly' | 'accumulate' | 'none'; // Específico para Fondos de Reserva
  hasChildren?: boolean;
  childrenCount?: number;
  children?: EmployeeChild[];
  bankInfo: {
    ifi: string;
    type: 'Ahorros' | 'Corriente';
    account: string;
  };
  photo: string;
  pin: string;
  pinChanged: boolean;
  pinNeedsReset: boolean;
  pinResetRequested?: boolean;
  status: 'active' | 'terminated' | 'archived';
  terminationDate?: string;
  terminationReason?: string;
  terminationDetails?: string;
  observations: {
    id?: string;
    date: string;
    text: string;
    reason?: string;
    permissionType?: 'entero' | 'media_am' | 'media_pm' | 'horas' | string;
    permissionHours?: number;
    observation?: string;
  }[];
  absences: AbsenceRecord[];
  vacations?: VacationRecord[];
  totalHoursWorked: number;
  settlement?: SettlementRecord;
  regularizationApprovedNotice?: {
    id: string;
    approvedAt: string;
    message: string;
    count?: number;
    seen: boolean;
  };
}

export interface SavedReport {
  id: string;
  name: string;
  date: string;
  content: string;
  type: 'payroll';
  month?: string;
  year?: string;
}

export interface CompanyConfig {
  name: string;
  legalRep: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
}

export interface SystemUpdateConfig {
  version: string;
  releaseDate: string;
  title: string;
  description: string;
  changelog: string[];
  isMandatory: boolean;
  minVersionRequired?: string;
  publishedAt: string;
}

export interface GlobalSettings {
  sbu: number;
  sbuPrev: number;
  iessRate: number;
  reserveRate: number;
  holidays: string[];
  schedule: {
    monFri: { in1: string; out1: string; in2: string; out2: string };
    sat: { in: string; out: string };
    halfDayOff: string;
  };
  systemUpdate?: SystemUpdateConfig;
}
