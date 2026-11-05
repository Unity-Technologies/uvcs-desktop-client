import { useEffect, useRef, useState } from 'react';
import type { DeviceSignIn as DeviceCode, SignInOutcome } from '@shared/domain/issueTrackers';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Spinner } from '../../../ui/Spinner';
import { deviceCodeWords } from './connectFlow';
import styles from './IssueTrackerPane.module.css';

interface DeviceSignInProps {
  repository: string;
  linkText: string;
  trackerName: string;
  onOutcome: (outcome: SignInOutcome) => void;
  /** A token instead, for those who'd rather (a quiet link). */
  onUseToken: () => void;
}

/**
 * Signing in through the browser with OAuth's device flow (docs/features/issue-trackers.md, "Sign-in"): one button
 * shows the one-time code, copies it and opens the tracker's page, where the user pastes it and approves; main polls
 * at the tracker's pace meanwhile, and the proof follows.
 */
export function DeviceSignIn({ repository, linkText, trackerName, onOutcome, onUseToken }: DeviceSignInProps) {
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [starting, setStarting] = useState(false);
  const flow = useRef<string | null>(null);
  // A step left before the code is approved (Settings closed, another link pasted) stops the polling.
  useEffect(
    () => () => {
      if (flow.current) void api.issueTrackers.cancelDeviceSignIn(flow.current);
    },
    [],
  );

  const start = async (): Promise<void> => {
    setStarting(true);
    const started = await api.issueTrackers.startDeviceSignIn({ repository, link: linkText });
    setStarting(false);
    if ('failure' in started) return onOutcome({ kind: 'failed', failure: started.failure });
    flow.current = started.flowId;
    setCode(started);
    void navigator.clipboard.writeText(started.userCode).catch(() => undefined);
    void api.system.openExternal(started.verificationUri);
    const outcome = await api.issueTrackers.finishDeviceSignIn(started.flowId);
    flow.current = null;
    setCode(null);
    onOutcome(outcome);
  };
  const cancel = (): void => {
    if (flow.current) void api.issueTrackers.cancelDeviceSignIn(flow.current);
  };

  if (code) {
    const words = deviceCodeWords(code, trackerName);
    return (
      <div className={styles.step}>
        <p className={styles.cardLine}>{words.instruction}</p>
        <span className={styles.code} aria-label={`Code ${code.userCode}`}>
          {code.userCode}
        </span>
        <div className={styles.row}>
          <Spinner size={13} />
          <span className={styles.note}>{words.waiting}</span>
          <Button size="small" variant="ghost" onClick={() => void api.system.openExternal(code.verificationUri)}>
            Open the page again
          </Button>
          <Button size="small" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.row}>
      <Button size="small" variant="primary" loading={starting} onClick={() => void start()}>
        Sign in with {trackerName}
      </Button>
      <Button size="small" variant="ghost" onClick={onUseToken}>
        Use a token instead
      </Button>
    </div>
  );
}
