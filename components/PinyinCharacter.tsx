import React from 'react';
import { PinyinChar } from '../types';

interface Props {
  data: PinyinChar;
}

export const PinyinCharacter: React.FC<Props> = ({ data }) => {
  const isPunctuation = !data.pinyin || data.pinyin.trim() === '';
  
  // Punctuation shouldn't have pinyin space reserved to keep flow natural
  if (isPunctuation) {
    return (
      <span className="chinese-font text-3xl md:text-4xl text-accent self-end mb-1 ml-1">
        {data.char}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center justify-end mx-0.5 md:mx-1">
      <span className="text-xs md:text-sm text-gray-500 font-medium h-5 leading-none mb-0.5 select-none">
        {data.pinyin}
      </span>
      <span className="chinese-font text-3xl md:text-4xl text-accent leading-none">
        {data.char}
      </span>
    </div>
  );
};