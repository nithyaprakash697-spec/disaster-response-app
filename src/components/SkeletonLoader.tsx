import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 animate-pulse flex flex-col justify-between h-32">
          <div className="flex justify-between items-center">
            <div className="h-4 bg-slate-800 rounded w-1/2"></div>
            <div className="h-6 w-6 bg-slate-800 rounded-full"></div>
          </div>
          <div className="h-8 bg-slate-800 rounded w-3/4 my-2"></div>
          <div className="h-3 bg-slate-800/60 rounded w-1/3"></div>
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC = () => {
  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-4 animate-pulse space-y-3">
      <div className="h-6 bg-slate-800 rounded w-1/4 mb-4"></div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-slate-800/50">
          <div className="h-4 bg-slate-800 rounded w-1/3"></div>
          <div className="h-4 bg-slate-800 rounded w-1/6"></div>
          <div className="h-4 bg-slate-800 rounded w-1/5"></div>
          <div className="h-6 bg-slate-800 rounded-full w-16"></div>
        </div>
      ))}
    </div>
  );
};

export const MapSkeleton: React.FC = () => {
  return (
    <div className="w-full h-[500px] bg-slate-900/80 border border-slate-800 rounded-2xl animate-pulse flex items-center justify-center flex-col gap-3">
      <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-red-500 animate-spin"></div>
      <p className="text-slate-400 text-sm font-medium">Loading Interactive GIS Map & Rain Radar...</p>
    </div>
  );
};
