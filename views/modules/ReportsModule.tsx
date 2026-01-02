
import React, { useState, useMemo } from 'react';
import { Employee, Payment, AttendanceRecord, CompanyConfig, GlobalSettings } from '../../types.ts';

interface ReportsModuleProps {
  employees: Employee[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  company: CompanyConfig | null;
  settings: GlobalSettings;
}

const ReportsModule: React.FC<ReportsModuleProps> = ({ employees, payments, attendance, company, settings }) => {
  return (
    <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight mb-4">Centro de Reportes</h2>
      <p className="text-sm text-gray-500 mb-6">Métricas de asistencia, nómina y rendimiento organizacional.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">📊</div>
          <p className="font-bold text-slate-800">Reporte de Asistencia</p>
          <p className="text-xs text-slate-500 mt-1">Exportación de registros mensuales</p>
        </div>
        <div className="p-6 border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">💰</div>
          <p className="font-bold text-slate-800">Resumen de Nómina</p>
          <p className="text-xs text-slate-500 mt-1">Consolidado de pagos y aportes</p>
        </div>
      </div>
    </div>
  );
};

export default ReportsModule;
