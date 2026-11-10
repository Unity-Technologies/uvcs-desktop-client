import { Copy, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LinkSignIn } from '@shared/api/issueTrackers';
import type { DeviceSignIn as DeviceCode, SignInOutcome } from '@shared/domain/issueTrackers';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { copyToClipboard } from '../../../ui/copyToClipboard';
import { IconButton } from '../../../ui/IconButton';
import { deviceCodeWords } from './connectFlow';
import styles from './IssueTrackerPane.module.css';
import deviceStyles from './DeviceSignIn.module.css';

interface DeviceSignInProps {
  /** A first sign-in by a link, for a repository or alone; or a connection's again. */
  request: LinkSignIn | { connectionId: string };
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
export function DeviceSignIn({ request, trackerName, onOutcome, onUseToken }: DeviceSignInProps) {
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [starting, setStarting] = useState(false);
  const flow = useRef<string | null>(null);
  const mounted = useRef(true);
  // A step left before the code is approved (Settings closed, another link pasted) stops the polling.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (flow.current) void api.issueTrackers.cancelDeviceSignIn(flow.current);
    };
  }, []);

  const start = async (): Promise<void> => {
    setStarting(true);
    const started = await api.issueTrackers.startDeviceSignIn(request);
    setStarting(false);
    if ('failure' in started) return onOutcome({ kind: 'failed', failure: started.failure });
    // Left while the code was asked for: the flow it started stops at once.
    if (!mounted.current) return void api.issueTrackers.cancelDeviceSignIn(started.flowId);
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
      <div className={styles.next}>
        <p className={styles.intro}>{words.instruction}</p>
        <div className={deviceStyles.preview}>
          <div className={deviceStyles.previewText}>
            <span className={deviceStyles.previewLabel}>Your code</span>
            <span className={deviceStyles.code} aria-label={`Code ${code.userCode}`}>
              {code.userCode}
            </span>
          </div>
          {/* Copied once already; this copies it again, after something else took the clipboard. */}
          <IconButton size="small" icon={<Copy size={14} />} label="Copy the code" onClick={() => copyToClipboard(code.userCode, 'Code')} />
        </div>
        <div className={deviceStyles.progress} role="progressbar" aria-label={words.waiting} />
        <div className={styles.row}>
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
      <Button size="small" variant="primary" icon={<ExternalLink size={13} />} loading={starting} onClick={() => void start()}>
        Sign in with {trackerName}
      </Button>
      <Button size="small" variant="ghost" onClick={onUseToken}>
        Use a token instead
      </Button>
    </div>
  );
}
