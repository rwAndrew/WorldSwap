
import React from 'react';

const EMOJIS = ['❤️', '😮', '🌏', '✨', '🔥'];

interface ReactionPickerProps {
  onReact: (emoji: string) => void;
}

const ReactionPicker: React.FC<ReactionPickerProps> = ({ onReact }) => {
  return (
    <div className="flex justify-between items-center glass p-2 rounded-full shadow-xl h-[72px] px-6 backdrop-blur-2xl">
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="hover:scale-150 active:scale-110 transition-transform duration-300 p-1 text-2xl grayscale hover:grayscale-0 drop-shadow-xl"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default ReactionPicker;
