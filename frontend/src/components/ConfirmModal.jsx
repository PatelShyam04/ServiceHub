import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, Info, X } from 'lucide-react';

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  isLoading = false
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  const iconVariants = {
    danger: (
      <div className="w-14 h-14 rounded-2xl bg-[#FEF3F2] text-[#F04438] flex items-center justify-center ring-8 ring-[#FEF3F2]/60 mb-1">
        <Trash2 className="w-7 h-7" />
      </div>
    ),
    warning: (
      <div className="w-14 h-14 rounded-2xl bg-[#FFFAEB] text-[#F79009] flex items-center justify-center ring-8 ring-[#FFFAEB]/60 mb-1">
        <AlertTriangle className="w-7 h-7" />
      </div>
    ),
    info: (
      <div className="w-14 h-14 rounded-2xl bg-[#EFF8FF] text-[#2E90FA] flex items-center justify-center ring-8 ring-[#EFF8FF]/60 mb-1">
        <Info className="w-7 h-7" />
      </div>
    ),
  };

  const btnClasses = {
    danger: 'bg-[#F04438] hover:bg-[#D92D20] text-white shadow-md shadow-[#F04438]/20',
    warning: 'bg-[#F79009] hover:bg-[#DC7800] text-white shadow-md shadow-[#F79009]/20',
    info: 'bg-[#5B4CF7] hover:bg-[#4A3EEA] text-white shadow-md shadow-[#5B4CF7]/20',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isLoading && onClose()}
            className="fixed inset-0 bg-[#101828]/60 backdrop-blur-sm"
          />

          {/* Dialog Container - Enterprise SaaS Modal Style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md p-6 bg-white border border-[#EAECF0] shadow-2xl rounded-[20px] z-10 flex flex-col items-center text-center gap-2 overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={() => !isLoading && onClose()}
              className="absolute top-4 right-4 p-2 rounded-full text-[#98A2B3] hover:text-[#101828] hover:bg-[#F2F4F7] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon */}
            {iconVariants[type] || iconVariants.danger}

            {/* Title */}
            <h3 className="text-[20px] font-bold text-[#101828] tracking-tight leading-snug mt-1">
              {title}
            </h3>

            {/* Message with high readability */}
            <p className="text-[15px] font-medium text-[#667085] leading-relaxed px-2">
              {message}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full mt-4 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-[12px] border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-[#344054] font-semibold text-[15px] transition-all cursor-pointer disabled:opacity-50"
              >
                {cancelText}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 py-2.5 px-4 rounded-[12px] font-semibold text-[15px] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${btnClasses[type] || btnClasses.danger}`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{confirmText}</span>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
