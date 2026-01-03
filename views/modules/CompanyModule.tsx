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
  const [modalFeedback, setModalFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'info' | 'success' | 'error'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });

  useEffect(() => {
    if (company) setFormData(company);
  }, [company]);

  const canEdit = role === Role.SUPER_ADMIN;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setModalFeedback({ isOpen: true, title: "Acceso Denegado", message: "Solo el Super Administrador puede editar los datos de la empresa.", type: "error" });
      return;
    }
    
    if (formData.ruc.length !== 13 || !formData.ruc.endsWith('001')) {
      setModalFeedback({ isOpen: true, title: "Dato Inválido", message: "El RUC debe tener estrictamente 13 dígitos y terminar en '001'.", type: "error" });
      return;
    }
    
    const isMobile = formData.phone.startsWith('09');
    if (isMobile && formData.phone.length !== 10) {
      setModalFeedback({ isOpen: true, title: "Dato Inválido", message: "El celular debe tener estrictamente 10 dígitos.", type: "error" });
      return;
    }
    if (!isMobile && formData.phone.length !== 9) {
      setModalFeedback({ isOpen: true, title: "Dato Inválido", message: "El teléfono fijo debe tener estrictamente 9 dígitos.", type: "error" });
      return;
    }

    onUpdate(formData);
    setModalFeedback({ isOpen: true, title: "Actualización Exitosa", message: "Los datos corporativos han sido sincronizados correctamente.", type: "success" });
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100 fade-in">
      <div className="flex flex-col md:flex-row items-center gap-6 mb-10 pb-6 border-b">
        <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center overflow-hidden border border-slate-100">
           {formData.logo ? <img src={formData.logo} className="w-full h-full object-cover" /> : <span className="text-4xl">🏢</span>}
        </div>
        <div className="text-center md:text-left">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Configuración Institucional</h2>
          <p className="text-slate-400 font-bold text-[9px] md:text-[10px] uppercase tracking-widest mt-1">Identidad Legal y Corporativa</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-1">
          <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Nombre Comercial</label>
          <input required disabled={!canEdit} className="w-full p-4 rounded-xl border-2 bg-slate-50 focus:border-blue-500 outline-none transition-all disabled:opacity-50 text-xs font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Representante Legal</label>
          <input required disabled={!canEdit} className="w-full p-4 rounded-xl border-2 bg-slate-50 focus:border-blue-500 outline-none transition-all disabled:opacity-50 text-xs font-bold" value={formData.legalRep} onChange={e => setFormData({...formData, legalRep: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest">RUC (13 dígitos)</label>
          <input required maxLength={13} disabled={!canEdit} className="w-full p-4 rounded-xl border-2 bg-slate-50 font-mono tracking-widest text-xs font-bold disabled:opacity-50" value={formData.ruc} onChange={e => setFormData({...formData, ruc: e.target.value.replace(/\D/g,'')})} />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Teléfono Directo</label>
          <input required maxLength={10} disabled={!canEdit} className="w-full p-4 rounded-xl border-2 bg-slate-50 text-xs font-bold disabled:opacity-50" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g,'')})} />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Dirección Matriz</label>
          <input required disabled={!canEdit} className="w-full p-4 rounded-xl border-2 bg-slate-50 text-xs font-bold disabled:opacity-50" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Correo de Gestión</label>
          <input required type="email" disabled={!canEdit} className="w-full p-4 rounded-xl border-2 bg-slate-50 text-xs font-bold disabled:opacity-50" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Enlace de Logotipo (URL)</label>
          <input disabled={!canEdit} className="w-full p-4 rounded-xl border-2 bg-slate-50 text-xs font-bold disabled:opacity-50" value={formData.logo} onChange={e => setFormData({...formData, logo: e.target.value})} />
        </div>

        {canEdit && (
          <div className="md:col-span-2 pt-6">
            <button type="submit" className="w-full py-5 bg-blue-700 text-white font-black rounded-2xl shadow-xl hover:bg-blue-800 transition-all uppercase text-[10px] tracking-[0.2em] active:scale-95">Guardar Cambios Institucionales</button>
          </div>
        )}
      </form>

      <Modal isOpen={modalFeedback.isOpen} onClose={() => setModalFeedback({...modalFeedback, isOpen: false})} title={modalFeedback.title} type={modalFeedback.type}>
          <div className="text-center space-y-6">
              <p className="text-slate-600 font-medium italic">{modalFeedback.message}</p>
              <button onClick={() => setModalFeedback({...modalFeedback, isOpen: false})} className="w-full py-3 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest">Entendido</button>
          </div>
      </Modal>
    </div>
  );
};

export default CompanyModule;