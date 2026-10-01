import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { UnexpectedError } from '@shared/events';
import { describeWindowError } from './unexpectedErrors';
import { WindowErrorScreen } from './WindowErrorScreen';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: UnexpectedError | null;
}

/**
 * Catches an error thrown while rendering what it wraps, which React would answer by leaving the window blank, and
 * shows `WindowErrorScreen` in its place. The page's other errors become toasts (`reportUnexpectedErrors`).
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error: describeWindowError(error) ?? { message: String(error), details: String(error) } };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('The window ran into an error while rendering:', error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.error ? <WindowErrorScreen error={this.state.error} /> : this.props.children;
  }
}
