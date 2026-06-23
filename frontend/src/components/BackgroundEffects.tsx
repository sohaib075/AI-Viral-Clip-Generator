import React from 'react';

const BackgroundEffects = () => {
  return (
    <>
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-white/20 rounded-full blur-[150px] pointer-events-none animate-float"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-yellow-400/30 rounded-full blur-[120px] pointer-events-none animate-float" style={{ animationDelay: '2s' }}></div>
    </>
  );
};

export default BackgroundEffects;
