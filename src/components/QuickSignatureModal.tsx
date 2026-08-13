import React, { useState, useRef, useEffect } from 'react';
import { X, Check, PenTool, Upload, RefreshCw, CheckCircle2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { OrganizationSettings } from '../types';
import { DEFAULT_PRESET_SIGNATURES, PresetSignatureItem } from '../utils/signaturePresets';

interface QuickSignatureModalProps {
  settings: OrganizationSettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSettings: OrganizationSettings) => void;
}

export default function QuickSignatureModal({ settings, isOpen, onClose, onSave }: QuickSignatureModalProps) {
  const [activeTab, setActiveTab] = useState<'preset' | 'draw' | 'upload'>('preset');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    settings.selectedPresetSignatureId || DEFAULT_PRESET_SIGNATURES[0].id
  );
  const [usePreset, setUsePreset] = useState<boolean>(settings.usePresetSignature ?? true);
  const [customSignature, setCustomSignature] = useState<string | undefined>(settings.signature);
  const [penColor, setPenColor] = useState<string>('#1e293b');
  const [penWidth, setPenWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUsePreset(settings.usePresetSignature ?? true);
      setSelectedPresetId(settings.selectedPresetSignatureId || DEFAULT_PRESET_SIGNATURES[0].id);
      setCustomSignature(settings.signature);
    }
  }, [isOpen, settings]);

  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [activeTab, penColor, penWidth]);

  if (!isOpen) return null;

  // Drawing Canvas Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      try {
        setCustomSignature(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Canvas export error:', err);
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setCustomSignature(undefined);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomSignature(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    let finalSignature = customSignature;

    if (activeTab === 'preset') {
      const foundPreset = DEFAULT_PRESET_SIGNATURES.find(p => p.id === selectedPresetId);
      if (foundPreset) {
        finalSignature = foundPreset.image;
      }
    }

    const updatedSettings: OrganizationSettings = {
      ...settings,
      signature: finalSignature,
      usePresetSignature: usePreset,
      selectedPresetSignatureId: selectedPresetId,
    };

    onSave(updatedSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">إدارة التوقيع المسبق</h3>
              <p className="text-slate-500 text-xs mt-0.5">اختر أو ارسم توقيعك ليتم إدراجه تلقائياً في جميع السندات</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 hover:bg-white rounded-full text-slate-400 hover:text-slate-900 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Automatic inclusion toggle */}
          <div className="flex items-center justify-between p-4 bg-blue-50/60 rounded-2xl border border-blue-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">تضمين التوقيع المسبق تلقائياً</h4>
              <p className="text-xs text-slate-500 mt-0.5">إدراج التوقيع في خانة "توقيع المستلم / أمين الصندوق" بجميع السندات</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={usePreset} 
                onChange={(e) => setUsePreset(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Selection Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100/80 rounded-2xl">
            <button
              onClick={() => setActiveTab('preset')}
              className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'preset' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sparkles size={16} />
              نماذج جاهزة
            </button>
            <button
              onClick={() => setActiveTab('draw')}
              className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'draw' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <PenTool size={16} />
              رسم يدوي
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Upload size={16} />
              رفع صورة
            </button>
          </div>

          {/* Tab 1: Presets */}
          {activeTab === 'preset' && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-600">اختر توقيعاً مسبقاً جاهزاً:</p>
              <div className="grid grid-cols-1 gap-3">
                {DEFAULT_PRESET_SIGNATURES.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                      selectedPresetId === preset.id
                        ? 'border-blue-500 bg-blue-50/30 shadow-sm'
                        : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-12 bg-white rounded-lg border border-slate-200 p-1 flex items-center justify-center overflow-hidden">
                        <img src={preset.image} alt={preset.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">{preset.name}</span>
                    </div>

                    {selectedPresetId === preset.id && (
                      <div className="text-blue-600">
                        <CheckCircle2 size={20} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Canvas Drawing */}
          {activeTab === 'draw' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span>وقّع إصبعك أو الماوس داخل المربع:</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {['#1e293b', '#1e40af', '#047857'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setPenColor(color)}
                        className={`w-5 h-5 rounded-full border border-white transition-transform ${
                          penColor === color ? 'scale-125 ring-2 ring-blue-500' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="flex items-center gap-1 text-red-500 hover:text-red-600 px-2 py-1 rounded-lg bg-red-50 text-[11px]"
                  >
                    <RefreshCw size={12} />
                    مسح
                  </button>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60 p-2 relative overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={480}
                  height={160}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-40 bg-white rounded-xl shadow-inner cursor-crosshair touch-none"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-sm font-medium">
                    ارسم توقيعك هنا...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Upload Image */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-8 bg-slate-50/50 flex flex-col items-center justify-center text-center relative group transition-all">
                {customSignature && activeTab === 'upload' ? (
                  <div className="space-y-3">
                    <img src={customSignature} alt="Custom Signature" className="h-24 object-contain mx-auto" />
                    <p className="text-xs text-emerald-600 font-bold">تم رفع صورة التوقيع بنجاح</p>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-white rounded-2xl shadow-sm text-slate-400 mb-3 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                      <ImageIcon size={32} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">اضغط لرفع صورة التوقيع</p>
                    <p className="text-xs text-slate-400 mt-1">يدعم صيغ PNG شفاف، JPG</p>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 py-3.5 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Check size={18} />
              حفظ التوقيع وتطبيقه
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3.5 bg-white text-slate-600 border border-slate-200 font-bold rounded-2xl hover:bg-slate-50 transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
