import React from 'react';

export default function ViewLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-[#C7958E] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-[#5D7180]">Cargando...</p>
      </div>
    </div>
  );
}

