import * as React from 'react';
import { AlertCircle, RefreshCcw, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type PrintStatus = 'idle' | 'processing' | 'success' | 'error';

interface PrintContextType {
  status: PrintStatus;
  setStatus: (status: PrintStatus, message?: string) => void;
  logEvent: (message: string, data?: any) => void;
}

const PrintContext = React.createContext<PrintContextType | undefined>(undefined);

export function usePrint() {
  const context = React.useContext(PrintContext);
  if (!context) {
    throw new Error('usePrint must be used within a PrintErrorBoundary');
  }
  return context;
}

interface PrintProps {
  children: React.ReactNode;
  onRetry?: () => void;
}

interface PrintState {
  hasError: boolean;
  error: Error | null;
  status: PrintStatus;
  statusMessage: string;
}

export class PrintErrorBoundary extends React.Component<PrintProps, PrintState> {
  constructor(props: PrintProps) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
      status: 'idle',
      statusMessage: ''
    };
    this.handleRetry = this.handleRetry.bind(this);
    this.setStatus = this.setStatus.bind(this);
    this.logEvent = this.logEvent.bind(this);
  }

  public static getDerivedStateFromError(error: Error): Partial<PrintState> {
    return { hasError: true, error, status: 'error' };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.logDetailedError(error, errorInfo);
  }

  private logDetailedError(error: Error, errorInfo?: React.ErrorInfo) {
    const detailedLog = {
      type: 'PRINT_SYSTEM_ERROR',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      platform: navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };
    
    console.group('🚨 Print System Detailed Error Log');
    console.error('Error Details:', detailedLog);
    console.groupEnd();
  }

  private logEvent(message: string, data?: any) {
    console.log(`[PrintEvent] ${new Date().toISOString()} - ${message}`, data || '');
  }

  private setStatus(status: PrintStatus, message: string = '') {
    (this as any).setState({ status, statusMessage: message });
    if (status === 'success') {
      setTimeout(() => (this as any).setState({ status: 'idle', statusMessage: '' }), 3000);
    }
  }

  private handleRetry() {
    (this as any).setState({ hasError: false, error: null, status: 'idle', statusMessage: '' });
    if ((this as any).props.onRetry) {
      (this as any).props.onRetry();
    }
  }

  public render() {
    const { hasError, error, status, statusMessage } = (this as any).state;
    const { children } = (this as any).props;

    const contextValue: PrintContextType = {
      status,
      setStatus: this.setStatus,
      logEvent: this.logEvent
    };

    return (
      <PrintContext.Provider value={contextValue}>
        <div className="relative">
          {hasError ? (
            <div className="p-8 border-2 border-dashed border-red-200 rounded-xl bg-red-50 flex flex-col items-center justify-center text-center space-y-4 my-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-red-900 font-cairo">عذراً، حدث خطأ أثناء معالجة السند</h3>
                <p className="text-red-700 text-sm font-cairo max-w-md">
                  واجهنا مشكلة تقنية أثناء محاولة عرض أو تصدير السند. يمكنك المحاولة مرة أخرى أو التواصل مع الدعم الفني.
                </p>
              </div>
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-cairo font-medium shadow-sm"
              >
                <RefreshCcw className="w-4 h-4" />
                إعادة المحاولة
              </button>
              {process.env.NODE_ENV === 'development' && (
                <pre className="mt-4 p-4 bg-white/50 rounded text-xs text-left overflow-auto max-w-full text-red-800 border border-red-100">
                  {error?.message}
                </pre>
              )}
            </div>
          ) : (
            children
          )}

          {/* Status Popup/Overlay */}
          <AnimatePresence>
            {status !== 'idle' && !hasError && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] min-w-[300px]"
              >
                <div className={`flex items-center gap-3 p-4 rounded-2xl shadow-2xl border ${
                  status === 'processing' ? 'bg-white border-blue-100 text-blue-900' :
                  status === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                  'bg-red-50 border-red-100 text-red-900'
                }`}>
                  {status === 'processing' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
                  {status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                  
                  <div className="flex-1">
                    <p className="text-sm font-bold font-cairo">
                      {status === 'processing' ? 'جاري تصدير السند...' :
                       status === 'success' ? 'تم تصدير السند بنجاح' :
                       'فشل تصدير السند'}
                    </p>
                    {statusMessage && <p className="text-xs opacity-70 font-cairo">{statusMessage}</p>}
                  </div>

                  {status === 'error' && (
                    <button 
                      onClick={this.handleRetry}
                      className="p-1 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <RefreshCcw className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PrintContext.Provider>
    );
  }
}
