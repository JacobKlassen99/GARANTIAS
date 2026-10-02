import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || '' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error no capturado:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-white rounded border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {this.props.fallbackTitle || 'No se pudo cargar esta sección'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Ocurrió un problema temporal al procesar la información. Puede reintentar la operación.
          </p>
          <div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
