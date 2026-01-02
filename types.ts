
export enum Role {
  SUPER_ADMIN = 'Super Administrador',
  PARTIAL_ADMIN = 'Administrador Parcial',
  EMPLOYEE = 'Empleado'
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

export interface CompanyConfig {
  name: string;
  legalRep: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
}

export interface Observation {
  date: string;
  text: string;
}

export interface AbsenceJustification {
  date: string;
  documentUrl?: string;
  reason: string;
  type: 'Falta' | 'Atraso' | 'Permiso';
}

export interface Employee {
  id: string;
  name: string;
  identification: string;
  birthDate: string;
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
  overSalaryType: 'accumulate' | 'monthly' | 'none';
  bankInfo: { ifi: string; type: 'Ahorros' | 'Corriente'; account: string; };
  photo: string;
  pin: string;
  pinChanges: number;
  status: 'active' | 'terminated';
  terminationDate?: string;
  terminationReason?: string;
  terminationDetails?: string;
  totalHoursWorked: number;
  observations: Observation[];
  justifications: AbsenceJustification[];
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  timestamp: string;
  type: 'in' | 'out';
}

export interface Payment {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  month: string;
  year: string;
  type: 'Salary' | 'OverSalary' | 'Loan' | 'Emergency' | 'Bonus' | 'Vacation' | 'Settlement' | 'Compensation';
  overSalaryType?: '13vo' | '14vo' | 'Vacaciones' | 'Fondos de Reserva';
  method: 'Efectivo' | 'Cheque' | 'Transferencia';
  bankSource?: 'Banco del Austro' | 'Banco Guayaquil';
  concept: string;
  status: 'paid' | 'void';
  voidJustification?: string;
  isPartial?: boolean;
  balanceAfter?: number;
}

export interface WorkShift {
  start: string;
  end: string;
  enabled: boolean;
}

export interface DaySchedule {
  morning: WorkShift;
  afternoon: WorkShift;
}

export interface GlobalSettings {
  sbu: number;
  iessRate: number; // 9.45%
  reserveRate: number; // 8.33%
  schedule: {
    weekdays: DaySchedule;
    saturdays: DaySchedule;
  };
}
