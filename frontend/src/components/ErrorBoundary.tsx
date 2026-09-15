import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-shell items-center justify-center text-center py-28">
          <h2 className="page-title mb-2">Something went wrong</h2>
          <p className="page-subtitle max-w-lg mx-auto mb-8">{this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })} className="btn-primary">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
