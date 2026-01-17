
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
  LAYOFF = 'Despido',
  UNILATERAL = 'Terminación unilateral',
  BILATERAL = 'Terminación bilateral',
  VISTO_BUENO = 'Visto Bueno',
  OTHER = 'Otro'
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

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  timestamp: string;
  type: 'in' | 'out' | 'half_day';
  status: 'confirmed' | 'pending_approval' | 'rejected';
  isForgotten?: boolean;
  isLate?: boolean;
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
  observations: { date: string; text: string; }[];
  absences: AbsenceRecord[];
  totalHoursWorked: number;
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
}
