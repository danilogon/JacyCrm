import React from 'react';

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Ocorreu um erro inesperado</h2>
            <p className="text-gray-600 mb-4 text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 text-sm"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
