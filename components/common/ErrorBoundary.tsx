import React, { Component, ErrorInfo, ReactNode } from 'react';
import { EXTERNAL_URLS } from '../../constants/api';
import { logger } from '../../lib/logger';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    logger.error("App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F0ED] p-6 text-center font-sans">
          <h1 className="text-2xl font-bold text-[#95706B] mb-4">Algo salió mal</h1>
          <p className="text-[#5D7180] mb-6">Lo sentimos. Ha ocurrido un error inesperado.</p>
          <button
            onClick={() => window.location.href = EXTERNAL_URLS.FERTYFIT_HOME}
            className="bg-[#C7958E] text-white px-6 py-3 rounded-full font-bold shadow-lg"
          >
            Volver a FertyFit.com
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

