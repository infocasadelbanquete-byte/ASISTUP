
import React, { useState, useEffect } from 'react';
import { Employee, Role, BloodType, Gender, CivilStatus, AbsenceRecord, TerminationReason, SettlementRecord, Payment, GlobalSettings, VacationRecord, EmployeeChild, NovedadReason } from '../../types.ts';
import Modal from '../../components/Modal.tsx';
import SettlementModal from '../../components/SettlementModal.tsx';
import EmployeeFileModal from '../../components/EmployeeFileModal.tsx';
import ConfirmationModal from '../../components/ConfirmationModal.tsx';
import { calculateVacationDays } from '../../utils/ecuadorianLabor.ts';

interface EmployeeModuleProps {
  employees: Employee[];
  onUpdate: (employees: Employee[]) => void;
  role: Role;
  attendance: any[];
  payments: Payment[];
  company: any;
  onUpdatePayments?: (payments: Payment[]) => void;
  settings?: GlobalSettings;
}

const DEFAULT_NOVEDAD_REASONS: NovedadReason[] = [
  { id: '1', name: 'FALTA JUSTIFICADA', isPermission: false },
  { id: '2', name: 'FALTA INJUSTIFICADA', isPermission: false },
  { id: '3', name: 'PERMISO MATERNAL', isPermission: true },
  { id: '4', name: 'PERMISO MÉDICO', isPermission: true },
  { id: '5', name: 'PERMISO PERSONAL', isPermission: true },
];

const EmployeeModule: React.FC<EmployeeModuleProps> = ({ employees, onUpdate, role, attendance = [], payments = [], company, onUpdatePayments, settings }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  
  const [selectedEmpAction, setSelectedEmpAction] = useState<Employee | null>(null);
  const [isNovedadModalOpen, setIsNovedadModalOpen] = useState(false);
  const [isDesvinculacionModalOpen, setIsDesvinculacionModalOpen] = useState(false);
  const [isExpedienteModalOpen, setIsExpedienteModalOpen] = useState(false);
  const [selectedEmpForFicha, setSelectedEmpForFicha] = useState<Employee | null>(null);

  // Modal de confirmación genérico para cualquier acción administrativa
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    type?: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const requestConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'warning' | 'danger' | 'info' = 'warning',
    confirmText: string = 'Sí, Confirmar Acción'
  ) => {
    setConfirmAction({
      isOpen: true,
      title,
      message,
      type,
      confirmText,
      onConfirm: () => {
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };
  
  // Catálogo de Razones para Bitácora Administrativa (Persistente en LocalStorage)
  const [novedadReasons, setNovedadReasons] = useState<NovedadReason[]>(() => {
    try {
      const saved = localStorage.getItem('bitacora_novedad_reasons');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_NOVEDAD_REASONS;
  });

  const [showManageReasons, setShowManageReasons] = useState(false);
  const [newReasonName, setNewReasonName] = useState('');
  const [newReasonIsPerm, setNewReasonIsPerm] = useState(false);
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [editingReasonName, setEditingReasonName] = useState('');
  const [editingReasonIsPerm, setEditingReasonIsPerm] = useState(false);

  // Formulario estructurado de Novedad para Bitácora Administrativa
  const [novedadFormData, setNovedadFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    reason: 'FALTA JUSTIFICADA',
    permissionType: 'entero' as 'entero' | 'media_am' | 'media_pm' | 'horas',
    permissionHours: 1,
    observation: ''
  });

  const [desvinculacionData, setDesvinculacionData] = useState({
    date: new Date().toISOString().split('T')[0],
    reason: TerminationReason.VOLUNTARY,
    details: ''
  });

  // Estado para Liquidación Laboral Ecuatoriana (Preliquidación y Definitiva)
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementTargetEmp, setSettlementTargetEmp] = useState<Employee | null>(null);
  const [isSettlementReadOnly, setIsSettlementReadOnly] = useState(false);

  // Estado para Formulario Administrativo de Vacaciones Gozadas
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [selectedVacationEmpId, setSelectedVacationEmpId] = useState<string>('');
  const [vacationForm, setVacationForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    days: 1,
    notes: 'PERÍODO ORDINARIO DE VACACIONES GOZADAS'
  });

  const handleVacationDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const updated = { ...vacationForm, [field]: value };
    const autoDays = calculateVacationDays(
      field === 'startDate' ? value : vacationForm.startDate,
      field === 'endDate' ? value : vacationForm.endDate
    );
    setVacationForm({
      ...updated,
      days: autoDays > 0 ? autoDays : 1
    });
  };

  const handleSaveVacation = () => {
    if (!selectedVacationEmpId) {
      setFeedback({ 
        isOpen: true, 
        title: "Seleccione un empleado", 
        message: "Debe escoger un colaborador de la lista para registrar sus vacaciones.", 
        type: "error" 
      });
      return;
    }
    const target = employees.find(e => e.id === selectedVacationEmpId);
    if (!target) return;

    if (!vacationForm.startDate || !vacationForm.endDate) {
      setFeedback({ 
        isOpen: true, 
        title: "Fechas requeridas", 
        message: "Debe señalar la fecha en la que inicia sus vacaciones y la fecha en la que termina las mismas.", 
        type: "error" 
      });
      return;
    }

    if (vacationForm.endDate < vacationForm.startDate) {
      setFeedback({ 
        isOpen: true, 
        title: "Fechas inválidas", 
        message: "La fecha en la que termina sus vacaciones no puede ser anterior a la fecha de inicio.", 
        type: "error" 
      });
      return;
    }

    const daysCount = Number(vacationForm.days) || calculateVacationDays(vacationForm.startDate, vacationForm.endDate);
    if (daysCount <= 0) {
      setFeedback({ 
        isOpen: true, 
        title: "Días inválidos", 
        message: "El período debe tener al menos 1 día gozado.", 
        type: "error" 
      });
      return;
    }

    requestConfirmation(
      "Confirmar Registro de Vacaciones",
      `¿Está seguro de registrar ${daysCount} días de vacaciones gozadas para ${target.surname} ${target.name} (Del ${vacationForm.startDate} al ${vacationForm.endDate})?`,
      () => {
        const newRecord: VacationRecord = {
          id: Math.random().toString(36).substr(2, 9),
          startDate: vacationForm.startDate,
          endDate: vacationForm.endDate,
          days: daysCount,
          notes: vacationForm.notes ? vacationForm.notes.toUpperCase() : 'PERÍODO DE VACACIONES GOZADAS',
          registeredAt: new Date().toISOString()
        };

        const updatedEmployees = employees.map(e => {
          if (e.id === selectedVacationEmpId) {
            return {
              ...e,
              vacations: [newRecord, ...(e.vacations || [])]
            };
          }
          return e;
        });

        onUpdate(updatedEmployees);
        setFeedback({
          isOpen: true,
          title: "Vacaciones Gozadas Registradas",
          message: `Se registraron exitosamente ${daysCount} días de vacaciones gozadas para ${target.surname} ${target.name} (Del ${vacationForm.startDate} al ${vacationForm.endDate}). Este registro se deducirá automáticamente al calcular la liquidación laboral y otros rubros.`,
          type: "success"
        });

        setVacationForm({
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          days: 1,
          notes: 'PERÍODO ORDINARIO DE VACACIONES GOZADAS'
        });
      },
      'info',
      'Asentar Vacaciones'
    );
  };

  const handleDeleteVacation = (empId: string, vacationId: string) => {
    requestConfirmation(
      "Eliminar Período de Vacaciones",
      "¿Está seguro de eliminar este registro de vacaciones gozadas? Los días descontados serán restituidos.",
      () => {
        const updatedEmployees = employees.map(e => {
          if (e.id === empId) {
            return {
              ...e,
              vacations: (e.vacations || []).filter(v => v.id !== vacationId)
            };
          }
          return e;
        });
        onUpdate(updatedEmployees);
        setFeedback({
          isOpen: true,
          title: "Registro Eliminado",
          message: "Se ha eliminado el período de vacaciones gozadas.",
          type: "info"
        });
      },
      'danger',
      'Sí, Eliminar'
    );
  };

  const handleConfirmSettlement = (updatedEmp: Employee, settlement: SettlementRecord, payment: Payment) => {
    const updatedList = employees.map(e => e.id === updatedEmp.id ? updatedEmp : e);
    onUpdate(updatedList);
    if (onUpdatePayments) {
      // Si ya existía un pago de liquidación previo para este colaborador, actualizarlo para mantener la contabilidad exacta
      const existingPayIdx = payments.findIndex(p => p.voucherCode === settlement.voucherCode || (p.employeeId === updatedEmp.id && p.type === 'Settlement'));
      if (existingPayIdx >= 0) {
        const nextPayments = [...payments];
        nextPayments[existingPayIdx] = { ...payment, id: payments[existingPayIdx].id };
        onUpdatePayments(nextPayments);
      } else {
        onUpdatePayments([...payments, payment]);
      }
    }
    setSettlementTargetEmp(updatedEmp);
    setSelectedEmpAction(prev => prev && prev.id === updatedEmp.id ? updatedEmp : prev);
    setFeedback({
      isOpen: true,
      title: "Acta de Finiquito Definitiva Actualizada",
      message: `Se ha procesado y guardado formalmente la modificación del acta de finiquito definitiva de ${updatedEmp.name} ${updatedEmp.surname} (Comprobante: ${settlement.voucherCode}). Puede imprimir las 3 copias oficiales actualizadas en cualquier momento.`,
      type: "success"
    });
  };

  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
    isOpen: false, title: '', message: '', type: 'info'
  });

  const [resetPinModal, setResetPinModal] = useState<{
    isOpen: boolean;
    employeeName: string;
    pin: string;
  }>({
    isOpen: false,
    employeeName: '',
    pin: ''
  });

  const handleDirectPinReset = (emp: Employee) => {
    requestConfirmation(
      "Confirmar Reseteo de PIN",
      `¿Está seguro de restablecer el PIN de acceso del colaborador ${emp.surname} ${emp.name}? Se asignará una clave temporal y se le solicitará cambio obligatorio de PIN.`,
      () => {
        const newPin = Math.floor(100000 + Math.random() * 900000).toString();
        const updated = employees.map(e => e.id === emp.id ? {
          ...e,
          pin: newPin,
          pinChanged: false,
          pinNeedsReset: true,
          pinResetRequested: false
        } : e);
        onUpdate(updated);
        setResetPinModal({
          isOpen: true,
          employeeName: `${emp.surname} ${emp.name}`,
          pin: newPin
        });
      },
      'warning',
      'Sí, Restablecer PIN'
    );
  };

  const initialForm: Partial<Employee> = {
    name: '', surname: '', identification: '', birthDate: '', phone: '', email: '', 
    gender: Gender.MASCULINO, civilStatus: CivilStatus.SOLTERO,
    origin: 'ECUATORIANA', address: '', 
    bloodType: BloodType.O_POS, startDate: new Date().toISOString().split('T')[0],
    role: Role.EMPLOYEE, salary: 482.00, status: 'active' as const, photo: '', pin: '',
    emergencyContact: { name: '', phone: '' },
    isFixed: true, isAffiliated: true, 
    overSalaryType: 'monthly', 
    reserveFundType: 'monthly', 
    bankInfo: { ifi: '', type: 'Ahorros', account: '' },
    absences: [],
    observations: [],
    hasChildren: false,
    childrenCount: 0,
    children: []
  };

  const [form, setForm] = useState<Partial<Employee>>(initialForm);

  // Helper para persistencia de razones
  const saveReasonsToStorage = (reasons: NovedadReason[]) => {
    setNovedadReasons(reasons);
    try {
      localStorage.setItem('bitacora_novedad_reasons', JSON.stringify(reasons));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateReason = () => {
    if (!newReasonName.trim()) return;
    const newReason: NovedadReason = {
      id: Math.random().toString(36).substr(2, 9),
      name: newReasonName.trim().toUpperCase(),
      isPermission: newReasonIsPerm
    };
    const updated = [...novedadReasons, newReason];
    saveReasonsToStorage(updated);
    setNewReasonName('');
    setNewReasonIsPerm(false);
    setNovedadFormData(prev => ({ ...prev, reason: newReason.name }));
  };

  const handleStartEditReason = (r: NovedadReason) => {
    setEditingReasonId(r.id);
    setEditingReasonName(r.name);
    setEditingReasonIsPerm(r.isPermission);
  };

  const handleSaveEditReason = () => {
    if (!editingReasonId || !editingReasonName.trim()) return;
    const updated = novedadReasons.map(r => r.id === editingReasonId ? {
      ...r,
      name: editingReasonName.trim().toUpperCase(),
      isPermission: editingReasonIsPerm
    } : r);
    saveReasonsToStorage(updated);
    setEditingReasonId(null);
  };

  const handleDeleteReason = (id: string) => {
    const updated = novedadReasons.filter(r => r.id !== id);
    saveReasonsToStorage(updated);
    if (updated.length > 0 && !updated.find(r => r.name === novedadFormData.reason)) {
      setNovedadFormData(prev => ({ ...prev, reason: updated[0].name }));
    }
  };

  // Helpers para manejo de hijos (Cargas Familiares para Utilidades Art. 97 C.T.)
  const handleAddChild = () => {
    const currentChildren = form.children || [];
    const newChild: EmployeeChild = {
      id: Math.random().toString(36).substr(2, 9),
      fullName: '',
      name: '',
      age: 0,
      identification: ''
    };
    const updated = [...currentChildren, newChild];
    setForm(prev => ({
      ...prev,
      hasChildren: true,
      childrenCount: updated.length,
      children: updated
    }));
  };

  const handleUpdateChild = (index: number, field: keyof EmployeeChild, value: any) => {
    const currentChildren = [...(form.children || [])];
    if (!currentChildren[index]) return;
    if (field === 'fullName' || field === 'name') {
      currentChildren[index] = {
        ...currentChildren[index],
        fullName: value,
        name: value
      };
    } else {
      currentChildren[index] = {
        ...currentChildren[index],
        [field]: value
      };
    }
    setForm(prev => ({
      ...prev,
      children: currentChildren,
      childrenCount: currentChildren.length
    }));
  };

  const handleRemoveChild = (index: number) => {
    const currentChildren = [...(form.children || [])];
    currentChildren.splice(index, 1);
    setForm(prev => ({
      ...prev,
      hasChildren: currentChildren.length > 0,
      childrenCount: currentChildren.length,
      children: currentChildren
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setFeedback({ isOpen: true, title: "Error", message: "La imagen no debe superar los 2MB.", type: "error" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (
      !form.name || !form.surname || !form.identification || !form.salary || 
      !form.birthDate || !form.gender || !form.civilStatus || !form.address || 
      !form.email || !form.emergencyContact?.name || !form.emergencyContact?.phone || 
      !form.startDate
    ) {
      setFeedback({ 
        isOpen: true, 
        title: "Faltan datos obligatorios", 
        message: "Debe completar: Fecha de nacimiento, Sexo, Estado civil, Dirección, Correo, Datos de emergencia y Fecha de ingreso.", 
        type: "error" 
      });
      return;
    }

    const isFixedWorker = form.isFixed !== false;

    // Validación de hijos si declaró tener hijos (a criterio del administrador)
    if (form.hasChildren && form.children && form.children.length > 0) {
      const emptyChild = form.children.find(c => (!c.fullName && !c.name) || (!(c.fullName || c.name || '').trim()));
      if (emptyChild) {
        setFeedback({ 
          isOpen: true, 
          title: "Datos de Hijos Incompletos", 
          message: "Debe ingresar los nombres y apellidos de cada hijo registrado para el cálculo de utilidades.", 
          type: "error" 
        });
        return;
      }
    }

    const pinToUse = (form.pin || '').trim();
    if (pinToUse && !/^\d{6}$/.test(pinToUse)) {
      setFeedback({ 
        isOpen: true, 
        title: "PIN Inválido", 
        message: "El PIN de acceso debe tener exactamente 6 dígitos numéricos.", 
        type: "error" 
      });
      return;
    }

    if (pinToUse) {
      const duplicate = employees.find(e => e.pin === pinToUse && (!editingEmp || e.id !== editingEmp.id) && e.status === 'active');
      if (duplicate) {
        setFeedback({ 
          isOpen: true, 
          title: "PIN en Uso", 
          message: `El PIN ${pinToUse} ya pertenece a ${duplicate.surname} ${duplicate.name}. Elija otro PIN.`, 
          type: "error" 
        });
        return;
      }
    }

    const payload: Partial<Employee> = {
      ...form,
      isFixed: isFixedWorker,
      // Se deja a criterio del usuario administrador del sistema activar o desactivar dichos beneficios para el colaborador
      isAffiliated: form.isAffiliated ?? false,
      reserveFundType: form.reserveFundType || 'none',
      overSalaryType: form.overSalaryType || 'none',
      hasChildren: form.hasChildren ?? false,
      childrenCount: form.hasChildren ? (form.children?.length || 0) : 0,
      children: form.hasChildren ? (form.children || []) : []
    };

    requestConfirmation(
      editingEmp ? "Confirmar Modificación" : "Confirmar Nuevo Registro",
      `¿Está seguro de ${editingEmp ? 'guardar las modificaciones del' : 'registrar en el sistema al'} colaborador ${form.name} ${form.surname} (C.I.: ${form.identification})?`,
      () => {
        let updatedList: Employee[];
        if (editingEmp) {
          updatedList = employees.map(e => e.id === editingEmp.id ? { 
            ...e, 
            ...payload,
            pin: pinToUse || e.pin 
          } as Employee : e);
          setFeedback({ isOpen: true, title: "Éxito", message: "Colaborador actualizado correctamente.", type: "success" });
        } else {
          const assignedPin = pinToUse || Math.floor(100000 + Math.random() * 900000).toString();
          const needsReset = form.pinNeedsReset === true;
          const newEmp: Employee = { 
            ...payload, 
            id: Math.random().toString(36).substr(2, 9), 
            pin: assignedPin, 
            pinChanged: !needsReset, 
            pinNeedsReset: needsReset, 
            pinResetRequested: false, 
            status: 'active' as const 
          } as Employee;
          updatedList = [...employees, newEmp];
          setFeedback({ 
            isOpen: true, 
            title: "Registro Exitoso", 
            message: `Empleado registrado. PIN de Asistencia: ${assignedPin}`, 
            type: "success" 
          });
        }
        onUpdate(updatedList);
        setIsModalOpen(false);
      },
      'info',
      editingEmp ? 'Guardar Cambios' : 'Registrar Colaborador'
    );
  };

  const handleAddNovedad = () => {
    if (!selectedEmpAction) return;
    if (!novedadFormData.date) {
      setFeedback({ isOpen: true, title: "Fecha requerida", message: "Seleccione la fecha de la novedad.", type: "error" });
      return;
    }
    if (!novedadFormData.reason) {
      setFeedback({ isOpen: true, title: "Concepto requerido", message: "Seleccione el concepto de la novedad.", type: "error" });
      return;
    }

    const selectedReasonObj = novedadReasons.find(r => r.name === novedadFormData.reason);
    const isPermission = selectedReasonObj ? selectedReasonObj.isPermission : novedadFormData.reason.toUpperCase().includes('PERMISO');

    let permissionDetail = '';
    if (isPermission) {
      if (novedadFormData.permissionType === 'entero') {
        permissionDetail = 'DÍA LABORAL ENTERO';
      } else if (novedadFormData.permissionType === 'media_am') {
        permissionDetail = 'MEDIA JORNADA LABORAL (AM)';
      } else if (novedadFormData.permissionType === 'media_pm') {
        permissionDetail = 'MEDIA JORNADA LABORAL (PM)';
      } else {
        permissionDetail = `${novedadFormData.permissionHours} HORA(S) DE PERMISO`;
      }
    }

    const obsText = (novedadFormData.observation || '').trim().toUpperCase();
    const formattedSummary = isPermission
      ? `[${novedadFormData.reason}] TIEMPO: ${permissionDetail}${obsText ? ' — ' + obsText : ''}`
      : `[${novedadFormData.reason}]${obsText ? ' — ' + obsText : ''}`;

    const newObs = {
      id: Math.random().toString(36).substr(2, 9),
      date: novedadFormData.date,
      reason: novedadFormData.reason,
      permissionType: isPermission ? novedadFormData.permissionType : undefined,
      permissionHours: (isPermission && novedadFormData.permissionType === 'horas') ? Number(novedadFormData.permissionHours) : undefined,
      observation: obsText,
      text: formattedSummary
    };

    requestConfirmation(
      "Confirmar Registro de Novedad",
      `¿Está seguro de registrar este evento (${novedadFormData.reason}) en la bitácora administrativa de ${selectedEmpAction.surname} ${selectedEmpAction.name}?`,
      () => {
        const updatedEmployees = employees.map(e => {
          if (e.id === selectedEmpAction.id) {
            return {
              ...e,
              observations: [newObs, ...(e.observations || [])]
            };
          }
          return e;
        });

        onUpdate(updatedEmployees);
        setSelectedEmpAction(prev => prev ? {
          ...prev,
          observations: [newObs, ...(prev.observations || [])]
        } : null);

        setNovedadFormData({
          date: new Date().toISOString().split('T')[0],
          reason: novedadReasons[0]?.name || 'FALTA JUSTIFICADA',
          permissionType: 'entero',
          permissionHours: 1,
          observation: ''
        });

        setFeedback({
          isOpen: true,
          title: "Novedad Registrada",
          message: `Se ha registrado la novedad en la bitácora administrativa de ${selectedEmpAction.surname} ${selectedEmpAction.name}.`,
          type: "success"
        });
      },
      'info',
      'Registrar Novedad'
    );
  };

  const handleDeleteObservation = (obsIdOrIndex: string | number) => {
    if (!selectedEmpAction) return;
    requestConfirmation(
      "Eliminar Novedad de Bitácora",
      "¿Está seguro de eliminar esta anotación de la bitácora administrativa del colaborador?",
      () => {
        const updatedObservations = (selectedEmpAction.observations || []).filter((obs, idx) => {
          if (typeof obs === 'object' && obs.id) {
            return obs.id !== obsIdOrIndex;
          }
          return idx !== obsIdOrIndex;
        });

        const updatedEmployees = employees.map(e => {
          if (e.id === selectedEmpAction.id) {
            return {
              ...e,
              observations: updatedObservations
            };
          }
          return e;
        });

        onUpdate(updatedEmployees);
        setSelectedEmpAction(prev => prev ? {
          ...prev,
          observations: updatedObservations
        } : null);
      },
      'danger',
      'Sí, Eliminar'
    );
  };

  const handleProcessDesvinculacion = () => {
    if (!selectedEmpAction) return;
    requestConfirmation(
      "Confirmar Desvinculación Laboral",
      `¿Está seguro de dar de baja definitiva al colaborador ${selectedEmpAction.surname} ${selectedEmpAction.name} con fecha ${desvinculacionData.date}? Se cambiará su estado a desvinculado y se asentará la causal legal.`,
      () => {
        const updated = employees.map(e => e.id === selectedEmpAction.id ? {
          ...e,
          status: 'terminated' as const,
          terminationDate: desvinculacionData.date,
          terminationReason: desvinculacionData.reason,
          terminationDetails: desvinculacionData.details.toUpperCase()
        } : e);
        onUpdate(updated);
        setIsDesvinculacionModalOpen(false);
        setFeedback({ isOpen: true, title: "Baja Procesada", message: "El empleado ha sido desvinculado.", type: "success" });
      },
      'danger',
      'Confirmar Desvinculación'
    );
  };

  const filteredEmployees = employees.filter(e => {
    const searchString = `${e.name} ${e.surname} ${e.identification}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    return showArchived ? matchesSearch && e.status !== 'active' : matchesSearch && e.status === 'active';
  });

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border flex flex-col md:flex-row justify-between items-center no-print gap-6">
        <div>
          <h2 className="text-2xl font-[950] text-slate-900 uppercase italic leading-none">Gestión de Personal</h2>
          <div className="flex gap-6 mt-3">
            <button onClick={() => setShowArchived(false)} className={`text-[10px] font-black uppercase tracking-widest ${!showArchived ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Activos</button>
            <button onClick={() => setShowArchived(true)} className={`text-[10px] font-black uppercase tracking-widest ${showArchived ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Bajas</button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <input type="text" placeholder="Buscar empleado..." className="w-full sm:w-64 p-3 border-2 rounded-xl text-[11px] font-bold uppercase outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button 
            type="button"
            onClick={() => {
              const defaultEmpId = filteredEmployees[0]?.id || employees[0]?.id || '';
              setSelectedVacationEmpId(defaultEmpId);
              setIsVacationModalOpen(true);
            }}
            className="px-6 py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-lg uppercase text-[10px] tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            title="Formulario administrativo para indicar días de vacaciones gozados del empleado"
          >
            <span>🏖️</span>
            <span>Vacaciones Gozadas</span>
          </button>
          <button onClick={() => { 
            const defaultPin = Math.floor(100000 + Math.random() * 900000).toString();
            setForm({ 
              ...initialForm, 
              pin: defaultPin, 
              pinNeedsReset: false,
              isFixed: true,
              hasChildren: false,
              childrenCount: 0,
              children: [] 
            }); 
            setEditingEmp(null); 
            setIsModalOpen(true); 
          }} className="px-8 py-4 bg-blue-700 text-white font-black rounded-xl shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all cursor-pointer">Registrar Nuevo</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden no-print">
        <div className="table-responsive">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-5">Colaborador / ID</th>
                <th className="px-6 py-5">Cargo</th>
                <th className="px-6 py-5 text-center">Estado</th>
                <th className="px-6 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[11px] font-black uppercase">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden border flex items-center justify-center">
                           {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <span className="text-slate-400">👤</span>}
                        </div>
                        <button 
                          onClick={() => { setSelectedEmpAction(emp); setIsExpedienteModalOpen(true); }}
                          className="text-left group hover:bg-slate-50 p-1 rounded-lg transition-all"
                          title="Ver Expediente Completo"
                        >
                           <p className="text-slate-900 leading-none group-hover:text-blue-700 transition-colors border-b border-transparent group-hover:border-blue-700 font-black">{emp.surname} {emp.name}</p>
                           <p className="text-[9px] text-slate-400 font-mono mt-1">{emp.identification}</p>
                        </button>
                     </div>
                  </td>
                  <td className="px-6 py-4"><p className="text-blue-600">{emp.role}</p><p className="text-[9px] text-slate-400 mt-1">Ingreso: {emp.startDate}</p></td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {emp.status}
                      </span>
                      {emp.pinResetRequested && (
                        <span className="px-2 py-0.5 rounded-full text-[7px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-300 animate-pulse">
                          🔑 Pide Reseteo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 items-center">
                      {emp.status === 'active' && (
                        <button 
                          onClick={() => handleDirectPinReset(emp)} 
                          className={`p-2.5 rounded-lg shadow-sm transition-all ${emp.pinResetRequested ? 'bg-amber-100 text-amber-700 border-2 border-amber-400 animate-bounce hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-600'}`} 
                          title={emp.pinResetRequested ? "Solicitud activa de reseteo: Click para generar nuevo PIN" : "Restablecer PIN de acceso"}
                        >
                          🔑
                        </button>
                      )}
                      <button 
                        onClick={() => setSelectedEmpForFicha(emp)} 
                        className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg shadow-sm border border-indigo-200 transition-all font-black text-xs cursor-pointer flex items-center gap-1" 
                        title="Visualizar e Imprimir Ficha Individual Completa (Formato Oficial A4)"
                      >
                        <span>📋</span>
                        <span className="text-[8px] font-black uppercase hidden xl:inline">Ficha</span>
                      </button>
                      <button 
                        onClick={() => { 
                          setEditingEmp(emp); 
                          setForm({
                            ...initialForm,
                            ...emp,
                            isFixed: emp.isFixed !== undefined ? emp.isFixed : true,
                            hasChildren: emp.hasChildren ?? ((emp.children?.length ?? 0) > 0),
                            childrenCount: emp.childrenCount ?? (emp.children?.length ?? 0),
                            children: emp.children || []
                          }); 
                          setIsModalOpen(true); 
                        }} 
                        className="p-2.5 bg-slate-100 text-slate-600 rounded-lg shadow-sm hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer" 
                        title="Editar Ficha"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => { 
                          setSelectedVacationEmpId(emp.id); 
                          setIsVacationModalOpen(true); 
                        }} 
                        className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg shadow-sm border border-emerald-200 transition-all font-black text-xs cursor-pointer" 
                        title="Registrar / Consultar Vacaciones Gozadas (Influye en liquidaciones)"
                      >
                        🏖️
                      </button>
                      <button 
                        onClick={() => { 
                          setSelectedEmpAction(emp); 
                          setNovedadFormData({
                            date: new Date().toISOString().split('T')[0],
                            reason: novedadReasons[0]?.name || 'FALTA JUSTIFICADA',
                            permissionType: 'entero',
                            permissionHours: 1,
                            observation: ''
                          });
                          setShowManageReasons(false);
                          setIsNovedadModalOpen(true); 
                        }} 
                        className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg shadow-sm transition-colors cursor-pointer" 
                        title="Bitácora Administrativa"
                      >
                        📝
                      </button>
                      {emp.status === 'active' ? (
                        <button 
                          onClick={() => { 
                            setSettlementTargetEmp(emp); 
                            setIsSettlementReadOnly(false); 
                            setIsSettlementModalOpen(true); 
                          }} 
                          className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg shadow-sm border border-red-200 transition-all cursor-pointer font-black text-xs" 
                          title="Dar de baja y calcular liquidación laboral"
                        >
                          🚪
                        </button>
                      ) : (
                        <button 
                          onClick={() => { 
                            setSettlementTargetEmp(emp); 
                            setIsSettlementReadOnly(false); 
                            setIsSettlementModalOpen(true); 
                          }} 
                          className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg shadow-sm border border-emerald-200 transition-all font-black text-xs cursor-pointer flex items-center gap-1" 
                          title="Ver / Modificar / Imprimir Acta de Finiquito y Liquidación (3 Copias)"
                        >
                          <span>📜</span>
                          <span className="text-[8px] font-black uppercase hidden sm:inline">Finiquito</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXPEDIENTE INFORMATIVO DETALLADO */}
      <Modal isOpen={isExpedienteModalOpen} onClose={() => setIsExpedienteModalOpen(false)} title="Expediente Informativo Corporativo" maxWidth="max-w-5xl">
        {selectedEmpAction && (
          <div className="space-y-8 pb-10 max-h-[80vh] overflow-y-auto custom-scroll pr-4 a4-sheet" id="employee-file-print">
            <header className="flex flex-col md:flex-row items-center gap-8 border-b-2 pb-8 border-slate-100">
               <div className="w-32 h-32 md:w-40 md:h-40 bg-slate-100 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                 {selectedEmpAction.photo ? <img src={selectedEmpAction.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">👤</div>}
               </div>
               <div className="text-center md:text-left flex-1">
                 <h3 className="text-3xl font-[950] text-slate-900 uppercase italic tracking-tighter leading-none">{selectedEmpAction.surname} {selectedEmpAction.name}</h3>
                 <p className="text-blue-600 font-black text-xs uppercase tracking-[0.4em] mt-2 mb-4">{selectedEmpAction.role}</p>
                 <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="px-4 py-1.5 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest">CI: {selectedEmpAction.identification}</span>
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${selectedEmpAction.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{selectedEmpAction.status === 'active' ? 'VINCULADO' : 'DESVINCULADO'}</span>
                 </div>
               </div>
               <div className="no-print">
                 <button onClick={() => setSelectedEmpForFicha(selectedEmpAction)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-md cursor-pointer flex items-center gap-2">
                   <span>📋</span> Ver / Imprimir Ficha Oficial A4
                 </button>
               </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <section className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                  <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest border-b pb-3 mb-4 flex items-center gap-2"><span>👤</span> Información Personal</h4>
                  <div className="space-y-3 text-[11px] font-bold uppercase">
                     <p className="flex justify-between"><span className="text-slate-400">Nacimiento:</span> <span className="text-slate-900">{selectedEmpAction.birthDate}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">Teléfono:</span> <span className="text-blue-600 font-mono font-black">{selectedEmpAction.phone || 'NO REGISTRADO'}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">Género:</span> <span className="text-slate-900">{selectedEmpAction.gender}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">Estado Civil:</span> <span className="text-slate-900">{selectedEmpAction.civilStatus}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">Tipo Sangre:</span> <span className="text-slate-900">{selectedEmpAction.bloodType}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">Nacionalidad:</span> <span className="text-slate-900">{selectedEmpAction.origin}</span></p>
                  </div>
               </section>

               <section className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                  <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest border-b pb-3 mb-4 flex items-center gap-2"><span>💼</span> Datos Laborales</h4>
                  <div className="space-y-3 text-[11px] font-bold uppercase">
                     <p className="flex justify-between"><span className="text-slate-400">Ingreso:</span> <span className="text-slate-900">{selectedEmpAction.startDate}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">Sueldo Base:</span> <span className="text-emerald-700 font-black">${selectedEmpAction.salary.toFixed(2)}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">Contrato:</span> <span className="text-slate-900">{selectedEmpAction.isFixed ? 'FIJO / INDEFINIDO' : 'TEMPORAL / EVENTUAL'}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">Afiliado IESS:</span> <span className="text-slate-900">{selectedEmpAction.isAffiliated ? 'SÍ' : 'NO'}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">F. Reserva:</span> <span className="text-slate-900">{selectedEmpAction.reserveFundType}</span></p>
                     <p className="flex justify-between items-center pt-1 border-t border-slate-200">
                       <span className="text-emerald-800 font-black">Vacac. Gozadas:</span> 
                       <span className="text-emerald-700 font-mono font-black">
                         {(selectedEmpAction.vacations || []).reduce((sum, v) => sum + (Number(v.days) || 0), 0)} DÍAS
                       </span>
                     </p>
                  </div>
               </section>

               <section className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                  <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest border-b pb-3 mb-4 flex items-center gap-2"><span>💳</span> Información Bancaria</h4>
                  <div className="space-y-3 text-[11px] font-bold uppercase">
                     <p className="flex justify-between"><span className="text-slate-400">Institución:</span> <span className="text-slate-900">{selectedEmpAction.bankInfo?.ifi || 'NO REGISTRA'}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">Tipo Cuenta:</span> <span className="text-slate-900">{selectedEmpAction.bankInfo?.type || 'N/A'}</span></p>
                     <p className="flex justify-between"><span className="text-slate-400">Número:</span> <span className="text-slate-900 font-mono tracking-tighter">{selectedEmpAction.bankInfo?.account || 'N/A'}</span></p>
                  </div>
                  <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b pb-3 mb-4 mt-6 flex items-center gap-2"><span>☎️</span> Emergencias</h4>
                  <div className="space-y-2 text-[11px] font-bold uppercase">
                     <p className="text-slate-900 leading-tight">{selectedEmpAction.emergencyContact?.name}</p>
                     <p className="text-blue-600 font-black">{selectedEmpAction.emergencyContact?.phone}</p>
                  </div>
               </section>
            </div>

            {(selectedEmpAction.hasChildren || (selectedEmpAction.children && selectedEmpAction.children.length > 0)) && (
              <section className="bg-purple-50/40 p-6 rounded-[2rem] border border-purple-100">
                <h4 className="text-[10px] font-black text-purple-700 uppercase tracking-widest border-b border-purple-200 pb-3 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2"><span>👨‍👩‍👧‍👦</span> Cargas Familiares e Hijos (Cálculo de Utilidades - Art. 97 C.T.)</span>
                  <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {selectedEmpAction.hasChildren && selectedEmpAction.children?.length ? `${selectedEmpAction.children.length} HIJOS REGISTRADOS` : 'NO REGISTRA HIJOS'}
                  </span>
                </h4>
                {selectedEmpAction.hasChildren && selectedEmpAction.children && selectedEmpAction.children.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedEmpAction.children.map((ch, idx) => (
                        <div key={ch.id || idx} className="p-3.5 bg-white rounded-2xl border border-purple-200 flex justify-between items-center shadow-sm">
                          <div>
                            <p className="text-xs font-black text-slate-900 uppercase">{ch.fullName || ch.name}</p>
                            <p className="text-[9px] font-mono text-slate-500">{ch.identification ? `C.I.: ${ch.identification}` : 'Sin C.I. registrada'}</p>
                          </div>
                          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 font-mono font-black text-[10px] rounded-xl border border-purple-200">
                            {ch.age} {ch.age === 1 ? 'AÑO' : 'AÑOS'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[8px] font-bold text-slate-500 uppercase">
                      * Cargas reconocidas legalmente para la participación en el 5% de utilidades de acuerdo con la legislación laboral ecuatoriana vigente (Art. 97 C.T.).
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-slate-400 uppercase italic">
                    El colaborador no declara hijos o cargas familiares para el reparto de utilidades.
                  </p>
                )}
              </section>
            )}

            <section className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
               <h4 className="text-[11px] font-[950] text-slate-900 uppercase tracking-[0.2em] border-b-4 border-slate-900 pb-3 mb-6 flex items-center justify-between">
                  <span>📜 Bitácora de Novedades e Historial Administrativo</span>
                  <span className="text-[9px] font-black text-slate-400">Total Eventos: {selectedEmpAction.observations?.length || 0}</span>
               </h4>
               <div className="space-y-4">
                  {selectedEmpAction.observations?.length ? (
                    selectedEmpAction.observations.map((obs, idx) => (
                      <div key={idx} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white transition-all group">
                         <div className="flex flex-col items-center shrink-0">
                            <div className="w-2 h-2 bg-blue-600 rounded-full group-hover:scale-150 transition-transform"></div>
                            <div className="w-0.5 flex-1 bg-slate-200"></div>
                         </div>
                         <div className="flex-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{new Date(obs.date).toLocaleString()}</p>
                            <p className="text-xs font-bold text-slate-700 uppercase italic">"{obs.text}"</p>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center opacity-30 italic font-bold uppercase text-[10px]">Sin novedades registradas en el historial del colaborador.</div>
                  )}
               </div>
            </section>

            {selectedEmpAction.status === 'terminated' && (
              <section className="bg-red-50 p-8 rounded-[2rem] border border-red-100">
                 <h4 className="text-[11px] font-black text-red-700 uppercase tracking-widest border-b border-red-200 pb-3 mb-4 flex items-center gap-2"><span>🚪</span> Acta de Desvinculación</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[11px] font-black uppercase">
                    <div>
                       <p className="text-red-400 text-[9px] mb-1">FECHA DE SALIDA:</p>
                       <p className="text-red-900">{selectedEmpAction.terminationDate}</p>
                       <p className="text-red-400 text-[9px] mt-4 mb-1">MOTIVO LEGAL:</p>
                       <p className="text-red-900">{selectedEmpAction.terminationReason}</p>
                    </div>
                    <div>
                       <p className="text-red-400 text-[9px] mb-1">DETALLES Y OBSERVACIONES FINALES:</p>
                       <p className="text-red-900 italic">"{selectedEmpAction.terminationDetails}"</p>
                       <button
                         type="button"
                         onClick={() => {
                           setSettlementTargetEmp(selectedEmpAction);
                           setIsSettlementReadOnly(false);
                           setIsSettlementModalOpen(true);
                         }}
                         className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                       >
                         <span>📜</span> Ver / Modificar / Imprimir Liquidación y Finiquito (3 Copias)
                       </button>
                    </div>
                 </div>
              </section>
            )}
          </div>
        )}
      </Modal>

      {/* FORMULARIO DE REGISTRO/EDICIÓN */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp ? "Actualizar Expediente" : "Registrar empleado"} maxWidth="max-w-4xl">
        <div className="space-y-8 max-h-[75vh] overflow-y-auto pr-2 custom-scroll pb-6">
          <div className="flex flex-col md:flex-row gap-6 items-center bg-slate-50 p-6 rounded-[2rem] border">
             <div className="relative w-32 h-32 bg-white rounded-3xl border-2 border-dashed border-blue-200 flex items-center justify-center overflow-hidden shadow-inner group">
                {form.photo ? <img src={form.photo} className="w-full h-full object-cover" /> : <span className="text-3xl opacity-20">📸</span>}
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handlePhotoUpload} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-black uppercase pointer-events-none text-center p-2">Click para subir foto</div>
             </div>
             <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Nombres</label>
                   <input className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase focus:border-blue-500 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Apellidos</label>
                   <input className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase focus:border-blue-500 outline-none" value={form.surname} onChange={e => setForm({...form, surname: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Identificación (CI/RUC)</label>
                   <input className="w-full p-3 border-2 rounded-xl text-xs font-mono font-black focus:border-blue-500 outline-none" value={form.identification} onChange={e => setForm({...form, identification: e.target.value.replace(/\D/g,'')})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Sueldo Base ($)</label>
                   <input type="number" step="0.01" className="w-full p-3 border-2 rounded-xl text-lg font-black focus:border-blue-500 outline-none" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} />
                </div>
             </div>
          </div>

          <section className="space-y-4">
             <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest border-b pb-1">Datos Personales Obligatorios</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Fecha de Nacimiento</label>
                  <input type="date" className="w-full p-3 border-2 rounded-xl text-xs font-bold" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Sexo</label>
                  <select className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" value={form.gender} onChange={e => setForm({...form, gender: e.target.value as any})}>
                    {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Estado Civil</label>
                  <select className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" value={form.civilStatus} onChange={e => setForm({...form, civilStatus: e.target.value as any})}>
                    {Object.values(CivilStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Correo Electrónico</label>
                   <input type="email" className="w-full p-3 border-2 rounded-xl text-xs font-bold" placeholder="email@institucional.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-blue-600 uppercase font-bold">Teléfono de Contacto</label>
                   <input type="text" className="w-full p-3 border-2 border-blue-200 rounded-xl text-xs font-bold" placeholder="EJ: 0999999999" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g,'')})} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Dirección de Domicilio</label>
                  <input className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" placeholder="Calle principal, secundaria y # casa" value={form.address} onChange={e => setForm({...form, address: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase font-bold text-blue-600">Fecha de Ingreso</label>
                  <input type="date" className="w-full p-3 border-2 border-blue-200 rounded-xl text-xs font-bold" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Cargo</label>
                  <select className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" value={form.role} onChange={e => setForm({...form, role: e.target.value as any})}>
                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase">Tipo de Sangre</label>
                   <select className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" value={form.bloodType} onChange={e => setForm({...form, bloodType: e.target.value as any})}>
                      {Object.values(BloodType).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>
             </div>
          </section>

          <section className="space-y-4">
             <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b pb-1">Contacto de Emergencia</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Persona de Contacto</label>
                  <input className="w-full p-3 border-2 rounded-xl text-xs font-bold uppercase" placeholder="Nombre completo del contacto" value={form.emergencyContact?.name} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, name: e.target.value.toUpperCase()}})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Teléfono de Emergencia</label>
                  <input className="w-full p-3 border-2 rounded-xl text-xs font-bold" placeholder="EJ: 0999999999" value={form.emergencyContact?.phone} onChange={e => setForm({...form, emergencyContact: {...form.emergencyContact!, phone: e.target.value.replace(/\D/g,'')}})} />
                </div>
             </div>
          </section>

          {/* MODALIDAD DE CONTRATACIÓN (FIJO O TEMPORAL) */}
          <section className="space-y-4 border-t pt-6">
             <div className="flex items-center justify-between border-b pb-1">
                <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                  <span>📋</span> Modalidad Contractual
                </h4>
                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono ${form.isFixed ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                  {form.isFixed ? 'TRABAJADOR FIJO' : 'TRABAJADOR TEMPORAL'}
                </span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border">
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-600 uppercase">Tipo de Trabajador *</label>
                   <select 
                     className="w-full p-3 border-2 rounded-xl text-xs font-black uppercase bg-white cursor-pointer focus:border-blue-500 outline-none"
                     value={form.isFixed ? 'fijo' : 'temporal'}
                     onChange={e => {
                       const isFijo = e.target.value === 'fijo';
                       setForm(prev => ({
                         ...prev,
                         isFixed: isFijo
                       }));
                     }}
                   >
                     <option value="fijo">FIJO (CONTRATO INDEFINIDO / PERMANENTE)</option>
                     <option value="temporal">TEMPORAL (EVENTUAL / OCASIONAL / POR OBRA)</option>
                   </select>
                   <p className="text-[8px] font-bold text-slate-400 uppercase">
                     Modalidad seleccionada: Las opciones de beneficios sociales se encuentran activadas para su configuración administrativa.
                   </p>
                </div>
                <div className="p-3 bg-white rounded-xl border flex items-center gap-3">
                   <span className="text-2xl">{form.isFixed ? '🛡️' : '⏳'}</span>
                   <div className="text-[9px] font-bold text-slate-600 uppercase leading-snug">
                     <span className="text-blue-900">
                       <strong>Criterio Administrativo Habilitado:</strong> Las opciones de beneficios sociales (IESS, Décimos, Fondos de Reserva y Cargas Familiares) están activas. Queda a su exclusivo criterio administrativo activar o desactivar cada rubro para el colaborador.
                     </span>
                   </div>
                </div>
             </div>
          </section>

          {/* BENEFICIOS SOCIALES Y SEGURIDAD SOCIAL (A CRITERIO DEL USUARIO ADMINISTRADOR) */}
          <section className="space-y-4 border-t pt-6">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-1 gap-1">
                <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                  <span>🛡️</span> Seguridad Social y Beneficios de Ley
                </h4>
                <span className="text-[8px] font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase border border-blue-200">
                  A criterio del administrador: activar o desactivar libremente
                </span>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="p-4 bg-slate-50 rounded-2xl border flex items-center justify-between">
                   <div>
                     <span className="text-[10px] font-black uppercase text-slate-700 block">Afiliación IESS</span>
                     <span className={`text-[8px] font-black uppercase ${form.isAffiliated ? 'text-blue-600' : 'text-slate-400'}`}>
                       {form.isAffiliated ? '✓ Afiliado Activo' : '✕ Sin Aportación'}
                     </span>
                   </div>
                   <button 
                     type="button"
                     onClick={() => setForm({...form, isAffiliated: !form.isAffiliated})} 
                     className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${form.isAffiliated ? 'bg-blue-600' : 'bg-slate-300'}`}
                     title={form.isAffiliated ? "Clic para desactivar afiliación IESS" : "Clic para activar afiliación IESS"}
                   >
                     <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isAffiliated ? 'translate-x-6' : 'translate-x-1'}`} />
                   </button>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase">Fondos de Reserva</label>
                    <select className="w-full p-3 border-2 rounded-xl text-[10px] font-black uppercase bg-white cursor-pointer focus:border-blue-500 outline-none" value={form.reserveFundType || 'none'} onChange={e => setForm({...form, reserveFundType: e.target.value as any})}>
                      <option value="monthly">Mensualizar (8.33%)</option>
                      <option value="accumulate">Acumular en el IESS</option>
                      <option value="none">No aplica / Desactivado</option>
                    </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-600 uppercase">Décimos Sueldos</label>
                  <select className="w-full p-3 border-2 rounded-xl text-[10px] font-black uppercase bg-white cursor-pointer focus:border-blue-500 outline-none" value={form.overSalaryType || 'none'} onChange={e => setForm({...form, overSalaryType: e.target.value as any})}>
                    <option value="monthly">Mensualizar (13° y 14°)</option>
                    <option value="accumulate">Acumular Anual</option>
                    <option value="none">No Aplica / Desactivado</option>
                  </select>
                </div>
             </div>
          </section>

          {/* CARGAS FAMILIARES E HIJOS - UTILIDADES ART. 97 C.T. (A CRITERIO DEL ADMINISTRADOR) */}
          <section className="space-y-4 border-t pt-6">
            <div className="flex items-center justify-between border-b pb-1">
              <h4 className="text-[10px] font-black text-purple-700 uppercase tracking-widest flex items-center gap-2">
                <span>👨‍👩‍👧‍👦</span> Cargas Familiares e Hijos (Cálculo de Utilidades - Art. 97 C.T.)
              </h4>
              <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                {form.children?.length || 0} HIJOS REGISTRADOS
              </span>
            </div>

              <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-200 space-y-4">
                {/* Toggle si tiene hijos */}
                <div className="p-4 bg-white rounded-2xl border border-purple-200 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] font-black text-slate-800 uppercase">¿El empleado tiene hijos?</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase">
                      Habilita el registro de hijos uno por uno para la distribución proporcional del 5% de utilidades legales.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !form.hasChildren;
                      setForm(prev => ({
                        ...prev,
                        hasChildren: nextVal,
                        childrenCount: nextVal ? (prev.children?.length || 1) : 0,
                        children: nextVal ? (prev.children && prev.children.length > 0 ? prev.children : [{
                          id: Math.random().toString(36).substr(2, 9),
                          fullName: '',
                          name: '',
                          age: 0,
                          identification: ''
                        }]) : []
                      }));
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${form.hasChildren ? 'bg-purple-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.hasChildren ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {form.hasChildren && (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-[9px] font-black text-purple-900 uppercase tracking-wider">
                        Detalle Individual de Hijos (Nombres, Apellidos, Edad y Cédula opcional):
                      </p>
                      <button
                        type="button"
                        onClick={handleAddChild}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
                      >
                        <span>➕</span> Agregar Hijo
                      </button>
                    </div>

                    {form.children && form.children.length > 0 ? (
                      <div className="space-y-2.5">
                        {form.children.map((child, index) => (
                          <div key={child.id || index} className="p-4 bg-white rounded-2xl border border-purple-200 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                            <div className="md:col-span-1 text-center hidden md:block">
                              <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black inline-flex items-center justify-center">
                                #{index + 1}
                              </span>
                            </div>
                            <div className="md:col-span-5 space-y-1">
                              <label className="text-[8px] font-black text-slate-500 uppercase">Nombres y Apellidos *</label>
                              <input
                                type="text"
                                placeholder="Nombres completos del hijo/a"
                                value={child.fullName || child.name || ''}
                                onChange={e => handleUpdateChild(index, 'fullName', e.target.value.toUpperCase())}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase focus:border-purple-500 focus:bg-white outline-none"
                              />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                              <label className="text-[8px] font-black text-slate-500 uppercase">Edad (Años) *</label>
                              <input
                                type="number"
                                min="0"
                                max="25"
                                placeholder="Edad"
                                value={child.age}
                                onChange={e => handleUpdateChild(index, 'age', Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:border-purple-500 focus:bg-white outline-none text-center"
                              />
                            </div>
                            <div className="md:col-span-3 space-y-1">
                              <label className="text-[8px] font-black text-slate-500 uppercase">N° Cédula (Opcional)</label>
                              <input
                                type="text"
                                maxLength={10}
                                placeholder="Cédula"
                                value={child.identification || ''}
                                onChange={e => handleUpdateChild(index, 'identification', e.target.value.replace(/\D/g, ''))}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:border-purple-500 focus:bg-white outline-none"
                              />
                            </div>
                            <div className="md:col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveChild(index)}
                                className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs transition-colors cursor-pointer"
                                title="Eliminar este registro de hijo"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-5 bg-white rounded-2xl border border-dashed border-purple-200 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">No hay hijos agregados en la lista.</p>
                        <button
                          type="button"
                          onClick={handleAddChild}
                          className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          + Agregar Primer Hijo
                        </button>
                      </div>
                    )}

                    <div className="p-3 bg-white/80 rounded-xl border border-purple-100 text-[8px] font-bold text-purple-900 uppercase leading-relaxed">
                      ⚖️ <strong>Normativa Art. 97 Código del Trabajo:</strong> El 10% del reparto de utilidades se distribuye entre todos los colaboradores de acuerdo al tiempo trabajado; el 5% restante se reparte proporcionalmente entre los trabajadores que acrediten cargas familiares (cónyuge o conviviente en unión de hecho e hijos menores de 18 años o con discapacidad de cualquier edad).
                    </div>
                  </div>
                )}
              </div>
            </section>

          <section className="space-y-4 border-t pt-6">
             <div className="flex items-center justify-between border-b pb-1">
                <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                  <span>🔑</span> Acceso al Panel de Asistencia (PIN)
                </h4>
                <span className="text-[9px] font-black text-slate-400 uppercase">Clave de 6 Dígitos</span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-2xl border">
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-500 uppercase">PIN de Marcación (6 dígitos)</label>
                   <div className="flex gap-2">
                      <input 
                        type="text" 
                        maxLength={6} 
                        placeholder="Ej: 123456" 
                        className="w-full p-3 border-2 rounded-xl text-base font-mono font-black tracking-widest focus:border-blue-500 outline-none bg-white text-slate-900" 
                        value={form.pin || ''} 
                        onChange={e => setForm({...form, pin: e.target.value.replace(/\D/g,'').slice(0, 6)})} 
                      />
                      <button 
                        type="button" 
                        onClick={() => {
                          const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
                          setForm({...form, pin: randomPin});
                        }} 
                        className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer"
                        title="Generar PIN aleatorio de 6 dígitos"
                      >
                        🎲 Generar
                      </button>
                   </div>
                   <p className="text-[8px] font-bold text-slate-400 uppercase">Clave con la cual el colaborador registrará asistencia en el panel.</p>
                </div>
                <div className="p-3 bg-white rounded-xl border flex items-center justify-between">
                   <div>
                      <p className="text-[9px] font-black text-slate-700 uppercase">Exigir cambio de clave al marcar</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">{form.pinNeedsReset ? 'Deberá cambiar su PIN al ingresar' : 'Podrá marcar directamente con este PIN'}</p>
                   </div>
                   <button 
                     type="button" 
                     onClick={() => setForm({...form, pinNeedsReset: !form.pinNeedsReset})} 
                     className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${form.pinNeedsReset ? 'bg-amber-500' : 'bg-slate-300'}`}
                   >
                     <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.pinNeedsReset ? 'translate-x-6' : 'translate-x-1'}`} />
                   </button>
                </div>
             </div>
          </section>

          <button onClick={handleSave} className="w-full py-5 bg-blue-700 text-white font-[950] rounded-2xl uppercase text-[11px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all cursor-pointer">{editingEmp ? "Guardar Cambios" : "Registrar empleado"}</button>
        </div>
      </Modal>

      {/* FEEDBACK */}
      <Modal isOpen={feedback.isOpen} onClose={() => setFeedback({...feedback, isOpen: false})} title={feedback.title} type={feedback.type}>
        <div className="text-center p-6">
          <p className="text-[11px] font-black uppercase text-slate-600 leading-relaxed italic">{feedback.message}</p>
          <button onClick={() => setFeedback({...feedback, isOpen: false})} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] mt-8 active:scale-95 transition-all tracking-widest shadow-lg">Entendido</button>
        </div>
      </Modal>

      {/* BITÁCORA ADMINISTRATIVA COMPLETA */}
      <Modal 
        isOpen={isNovedadModalOpen} 
        onClose={() => setIsNovedadModalOpen(false)} 
        title="Bitácora Administrativa del Colaborador"
        maxWidth="max-w-3xl"
      >
        {selectedEmpAction && (
          <div className="space-y-6 pb-2 max-h-[80vh] overflow-y-auto custom-scroll pr-1">
            {/* Cabecera del Colaborador */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-base font-[950] text-slate-900 uppercase tracking-tight">
                  {selectedEmpAction.surname} {selectedEmpAction.name}
                </h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                  C.I.: <span className="font-mono text-slate-800">{selectedEmpAction.identification}</span> • Cargo: <span className="text-blue-700">{selectedEmpAction.role}</span> • Estado: <span className={selectedEmpAction.status === 'active' ? 'text-emerald-700' : 'text-red-700'}>{selectedEmpAction.status === 'active' ? 'ACTIVO' : 'BAJA'}</span>
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowManageReasons(!showManageReasons)}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-700 border border-blue-300 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>⚙️</span>
                <span>{showManageReasons ? 'Ocultar Catálogo' : 'Gestionar Razones'}</span>
              </button>
            </div>

            {/* Panel de Gestión del Catálogo de Razones (Crear / Editar / Eliminar) */}
            {showManageReasons && (
              <div className="p-5 bg-slate-900 text-white rounded-3xl space-y-4 shadow-xl border border-slate-700">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                    <span>🗂️</span> Catálogo de Razones de Novedad
                  </h5>
                  <span className="text-[8px] font-mono text-slate-400">Personalizable y persistente</span>
                </div>

                {/* Formulario para Crear Nueva Razón */}
                <div className="p-3.5 bg-slate-800 rounded-2xl border border-slate-700 space-y-3">
                  <p className="text-[9px] font-black text-slate-300 uppercase">Crear Nueva Razón / Concepto:</p>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input 
                      type="text"
                      placeholder="Ej: PERMISO DE PATERNIDAD, CAPACITACIÓN..."
                      value={newReasonName}
                      onChange={e => setNewReasonName(e.target.value.toUpperCase())}
                      className="flex-1 p-2.5 bg-slate-900 border border-slate-600 rounded-xl text-xs font-bold text-white uppercase outline-none focus:border-blue-400"
                    />
                    <label className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-600 cursor-pointer shrink-0">
                      <input 
                        type="checkbox"
                        checked={newReasonIsPerm}
                        onChange={e => setNewReasonIsPerm(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-[9px] font-black text-slate-300 uppercase">¿Es Permiso?</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleCreateReason}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
                    >
                      + Crear
                    </button>
                  </div>
                </div>

                {/* Lista de Razones Existentes para Editar o Eliminar */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scroll">
                  {novedadReasons.map(r => (
                    <div key={r.id} className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      {editingReasonId === r.id ? (
                        <div className="flex-1 flex flex-col sm:flex-row items-center gap-2 w-full">
                          <input 
                            type="text"
                            value={editingReasonName}
                            onChange={e => setEditingReasonName(e.target.value.toUpperCase())}
                            className="flex-1 p-1.5 bg-slate-900 border border-blue-400 rounded-lg text-xs font-bold text-white uppercase outline-none"
                          />
                          <label className="flex items-center gap-1.5 text-[8px] font-bold uppercase cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={editingReasonIsPerm}
                              onChange={e => setEditingReasonIsPerm(e.target.checked)}
                            />
                            <span>Permiso</span>
                          </label>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={handleSaveEditReason}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase cursor-pointer"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingReasonId(null)}
                              className="px-2.5 py-1 bg-slate-700 text-slate-300 rounded-lg text-[8px] font-black uppercase cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-white uppercase">{r.name}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${r.isPermission ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-700 text-slate-300'}`}>
                              {r.isPermission ? 'Permiso' : 'Novedad / Falta'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleStartEditReason(r)}
                              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[8px] font-black uppercase tracking-wider cursor-pointer"
                              title="Editar nombre o tipo"
                            >
                              ✏️ Editar
                            </button>
                            {novedadReasons.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteReason(r.id)}
                                className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 text-red-200 rounded-lg text-[8px] font-black uppercase tracking-wider cursor-pointer"
                                title="Eliminar razón"
                              >
                                🗑️ Eliminar
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulario Principal de la Novedad */}
            <div className="p-6 bg-white rounded-3xl border-2 border-slate-200 shadow-sm space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>📝</span> Registro de Nueva Novedad Administrativa
                </h5>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                  Complete la fecha, razón, duración de permiso (si aplica) y la observación correspondiente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Fecha de la Novedad */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider">
                    Fecha de la Novedad *
                  </label>
                  <input
                    type="date"
                    value={novedadFormData.date}
                    onChange={e => setNovedadFormData({...novedadFormData, date: e.target.value})}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                  />
                </div>

                {/* 2. Concepto / Razón de la Novedad */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider">
                    Concepto de la Novedad *
                  </label>
                  <select
                    value={novedadFormData.reason}
                    onChange={e => setNovedadFormData({...novedadFormData, reason: e.target.value})}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {novedadReasons.map(r => (
                      <option key={r.id} value={r.name}>
                        {r.name} {r.isPermission ? '— [PERMISO]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Tiempo de Permiso (Si la razón es un permiso) */}
              {(() => {
                const currentReasonObj = novedadReasons.find(r => r.name === novedadFormData.reason);
                const isPerm = currentReasonObj ? currentReasonObj.isPermission : novedadFormData.reason.toUpperCase().includes('PERMISO');
                
                if (!isPerm) return null;

                return (
                  <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                        <span>⏱️</span> Tiempo de Permiso: *
                      </label>
                      <span className="text-[8px] font-bold text-indigo-600 uppercase">Aplica para razones de tipo permiso</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setNovedadFormData({...novedadFormData, permissionType: 'entero'})}
                        className={`p-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${novedadFormData.permissionType === 'entero' ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-100'}`}
                      >
                        Día Laboral Entero
                      </button>
                      <button
                        type="button"
                        onClick={() => setNovedadFormData({...novedadFormData, permissionType: 'media_am'})}
                        className={`p-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${novedadFormData.permissionType === 'media_am' ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-100'}`}
                      >
                        Media Jornada (AM)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNovedadFormData({...novedadFormData, permissionType: 'media_pm'})}
                        className={`p-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${novedadFormData.permissionType === 'media_pm' ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-100'}`}
                      >
                        Media Jornada (PM)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNovedadFormData({...novedadFormData, permissionType: 'horas'})}
                        className={`p-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${novedadFormData.permissionType === 'horas' ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-100'}`}
                      >
                        Horas de Permiso
                      </button>
                    </div>

                    {novedadFormData.permissionType === 'horas' && (
                      <div className="p-3 bg-white rounded-xl border border-indigo-200 flex items-center justify-between gap-3">
                        <label className="text-[9px] font-black text-slate-700 uppercase">
                          Cantidad de Horas de Permiso:
                        </label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number"
                            min="0.5"
                            max="24"
                            step="0.5"
                            value={novedadFormData.permissionHours}
                            onChange={e => setNovedadFormData({...novedadFormData, permissionHours: Math.max(0.5, parseFloat(e.target.value) || 1)})}
                            className="w-24 p-2 bg-slate-50 border-2 border-indigo-300 rounded-xl text-xs font-mono font-black text-center outline-none focus:border-indigo-600 focus:bg-white"
                          />
                          <span className="text-[9px] font-black text-indigo-700 uppercase">HORAS</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 4. Observación */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider">
                  Observación y Justificación
                </label>
                <textarea
                  className="w-full border-2 border-slate-200 p-3.5 rounded-2xl text-xs font-bold uppercase focus:border-blue-500 outline-none min-h-[90px] bg-slate-50 focus:bg-white transition-all"
                  placeholder="Detalles u observaciones de la novedad..."
                  value={novedadFormData.observation}
                  onChange={e => setNovedadFormData({...novedadFormData, observation: e.target.value})}
                />
              </div>

              {/* Botón Guardar */}
              <button
                type="button"
                onClick={handleAddNovedad}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>💾</span>
                <span>Guardar Novedad en Bitácora</span>
              </button>
            </div>

            {/* Historial de Novedades del Colaborador */}
            <div className="p-5 bg-white rounded-3xl border-2 border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>📋</span> Historial de Eventos en Bitácora
                </h5>
                <span className="text-[9px] font-black text-slate-500 uppercase">
                  {selectedEmpAction.observations?.length || 0} Eventos Registrados
                </span>
              </div>

              <div className="space-y-2.5">
                {selectedEmpAction.observations && selectedEmpAction.observations.length > 0 ? (
                  selectedEmpAction.observations.map((obs, idx) => (
                    <div
                      key={obs.id || idx}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] font-mono font-black text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {obs.date ? obs.date.split('T')[0] : 'Sin fecha'}
                          </span>
                          {obs.reason && (
                            <span className="text-[9px] font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                              {obs.reason}
                            </span>
                          )}
                          {obs.permissionType && (
                            <span className="text-[8px] font-black text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                              {obs.permissionType === 'entero' ? 'DÍA ENTERO' : obs.permissionType === 'media_am' ? 'MEDIA JORNADA AM' : obs.permissionType === 'media_pm' ? 'MEDIA JORNADA PM' : `${obs.permissionHours}H PERMISO`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-800 uppercase mt-0.5">
                          {obs.observation || obs.text}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteObservation(obs.id || idx)}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shrink-0 self-end sm:self-auto"
                        title="Eliminar este evento de la bitácora"
                      >
                        <span>🗑️</span>
                        <span>Eliminar</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs font-bold uppercase italic">
                    Sin novedades registradas para este colaborador.
                  </div>
                )}
              </div>
            </div>

            {/* Botón Cerrar */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsNovedadModalOpen(false)}
                className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase text-[10px] tracking-widest cursor-pointer shadow-md"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isDesvinculacionModalOpen} onClose={() => setIsDesvinculacionModalOpen(false)} title="Dar de baja empleado" type="error">
         <div className="space-y-6">
            <div className="space-y-4">
               <input type="date" className="w-full border-2 p-3 rounded-xl text-xs font-bold" value={desvinculacionData.date} onChange={e => setDesvinculacionData({...desvinculacionData, date: e.target.value})} />
               <select className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase" value={desvinculacionData.reason} onChange={e => setDesvinculacionData({...desvinculacionData, reason: e.target.value as any})}>
                  {Object.values(TerminationReason).map(v => <option key={v} value={v}>{v}</option>)}
               </select>
               <textarea className="w-full border-2 p-3 rounded-xl text-xs font-bold uppercase h-24 focus:border-red-600 outline-none" placeholder="Observaciones finales..." value={desvinculacionData.details} onChange={e => setDesvinculacionData({...desvinculacionData, details: e.target.value})} />
            </div>
            <div className="flex gap-4">
               <button onClick={() => setIsDesvinculacionModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl uppercase text-[10px]">Cancelar</button>
               <button onClick={handleProcessDesvinculacion} className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] shadow-xl">Confirmar Baja</button>
            </div>
         </div>
      </Modal>

      {/* MODAL RESETEO DE PIN */}
      <Modal 
        isOpen={resetPinModal.isOpen} 
        onClose={() => setResetPinModal({ ...resetPinModal, isOpen: false })} 
        title="Nuevo PIN Generado" 
        type="success"
        maxWidth="max-w-md"
      >
        <div className="text-center p-4 space-y-6">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
            🔑
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900 uppercase">Clave Temporal Asignada</h4>
            <p className="text-[11px] font-bold text-slate-500 uppercase mt-1">Colaborador: <span className="text-slate-900 font-black">{resetPinModal.employeeName}</span></p>
          </div>
          <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl border-2 border-amber-400">
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">PIN Temporal de Marcación</p>
            <p className="text-4xl font-mono font-[950] tracking-[0.3em]">{resetPinModal.pin}</p>
          </div>
          <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">
            Entregue este PIN temporal al colaborador. Cuando ingrese a marcar asistencia, el sistema le pedirá registrar su nueva clave personal de 6 dígitos.
          </p>
          <button 
            type="button"
            onClick={() => setResetPinModal({ ...resetPinModal, isOpen: false })} 
            className="w-full py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg active:scale-95 cursor-pointer"
          >
            Entendido y Notificado
          </button>
        </div>
      </Modal>

      {/* FORMULARIO DE USO ADMINISTRATIVO DE VACACIONES GOZADAS */}
      <Modal
        isOpen={isVacationModalOpen}
        onClose={() => setIsVacationModalOpen(false)}
        title="Formulario Administrativo de Vacaciones Gozadas"
        maxWidth="max-w-4xl"
      >
        {(() => {
          const currentVacationEmp = employees.find(e => e.id === selectedVacationEmpId) || employees[0];
          const totalEnjoyedDays = (currentVacationEmp?.vacations || []).reduce(
            (sum, v) => sum + (Number(v.days) || 0),
            0
          );

          return (
            <div className="space-y-6 pb-4 max-h-[80vh] overflow-y-auto custom-scroll pr-1">
              {/* Selector de Empleado */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">
                  1. Seleccionar Colaborador (a escoger)
                </label>
                <select
                  value={selectedVacationEmpId || currentVacationEmp?.id || ''}
                  onChange={e => setSelectedVacationEmpId(e.target.value)}
                  className="w-full p-3.5 bg-white border-2 border-slate-300 rounded-xl text-xs font-black uppercase outline-none focus:border-emerald-600 transition-all cursor-pointer shadow-sm"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.surname} {e.name} — C.I.: {e.identification} — {e.role} ({e.status === 'active' ? 'ACTIVO' : 'BAJA'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ficha Resumen del Colaborador Seleccionado */}
              {currentVacationEmp && (
                <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 rounded-3xl border-2 border-emerald-200/80 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h4 className="text-base font-[950] text-slate-900 uppercase tracking-tight">
                        {currentVacationEmp.surname} {currentVacationEmp.name}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        C.I.: <span className="font-mono text-slate-800">{currentVacationEmp.identification}</span> • Cargo: <span className="text-blue-700">{currentVacationEmp.role}</span> • Ingreso: <span className="text-slate-700">{currentVacationEmp.startDate}</span>
                      </p>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-2xl border border-emerald-300 shadow-sm text-right shrink-0">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Total Vacaciones Gozadas</span>
                      <span className="text-xl font-[950] font-mono text-emerald-700">{totalEnjoyedDays} DÍAS</span>
                    </div>
                  </div>

                  {/* Impacto en liquidaciones y derechos laborales */}
                  <div className="p-3 bg-white/80 rounded-2xl border border-emerald-200 text-[9px] font-bold text-slate-700 leading-relaxed uppercase flex items-start gap-2">
                    <span className="text-sm">⚖️</span>
                    <div>
                      <span className="text-emerald-900 font-black">INFLUENCIA EN CÁLCULOS LABORALES Y LIQUIDACIONES:</span> Conforme a los Arts. 69 y 71 del Código del Trabajo, cada día de vacaciones gozado registrado para este colaborador se descontará automáticamente del total de días devengados al generar su preliquidación, acta de finiquito y liquidación definitiva de haberes.
                    </div>
                  </div>
                </div>
              )}

              {/* Formulario de Registro de Nuevo Período */}
              <div className="p-6 bg-white rounded-3xl border-2 border-slate-200 shadow-sm space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>🗓️</span> 2. Indicar Período de Vacaciones Gozadas
                  </h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    Señale la fecha en la que inicia sus vacaciones y la fecha en la que termina las mismas
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Fecha de Inicio */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider">
                      Fecha en la que inicia: *
                    </label>
                    <input
                      type="date"
                      value={vacationForm.startDate}
                      onChange={e => handleVacationDateChange('startDate', e.target.value)}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-emerald-600 focus:bg-white transition-all cursor-pointer"
                    />
                  </div>

                  {/* Fecha de Fin */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider">
                      Fecha en la que termina: *
                    </label>
                    <input
                      type="date"
                      value={vacationForm.endDate}
                      onChange={e => handleVacationDateChange('endDate', e.target.value)}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-emerald-600 focus:bg-white transition-all cursor-pointer"
                    />
                  </div>

                  {/* Días Calculados */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider flex items-center justify-between">
                      <span>Días Gozados:</span>
                      <span className="text-[8px] text-emerald-600 font-bold">Auto-calculado</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={vacationForm.days}
                      onChange={e => setVacationForm({ ...vacationForm, days: Number(e.target.value) || 0 })}
                      className="w-full p-3 bg-emerald-50/50 border-2 border-emerald-300 rounded-xl text-xs font-black text-emerald-800 text-center outline-none focus:border-emerald-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Motivo / Detalle Administrativo */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider">
                    Detalle / Concepto / Observación Administrativa:
                  </label>
                  <input
                    type="text"
                    placeholder="EJ: VACACIONES ANUALES AUTORIZADAS CORRESPONDIENTES AL PERÍODO 2025-2026..."
                    value={vacationForm.notes}
                    onChange={e => setVacationForm({ ...vacationForm, notes: e.target.value })}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-emerald-600 focus:bg-white transition-all"
                  />
                </div>

                {/* Botón de Guardado */}
                <button
                  type="button"
                  onClick={handleSaveVacation}
                  className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-[950] rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-700/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>💾</span>
                  <span>Registrar Período de Vacaciones Gozadas</span>
                </button>
              </div>

              {/* Historial de Períodos Registrados */}
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>📋</span> Historial de Vacaciones Gozadas del Colaborador
                  </h4>
                  <span className="text-[9px] font-black text-slate-500 uppercase">
                    {currentVacationEmp?.vacations?.length || 0} Registros
                  </span>
                </div>

                <div className="space-y-2">
                  {currentVacationEmp?.vacations && currentVacationEmp.vacations.length > 0 ? (
                    currentVacationEmp.vacations.map((vac) => (
                      <div
                        key={vac.id}
                        className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-emerald-300 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 uppercase">
                              Inicio: {vac.startDate} ➔ Fin: {vac.endDate}
                            </span>
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-lg">
                              {vac.days} {vac.days === 1 ? 'DÍA' : 'DÍAS'}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-600 uppercase">
                            {vac.notes || 'PERÍODO DE VACACIONES GOZADAS'}
                          </p>
                          <p className="text-[8px] font-mono text-slate-400">
                            Registrado: {new Date(vac.registeredAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => currentVacationEmp && handleDeleteVacation(currentVacationEmp.id, vac.id)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
                          title="Eliminar registro"
                        >
                          <span>🗑️</span>
                          <span>Eliminar</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs font-bold uppercase italic">
                      Este colaborador no registra días de vacaciones gozadas. El cálculo de liquidación considerará los días devengados completos.
                    </div>
                  )}
                </div>
              </div>

              {/* Botón de Cierre */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsVacationModalOpen(false)}
                  className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase text-[10px] tracking-widest cursor-pointer shadow-md"
                >
                  Listo / Cerrar
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* MODAL DE LIQUIDACIÓN LABORAL ECUATORIANA */}
      {settlementTargetEmp && (
        <SettlementModal
          isOpen={isSettlementModalOpen}
          onClose={() => {
            setIsSettlementModalOpen(false);
            setSettlementTargetEmp(null);
          }}
          employee={settlementTargetEmp}
          company={company}
          settings={settings || {
            sbu: 482.00,
            sbuPrev: 460.00,
            iessRate: 0.0945,
            reserveRate: 0.0833,
            holidays: [],
            schedule: {
              monFri: { in1: '08:30', out1: '13:00', in2: '15:00', out2: '18:00' },
              sat: { in: '08:30', out: '13:00' },
              halfDayOff: 'Miércoles tarde'
            }
          }}
          payments={payments}
          onConfirmSettlement={handleConfirmSettlement}
          existingSettlement={settlementTargetEmp.settlement}
          readOnly={isSettlementReadOnly}
        />
      )}

      {/* FICHA INDIVIDUAL DE PERSONAL OFICIAL A4 */}
      <EmployeeFileModal
        isOpen={!!selectedEmpForFicha}
        onClose={() => setSelectedEmpForFicha(null)}
        employee={selectedEmpForFicha}
        company={company}
        settings={settings}
        attendance={attendance}
        payments={payments}
      />

      {/* MODAL DE CONFIRMACIÓN DE ACCIONES */}
      <ConfirmationModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        confirmText={confirmAction.confirmText}
        type={confirmAction.type}
        onConfirm={confirmAction.onConfirm}
        onCancel={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default EmployeeModule;
