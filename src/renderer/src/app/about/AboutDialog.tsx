import { useQuery } from '@tanstack/react-query';
import { BookOpen, Bug, Copy, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { AppMark } from '../../components/AppMark';
import { APP_NAME, APP_TAGLINE } from '../../lib/appIdentity';
import { Button } from '../../ui/Button';
import { CardDialog } from '../../ui/dialog/CardDialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Spinner } from '../../ui/Spinner';
import { copyToClipboard } from '../../ui/copyToClipboard';
import { cmVersionQuery } from '../startup/useCmAvailability';
import { checkForUpdates, installUpdate, setAboutOpen, useUpdateStore } from '../updates/updateStore';
import { aboutDetails } from './aboutDetails';
import { aboutUpdateAction, aboutUpdateLine, describePlatform } from './aboutUpdate';
import styles from './AboutDialog.module.css';

export function openAboutDialog(): void {
  openDialog((close) => <AboutDialog onClose={close} />);
}

/** The app's name and version, its update, and what it runs on: the `cm` found (already asked at start) and Electron. */
function AboutDialog({ onClose }: { onClose: () => void }) {
  const { data: info } = useQuery({ queryKey: queryKeys.appInfo, queryFn: () => api.updates.appInfo(), staleTime: Infinity });
  const { data: cmVersion } = useQuery(cmVersionQuery);

  useEffect(() => {
    setAboutOpen(true);
    return () => setAboutOpen(false);
  }, []);

  return (
    <CardDialog label={`About ${APP_NAME}`} width={420} onClose={onClose}>
      <AppMark size={72} />
      <h2 className={styles.name}>{APP_NAME}</h2>
      <div className={styles.version}>{info ? `Version ${info.version}` : ' '}</div>
      <p className={styles.tagline}>{APP_TAGLINE}</p>

      <UpdateBox />

      {info && (
        <dl className={styles.meta}>
          <Property term="cm" value={cmVersion ?? '…'} />
          <Property term="Platform" value={describePlatform(info.platform, info.arch)} />
          <Property term="Electron" value={info.electron} />
          <Property term="Chromium" value={info.chromium} />
        </dl>
      )}

      {info && (
        <div className={styles.links}>
          <Button variant="ghost" size="small" icon={<Copy size={14} />} onClick={() => copyToClipboard(aboutDetails(info, cmVersion), 'Details')}>
            Copy Details
          </Button>
          <Button variant="ghost" size="small" icon={<BookOpen size={14} />} onClick={() => void api.system.openExternal(info.documentationUrl)}>
            Documentation
          </Button>
          <Button variant="ghost" size="small" icon={<Bug size={14} />} onClick={() => void api.system.openExternal(info.issuesUrl)}>
            Report an Issue
          </Button>
        </div>
      )}
    </CardDialog>
  );
}

function UpdateBox() {
  const status = useUpdateStore((state) => state.status);
  const line = aboutUpdateLine(status);
  const action = aboutUpdateAction(status);

  return (
    <div className={styles.update}>
      <span className={styles.updateLine} data-tone={line.tone} role="status">
        {line.busy && <Spinner size={12} />}
        {line.text}
      </span>
      {action.kind === 'install' ? (
        <Button variant="primary" size="small" onClick={() => void installUpdate()}>
          {action.label}
        </Button>
      ) : (
        <Button size="small" icon={<RefreshCw size={14} />} disabled={!action.enabled} onClick={() => void checkForUpdates()}>
          Check for Updates
        </Button>
      )}
    </div>
  );
}

function Property({ term, value }: { term: string; value: string }) {
  return (
    <div className={styles.property}>
      <dt>{term}</dt>
      <dd className="selectable">{value}</dd>
    </div>
  );
}
