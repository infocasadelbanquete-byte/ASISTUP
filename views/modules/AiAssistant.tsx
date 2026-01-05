import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Employee, AttendanceRecord, Payment, Role } from '../../types.ts';

interface AiAssistantProps {
  employees: Employee[];
  attendance: AttendanceRecord[];
  payments: Payment[];
  role: Role;
}

const AiAssistant: React.FC<AiAssistantProps> = ({ employees, attendance, payments, role }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleAskAi = async () => {
    if (!prompt.trim()) return;
    setIsTyping(true);
    setResponse('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const activeEmps = employees.filter(e => e.status === 'active').length;
      const totalPayments = payments.reduce((acc, p) => acc + (p.status === 'paid' ? p.amount : 0), 0);
      
      const context = `
        Eres un consultor experto en Talento Humano y legislación laboral ecuatoriana. 
        Contexto de la empresa actual:
        - Colaboradores activos: ${activeEmps}
        - Total nómina procesada este mes: $${totalPayments.toFixed(2)}
        - Registros de asistencia totales: ${attendance.length}
        
        Pregunta del administrador: ${prompt}
      `;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: context,
        config: {
          systemInstruction: "Proporciona respuestas profesionales, concisas y basadas en mejores prácticas de RRHH. Si la pregunta es sobre leyes ecuatorianas, menciona que es una guía general.",
          temperature: 0.7,
        }
      });

      setResponse(result.text || "No pude generar una respuesta en este momento.");
    } catch (error) {
      setResponse("Error al conectar con la inteligencia artificial. Verifique su conexión.");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto pb-20">
      <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl animate-pulse">✨</div>
            <div>
              <h2 className="text-2xl font-[950] uppercase tracking-tighter italic">Asistente IA Estratégico</h2>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.4em]">Powered by Gemini 3 Flash</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
            Analiza patrones de asistencia, solicita recomendaciones para mejorar el clima laboral o resuelve dudas sobre el Código de Trabajo.
          </p>
          
          <div className="flex gap-4">
            <input 
              type="text" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
              placeholder="Ej: ¿Cómo puedo reducir el ausentismo este mes?"
              className="flex-1 bg-white/10 border border-white/20 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-white/30"
            />
            <button 
              onClick={handleAskAi}
              disabled={isTyping}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-50"
            >
              {isTyping ? 'Analizando...' : 'Consultar'}
            </button>
          </div>
        </div>
      </div>

      {response && (
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Respuesta de la IA</h3>
          </div>
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 text-sm leading-8 font-medium whitespace-pre-wrap">
              {response}
            </p>
          </div>
        </div>
      )}
      
      {!response && !isTyping && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {[
             "¿Qué beneficios de ley son obligatorios en Ecuador?",
             "Analiza la productividad según la nómina actual",
             "Estrategias para retención de talento humano"
           ].map((q, i) => (
             <button 
               key={i}
               onClick={() => { setPrompt(q); }}
               className="p-6 bg-white border border-slate-100 rounded-3xl text-left hover:border-blue-500 transition-all group"
             >
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-blue-600">Sugerencia</p>
                <p className="text-[11px] font-bold text-slate-700 leading-tight">{q}</p>
             </button>
           ))}
        </div>
      )}
    </div>
  );
};

export default AiAssistant;