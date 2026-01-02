
import React, { useState, useRef } from 'react';
import { Employee, Role, BloodType, TerminationReason, AttendanceRecord, Payment, Observation } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface EmployeeModuleProps {
  employees: Employee[];
  onUpdate: (employees: Employee[]) => void;
  role: Role;
  attendance: AttendanceRecord[];
  payments: Payment[];
}

const EmployeeModule: React.FC<EmployeeModuleProps> = ({ employees, onUpdate, role, attendance, payments }) => {
  return (
    <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight mb-4">Módulo de Recursos Humanos</h2>
      <p className="text-sm text-gray-500 mb-6">Gestión de empleados y talento humano institucional.</p>
      
      <div className="grid gap-4">
        {employees.length === 0 ? (
          <p className="text-gray-400 italic text-sm">No hay empleados registrados.</p>
        ) : (
          employees.map(emp => (
            <div key={emp.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800">{emp.name}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{emp.role}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {emp.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EmployeeModule;
