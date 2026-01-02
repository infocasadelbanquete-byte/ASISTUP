
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

export interface AbsenceRecord {
  id: string;
  date: string;
  type: 'Falta' | 'Permiso' | 'Atraso';
  reason: string;
  justified: boolean;
  documentUrl?: string;
}

// Added missing AttendanceRecord interface to fix importation errors in App.tsx and other views
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  timestamp: string;
  type: 'in' | 'out';
}

// Added missing Payment interface to fix importation errors across the application modules
export interface Payment {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  month: string;
  year: string;
  type: 'Salary' | 'Loan' | 'Bonus' | 'Settlement' | 'Emergency';
  method: 'Efectivo' | 'Transferencia' | 'Cheque';
  concept: string;
  status: 'paid' | 'void';
  balanceAfter?: number;
  isPartial?: boolean;
  voidJustification?: string;
  bankSource?: string;
}

export interface Employee {
  id: string;
  name: string;
  surname: string;
  identification: string;
  birthDate: string;
  origin: string;
  address: string;
  phone: string; // Celular strictly 10 digits
  email: string;
  bloodType: BloodType;
  emergencyContact: { name: string; phone: string; };
  startDate: string;
  role: Role;
  // Laboral
  isFixed: boolean;
  salary: number;
  isAffiliated: boolean;
  overSalaryType: 'accumulate' | 'monthly' | 'none';
  bankInfo: { 
    ifi: string; 
    type: 'Ahorros' | 'Corriente'; 
    account: string; 
  };
  photo: string;
  pin: string; // 6 digits
  pinChanges: number;
  status: 'active' | 'terminated';
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
  ruc: string; // 13 digits, ends in 001
  address: string;
  phone: string; // Fixed 9 or Mobile 10
  email: string;
  logo: string;
}

// Updated GlobalSettings to include the schedule property used in App.tsx
export interface GlobalSettings {
  sbu: number; // 2026: 475.00 default
  iessRate: number;
  reserveRate: number;
  schedule?: {
    weekdays: {
      morning: { start: string; end: string; enabled: boolean };
      afternoon: { start: string; end: string; enabled: boolean };
    };
    saturdays: {
      morning: { start: string; end: string; enabled: boolean };
      afternoon: { start: string; end: string; enabled: boolean };
    };
  };
}
