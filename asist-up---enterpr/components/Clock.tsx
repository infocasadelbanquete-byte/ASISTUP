import React, { useState, useEffect } from 'react';

const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center">
      <div className="text-6xl font-black text-blue-900 tracking-tighter tabular-nums drop-shadow-md">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-lg text-blue-600 font-bold mt-1 uppercase tracking-widest">
        {time.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
    </div>
  );
};

export default Clock;