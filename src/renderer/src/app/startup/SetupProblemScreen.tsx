import { ArrowRight, CloudOff, Download, KeyRound, RefreshCw, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SetupProblem, SetupProblemKind } from '@shared/domain/setup';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { OutputBlock } from '../../ui/OutputBlock';
import { ScreenMessage } from '../../ui/ScreenMessage';
import { CopyableCommand } from './CopyableCommand';
import { DOWNLOAD_URL } from './installGuidance';

interface ProblemCopy {
  icon: ReactNode;
  title: (server: string) => string;
  explanation: string;
  /** Local servers may still work, so the user can go on unless `cm` has no configuration at all. */
  canContinue: boolean;
}

const COPY: Record<SetupProblemKind, ProblemCopy> = {
  notConfigured: {
    icon: <Settings2 size={26} />,
    title: () => "Unity Version Control isn't set up yet",
    explanation:
      'Unity Version Control needs to know who you are before it can work with a server. Sign in once with the Unity Version Control app, or set it up in a terminal, then retry.',
    canContinue: false,
  },
  notSignedIn: {
    icon: <KeyRound size={26} />,
    title: (server) => `You're not signed in to ${server}`,
    explanation:
      'This app uses the same sign-in as the Unity Version Control app. Sign in there once (or set it up in a terminal), then retry.',
    canContinue: true,
  },
  serverUnreachable: {
    icon: <CloudOff size={26} />,
    title: (server) => `Can't reach ${server}`,
    explanation: 'Check your network or VPN connection and that the server is running, then retry.',
    canContinue: true,
  },
};

interface SetupProblemScreenProps {
  problem: SetupProblem;
  checking: boolean;
  onRetry: () => void;
  onContinue: () => void;
}

/** Explains why `cm` can't work with its server (no profile, no sign-in, unreachable), instead of a trail of failing views. */
export function SetupProblemScreen({ problem, checking, onRetry, onContinue }: SetupProblemScreenProps) {
  const copy = COPY[problem.kind];

  return (
    <ScreenMessage
      icon={copy.icon}
      tone="warning"
      title={copy.title(problem.server ?? 'the server')}
      actions={
        <>
          <Button
            variant="primary"
            icon={<RefreshCw size={14} className={checking ? 'spinning' : undefined} />}
            onClick={onRetry}
            disabled={checking}
          >
            {checking ? 'Checking…' : 'Retry'}
          </Button>
          {problem.kind !== 'serverUnreachable' && (
            <Button icon={<Download size={14} />} onClick={() => void api.system.openExternal(DOWNLOAD_URL)}>
              Get the Unity Version Control app
            </Button>
          )}
          {copy.canContinue && (
            <Button variant="ghost" icon={<ArrowRight size={14} />} onClick={onContinue}>
              Continue anyway
            </Button>
          )}
        </>
      }
      footer={
        <>
          {problem.kind !== 'serverUnreachable' && <CopyableCommand note="Or set it up in a terminal:" command="cm configure" />}
          <OutputBlock output={`$ ${problem.commandLine}\n${problem.output}`} />
        </>
      }
    >
      <p>{copy.explanation}</p>
    </ScreenMessage>
  );
}
