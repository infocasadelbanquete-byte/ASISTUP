import React, { useState, useEffect } from 'react';
import { CompanyConfig, Role } from '../../types.ts';
import Modal from '../../components/Modal.tsx';

interface CompanyModuleProps {
  company: CompanyConfig | null;
  onUpdate: (config: CompanyConfig) => void;
  role: Role;
}

const CompanyModule: React.FC<CompanyModuleProps> = ({ company, onUpdate, role }) => {
  const [formData, setFormData] = useState<CompanyConfig>({
    name: '', legalRep: '', ruc: '', address: '', phone: '', email: '', logo: ''
  });

  useEffect(() => {
    if (company) setFormData(company);
  }, [company]);

  const canEdit = role === Role.SUPER_ADMIN;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return alert("Solo el Super Administrador puede editar los datos de la empresa.");
    
    // Validaciones estrictas
    if (formData.ruc.length !== 13 || !formData.ruc.endsWith('001')) {
      return alert("El RUC debe tener estrictamente 13 dígitos y terminar en '001'.");
    }
    
    const isMobile = formData.phone.startsWith('09');
    if (isMobile && formData.phone.length !== 10) {
      return alert("El celular debe tener estrictamente 10 dígitos.");
    }
    if (!isMobile && formData.phone.length !== 9) {
      return alert("El teléfono fijo debe tener estrictamente 9 dígitos.");
    }

    onUpdate(formData);
    alert("Datos de la empresa actualizados correctamente.");
  };

  return (
    <div className="max-w-4xl mx-auto glass-card p-10 rounded-[3rem] shadow-xl fade-in">
      <div className="flex items-center gap-6 mb-10 pb-6 border-b">
        <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center overflow-hidden border">
           {formData.logo ? <img src={formData.logo} className="w-full h-full object-cover" /> : <span className="text-4xl">🏢</span>}
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Configuración Empresarial</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Identidad y Datos Legales</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Nombre Comercial (Fantasía)</label>
          <input required disabled={!canEdit} className="w-full p-4 rounded-2xl border-2 bg-slate-50 focus:border-blue-500 outline-none transition-all disabled:opacity-50" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Representante Legal</label>
          <input required disabled={!canEdit} className="w-full p-4 rounded-2xl border-2 bg-slate-50 focus:border-blue-500 outline-none transition-all disabled:opacity-50" value={formData.legalRep} onChange={e => setFormData({...formData, legalRep: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">RUC (13 dígitos, fin 001)</label>
          <input required maxLength={13} disabled={!canEdit} className="w-full p-4 rounded-2xl border-2 bg-slate-50 font-mono tracking-widest disabled:opacity-50" value={formData.ruc} onChange={e => setFormData({...formData, ruc: e.target.value.replace(/\D/g,'')})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Teléfono / Celular</label>
          <input required maxLength={10} disabled={!canEdit} className="w-full p-4 rounded-2xl border-2 bg-slate-50 disabled:opacity-50" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Dirección de Domicilio</label>
          <input required disabled={!canEdit} className="w-full p-4 rounded-2xl border-2 bg-slate-50 disabled:opacity-50" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Correo Electrónico</label>
          <input required type="email" disabled={!canEdit} className="w-full p-4 rounded-2xl border-2 bg-slate-50 disabled:opacity-50" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">URL Logotipo</label>
          <input disabled={!canEdit} className="w-full p-4 rounded-2xl border-2 bg-slate-50 disabled:opacity-50" value={formData.logo} onChange={e => setFormData({...formData, logo: e.target.value})} />
        </div>

        {canEdit && (
          <div className="md:col-span-2 pt-6">
            <button type="submit" className="w-full py-5 bg-blue-700 text-white font-black rounded-3xl shadow-xl hover:bg-blue-800 transition-all uppercase text-xs tracking-widest">Guardar Información Corporativa</button>
          </div>
        )}
      </form>
    </div>
  );
};

export default CompanyModule;