import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { logger } from '../lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary', 'Error capturado en el árbol de componentes', { error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-slate-50 text-center">
          <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-200 max-w-lg w-full">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Error Crítico Detectado</h2>
            <p className="text-slate-500 text-sm font-medium mb-8">
              La aplicación ha encontrado un problema inesperado. Los logs técnicos ya han sido registrados para su auditoría.
            </p>
            <div className="bg-slate-50 p-4 rounded-2xl text-left mb-8 overflow-auto max-h-32">
              <p className="text-[10px] font-mono text-red-700 break-all">{this.state.error?.message}</p>
            </div>
            <button 
              onClick={this.handleReset}
              className="w-full py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
