
import React, { useState } from 'react';
import { Employee, Payment, CompanyConfig, GlobalSettings, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface PayrollModuleProps {
  employees: Employee[];
  payments: Payment[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
  role: Role;
}

const PayrollModule: React.FC<PayrollModuleProps> = ({ employees, payments, company, settings, role }) => {
  return (
    <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight mb-4">Gestión de Nómina</h2>
      <p className="text-sm text-gray-500 mb-6">Generación y control de pagos y provisiones mensuales.</p>
      
      <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
        <p className="text-blue-800 font-medium text-sm">Módulo de cálculo de haberes activo bajo parámetros SBU ${settings.sbu}.</p>
      </div>
    </div>
  );
};

export default PayrollModule;
