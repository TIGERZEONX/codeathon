'use client';
import React, { useEffect } from 'react';
interface ModalProps { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; size?: 'sm'|'md'|'lg'|'xl'; }
const sizeMap = { sm:'max-w-sm', md:'max-w-md', lg:'max-w-lg', xl:'max-w-2xl' };
export function Modal({ open, onClose, title, children, size='md' }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className={`relative bg-white rounded-xl shadow-xl w-full ${sizeMap[size]} max-h-[90vh] overflow-y-auto`}>
        {(title || true) && (
          <div className="flex items-center justify-between p-5 border-b">
            {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
            <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-gray-100 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
