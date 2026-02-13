import React from 'react';
import { SEGMENT_COLORS } from '../../types';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-wrap gap-3">
      {SEGMENT_COLORS.map(color => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`w-8 h-8 rounded-full transition-all duration-200 border-2 hover:scale-110 active:scale-95 ${
            value === color
              ? 'border-white dark:border-white scale-110 shadow-lg'
              : 'border-transparent opacity-70 hover:opacity-100'
          }`}
          style={{ backgroundColor: color }}
          aria-label={`Select color ${color}`}
        />
      ))}
    </div>
  );
};

export default React.memo(ColorPicker);
