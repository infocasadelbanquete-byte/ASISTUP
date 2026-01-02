
import React, { useState, useEffect } from 'react';
import { CompanyConfig, Role } from '../../types';
import Modal from '../../components/Modal';

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
    
    // Validate RUC: 13 digits and ends in 001
    if (!/^\d{13}$/.test(formData.ruc) || !formData.ruc.endsWith('001')) {
      alert('ERROR: El RUC debe tener estrictamente 13 dígitos numéricos y terminar en "001".');
      return;
    }
    
    // Validate Phone: Fixed 9 or Cell 10
    const phoneLen = formData.phone.length;
    if (phoneLen !== 9 && phoneLen !== 10) {
      alert('ERROR: El teléfono fijo debe tener 9 dígitos y el celular 10 dígitos.');
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
          <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Módulo de Configuración de Empresa</h2>
          <p className="text-sm text-gray-500">Gestión de datos legales e institucionales</p>
        </div>
        <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-200 overflow-hidden">
           {formData.logo ? <img src={formData.logo} className="w-full h-full object-cover" alt="Logo" /> : <span className="font-bold text-2xl">A+</span>}
        </div>
      </div>

      <form onSubmit={handleOpenConfirm} className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-[0.1em]">Nombre Comercial (Fantasía)</label>
            <input 
              disabled={!isEditable}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all disabled:bg-gray-50"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-[0.1em]">Representante Legal</label>
            <input 
              disabled={!isEditable}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all disabled:bg-gray-50"
              value={formData.legalRep}
              onChange={e => setFormData({...formData, legalRep: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-[0.1em]">RUC (13 Dígitos - Termina en 001)</label>
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
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-[0.1em]">Teléfono / Celular</label>
            <input 
              disabled={!isEditable}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none disabled:bg-gray-50"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})}
              placeholder="9 o 10 dígitos numéricos"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-[0.1em]">Dirección de Domicilio</label>
            <input 
              disabled={!isEditable}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none disabled:bg-gray-50"
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-[0.1em]">Correo Electrónico</label>
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
            <label className="text-[10px] font-black text-blue-800 uppercase tracking-[0.1em]">URL de Imagen (Logotipo)</label>
            <input 
              disabled={!isEditable}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none disabled:bg-gray-50"
              value={formData.logo}
              onChange={e => setFormData({...formData, logo: e.target.value})}
              placeholder="Enlace a la imagen del logo"
            />
          </div>
        </div>

        {isEditable && (
          <div className="pt-6 border-t flex justify-end">
            <button 
              type="submit"
              className="px-10 py-4 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95"
            >
              Guardar y Registrar Empresa
            </button>
          </div>
        )}
      </form>

      <Modal 
        isOpen={isConfirmModalOpen} 
        onClose={() => setIsConfirmModalOpen(false)} 
        title="Confirmar Datos Institucionales"
        type="info"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setIsConfirmModalOpen(false)} className="px-6 py-2 text-gray-400 font-bold text-xs uppercase">Cancelar</button>
            <button onClick={handleConfirmSave} className="px-8 py-2 bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-lg">Actualizar Perfil</button>
          </div>
        }
      >
        <div className="space-y-4">
           <p className="text-sm text-gray-600 font-medium">¿Desea actualizar la información institucional de la empresa?</p>
           <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <p className="text-blue-900 font-black text-sm uppercase mb-1">{formData.name}</p>
              <p className="text-xs text-blue-700 font-bold">RUC: {formData.ruc}</p>
           </div>
           <p className="text-[10px] text-slate-400 font-bold italic uppercase">Estos datos aparecerán en todos los roles de pago y reportes del sistema.</p>
        </div>
      </Modal>
    </div>
  );
};

export default CompanyModule;
