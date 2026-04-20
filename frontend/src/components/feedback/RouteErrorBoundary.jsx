import { Component } from "react";

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    // Keep basic console logging for debugging route-level crashes.
    console.error("Route render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded border bg-white p-6">
          <h1 className="text-2xl font-bold">Page Error</h1>
          <p className="mt-2 text-zinc-700">
            This page failed to load. Please refresh or try again later.
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            {this.state.error?.message || "Unknown route rendering error"}
          </p>
        </section>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;

