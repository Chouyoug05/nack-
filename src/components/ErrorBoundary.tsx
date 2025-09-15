import React from "react";

type ErrorBoundaryProps = {
  onReset?: () => void;
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: any;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // Optional: log to a service
    // console.error("ErrorBoundary caught: ", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <div className="rounded-lg border p-6 bg-card">
            <h2 className="text-lg font-semibold mb-2">Une erreur est survenue</h2>
            <p className="text-sm text-muted-foreground mb-4">La page a rencontré un problème. Vous pouvez réessayer.</p>
            <button onClick={this.handleReset} className="px-4 py-2 rounded bg-nack-red text-white">Recharger la section</button>
          </div>
        </div>
      );
    }
    return this.props.children as JSX.Element;
  }
} 