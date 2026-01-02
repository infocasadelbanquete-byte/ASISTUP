
import React, { useState, useMemo } from 'react';
import { Employee, Payment, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface PaymentsModuleProps {
  employees: Employee[];
  payments: Payment[];
  onUpdate: (payments: Payment[]) => void;
  role: Role;
}

const PaymentsModule: React.FC<PaymentsModuleProps> = ({ employees, payments, onUpdate, role }) => {
  return (
    <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight mb-4">Departamento Financiero</h2>
      <p className="text-sm text-gray-500 mb-6">Control de tesorería, egresos y comprobantes de pago.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pagos</p>
          <p className="text-2xl font-black text-slate-900">{payments.length}</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentsModule;
