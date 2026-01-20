import React, { useState, useEffect, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  color?: string;
}

const Knob: React.FC<KnobProps> = ({ label, value, min = 0, max = 100, onChange, color = 'bg-gray-300' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number>(0);
  const startValue = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startY.current - e.clientY;
      const range = max - min;
      // Sensitivity: 200px moves full range
      const deltaValue = (deltaY / 200) * range;
      let newValue = startValue.current + deltaValue;
      newValue = Math.max(min, Math.min(max, newValue));
      onChange(Math.round(newValue));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, max, min, onChange]);

  // Calculate rotation: -135deg to +135deg
  const percentage = (value - min) / (max - min);
  const rotation = -135 + (percentage * 270);

  return (
    <div className="flex flex-col items-center gap-2 knob-container select-none">
      <div 
        className="relative w-16 h-16 rounded-full bg-gray-700 shadow-xl border-2 border-gray-600 cursor-ns-resize group hover:border-gray-400 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div 
          className="absolute w-full h-full rounded-full transition-transform duration-75 ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className={`w-1.5 h-6 mx-auto mt-1 rounded-sm ${color} shadow-[0_0_5px_rgba(255,255,255,0.5)]`}></div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</div>
        <div className="text-xs text-blue-400 font-mono">{value}</div>
      </div>
    </div>
  );
};

export default Knob;
