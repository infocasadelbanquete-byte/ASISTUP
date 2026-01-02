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
    name: '',
    legalRep: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    logo: ''
  });
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  useEffect(() => {
    if (company) setFormData(company);
  }, [company]);

  const isEditable = role === Role.SUPER_ADMIN;

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return;
    
    // Validación Estricta de RUC
    if (!/^\d{13}$/.test(formData.ruc) || !formData.ruc.endsWith('001')) {
      alert('ERROR: El RUC debe ser estrictamente de 13 dígitos y sus últimos dígitos deben ser "001".');
      return;
    }
    
    // Validación Estricta de Teléfono
    const phoneLen = formData.phone.length;
    if (phoneLen !== 9 && phoneLen !== 10) {
      alert('ERROR: Teléfono fijo debe ser estrictamente de 9 dígitos; celular debe ser estrictamente de 10 dígitos.');
      return;
    }
    
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSave = () => {
    onUpdate(formData);
    setIsConfirmModalOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Configuración de Empresa</h2>
          <p className="text-sm text-gray-500">Datos legales y administrativos</p>
        </div>
        <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-200 overflow-hidden">
           {formData.logo ? <img src={formData.logo} className="w-full h-full object-cover" alt="Logo" /> : <span className="font-bold text-2xl">UP</span>}
        </div>
      </div>

      <form onSubmit={handleOpenConfirm} className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Nombre Comercial (Fantasía)</label>
            <input 
              disabled={!isEditable}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Representante Legal</label>
            <input 
              disabled={!isEditable}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50"
              value={formData.legalRep}
              onChange={e => setFormData({...formData, legalRep: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest">RUC (13 dígitos, fin 001)</label>
            <input 
              disabled={!isEditable}
              required
              maxLength={13}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 font-mono tracking-widest focus:border-blue-500 outline-none disabled:bg-gray-50"
              value={formData.ruc}
              onChange={e => setFormData({...formData, ruc: e.target.value.replace(/\D/g, '')})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Teléfono / Celular (9 o 10 dig)</label>
            <input 
              disabled={!isEditable}
              required
              maxLength={10}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none disabled:bg-gray-50"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})}
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Dirección de Domicilio</label>
            <input 
              disabled={!isEditable}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none disabled:bg-gray-50"
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Correo Electrónico</label>
            <input 
              disabled={!isEditable}
              required
              type="email"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none disabled:bg-gray-50"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest">URL Logotipo</label>
            <input 
              disabled={!isEditable}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none disabled:bg-gray-50"
              value={formData.logo}
              onChange={e => setFormData({...formData, logo: e.target.value})}
            />
          </div>
        </div>

        {isEditable && (
          <div className="pt-6 border-t flex justify-end">
            <button 
              type="submit"
              className="px-10 py-4 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95"
            >
              Guardar Datos Empresa
            </button>
          </div>
        )}
      </form>

      <Modal 
        isOpen={isConfirmModalOpen} 
        onClose={() => setIsConfirmModalOpen(false)} 
        title="Confirmar Actualización"
        type="info"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setIsConfirmModalOpen(false)} className="px-6 py-2 text-gray-400 font-bold text-xs uppercase">Cancelar</button>
            <button onClick={handleConfirmSave} className="px-8 py-2 bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-lg">Confirmar</button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 font-medium">¿Está seguro de que desea actualizar la información de la empresa? Esto afectará los documentos legales generados.</p>
      </Modal>
    </div>
  );
};

export default CompanyModule;