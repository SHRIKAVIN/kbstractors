import { X, User, Phone, Calendar, DollarSign, FileText, AlertCircle } from 'lucide-react';
import type { RentalRecord } from '../types/rental';
import { formatCurrency, calculateTotalAmount } from '../utils/calculations';
import { useEffect, useRef, useState } from 'react';

interface RecordDetailsPopupProps {
  record: RentalRecord | null;
  isOpen: boolean;
  onClose: () => void;
  triggerElement?: HTMLElement | null;
}

export function RecordDetailsPopup({ record, isOpen, onClose, triggerElement }: RecordDetailsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [animationState, setAnimationState] = useState<'opening' | 'open' | 'closing' | 'closed'>('closed');
  const [transformOrigin, setTransformOrigin] = useState('center center');

  // Prevent body scrolling when popup is open (PWA/mobile compatible)
  useEffect(() => {
    if (isOpen) {
      // Store the current scroll position
      const scrollY = window.scrollY;
      
      // Apply styles to prevent scrolling (PWA/mobile compatible)
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';
      
      // Cleanup function to restore scrolling
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.documentElement.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Handle opening animation
  useEffect(() => {
    if (isOpen) {
      setAnimationState('opening');
      // Calculate transform origin based on trigger element position
      if (triggerElement) {
        const rect = triggerElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        setTransformOrigin(`${centerX}px ${centerY}px`);
      }
      // Transition to open state after animation
      setTimeout(() => setAnimationState('open'), 300);
    }
  }, [isOpen, triggerElement]);

  // Handle closing animation
  useEffect(() => {
    if (!isOpen && animationState === 'open') {
      setAnimationState('closing');
      // Keep component mounted during closing animation
      setTimeout(() => {
        setAnimationState('closed');
      }, 500);
    }
  }, [isOpen, animationState]);

  // Only return null when animation is completely finished
  if (animationState === 'closed' || !record) {
    return null;
  }

  const isPaid = record.received_amount >= record.total_amount;
  const balanceAmount = record.total_amount - record.received_amount;

  const getAnimationClasses = () => {
    switch (animationState) {
      case 'opening':
        return 'scale-0 opacity-0';
      case 'open':
        return 'scale-100 opacity-100';
      case 'closing':
        return 'scale-0 opacity-0';
      default:
        return 'scale-0 opacity-0';
    }
  };


  return (
    <div 
      className={`fixed inset-0 bg-black flex items-center justify-center z-50 p-4 transition-all duration-300 ${
        animationState === 'open' ? 'bg-opacity-50' : 'bg-opacity-0'
      }`}
      onClick={onClose}
    >
      <div 
        ref={popupRef}
        className={`bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-500 ${getAnimationClasses()}`}
        style={{ 
          transformOrigin,
          transition: animationState === 'closing' 
            ? 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' 
            : 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-blue-900">{record.name}</h2>
              <p className="text-sm text-gray-500">வாடகை பதிவு விவரங்கள்</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className={`p-6 space-y-6 transition-all duration-700 ease-out delay-200 ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          {/* Basic Information */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-600 ease-out delay-300 ${
            isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}>
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-500">பதிவு தேதி</p>
                <p className="text-sm text-gray-900">
                  {new Date(record.created_at).toLocaleDateString('ta-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
            
            {record.mobile_number && (
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-500">மொபைல் எண்</p>
                  <p className="text-sm text-gray-900">{record.mobile_number}</p>
                </div>
              </div>
            )}
          </div>

          {/* Equipment Details */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              உபகரண விவரங்கள்
            </h3>
            <div className="space-y-2">
              {record.details.map((detail, index) => {
                let amount = 0;
                // Calculate amount for each equipment detail
                if (detail.equipment_type === 'Dipper') {
                  amount = 500 * (parseInt(String(detail.nadai || '0')) || 0);
                } else {
                  amount = calculateTotalAmount(
                    parseFloat(String(detail.acres || '0')) || 0,
                    parseFloat(String(detail.rounds || '0')) || 0,
                    detail.equipment_type
                  );
                }

                return (
                  <div key={index} className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-gray-500">மா:</span>
                          <span className="text-gray-900 font-medium">{detail.acres}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-gray-500">சால்:</span>
                          <span className="text-gray-900 font-medium">{detail.rounds}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-gray-500">வகை:</span>
                          <span className="text-gray-900 font-medium">{detail.equipment_type}</span>
                        </div>
                        {detail.nadai && (
                          <div className="flex items-center space-x-1">
                            <span className="font-medium text-gray-500">நடை:</span>
                            <span className="text-gray-900 font-medium">{detail.nadai}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-500">தொகை</span>
                        <span className="text-base font-semibold text-blue-600">{formatCurrency(amount)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financial Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              நிதி விவரங்கள்
            </h3>
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3 space-y-2 border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">மொத்த தொகை</span>
                <span className="text-base font-semibold text-gray-900">{formatCurrency(record.total_amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">பெறப்பட்ட தொகை</span>
                <span className="text-base font-semibold text-green-600">{formatCurrency(record.received_amount)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">நிலுவை தொகை</span>
                  <span className={`text-base font-semibold ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(balanceAmount)}
                  </span>
                </div>
                <div className="flex items-center mt-1">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium ${
                    isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {isPaid ? 'செலுத்தப்பட்டது' : 'நிலுவையில்'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Old Balance Information */}
          {record.old_balance && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                பழைய நிலுவை விவரங்கள்
              </h3>
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-3 space-y-2 border border-yellow-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">பழைய நிலுவை</span>
                  <span className="text-base font-semibold text-gray-900">{record.old_balance}</span>
                </div>
                {record.old_balance_reason && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">காரணம்</span>
                    <p className="text-sm text-gray-900 mt-1">{record.old_balance_reason}</p>
                  </div>
                )}
                {record.old_balance_status && (
                  <div className="flex items-center">
                    <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium ${
                      record.old_balance_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {record.old_balance_status === 'paid' ? 'செலுத்தப்பட்டது' : 'நிலுவையில்'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
