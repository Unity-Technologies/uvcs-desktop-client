import { useQuery } from '@tanstack/react-query';
import { BookOpen, Bug, Copy, Lightbulb, RefreshCw, Scale } from 'lucide-react';
import { useEffect } from 'react';
import { api } from '../../api/client';
import { AppMark } from '../../components/AppMark';
import { APP_NAME, APP_PITCH } from '../../lib/appIdentity';
import { Button } from '../../ui/Button';
import { CardDialog } from '../../ui/dialog/CardDialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Spinner } from '../../ui/Spinner';
import { copyToClipboard } from '../../ui/copyToClipboard';
import { cmVersionQuery } from '../startup/useCmAvailability';
import { openReleaseNotesDialog } from '../updates/ReleaseNotesDialog';
import { foundUpdateVersion, useUpdateReleaseNotes } from '../updates/updateReleaseNotes';
import { checkForUpdates, installUpdate, setAboutOpen, useUpdateStore } from '../updates/updateStore';
import { aboutDetails } from './aboutDetails';
import { aboutBugReportUrl, featureRequestUrl } from './aboutIssueUrls';
import { aboutUpdateAction, aboutUpdateLine, describePlatform } from './aboutUpdate';
import { appInfoQuery } from './appInfoQuery';
import styles from './AboutDialog.module.css';

export function openAboutDialog(): void {
  openDialog((close) => <AboutDialog onClose={close} />);
}

/** The app's name and version, its update, and what it runs on: the `cm` found (already asked at start) and Electron. */
function AboutDialog({ onClose }: { onClose: () => void }) {
  const { data: info } = useQuery(appInfoQuery);
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
      <p className={styles.pitch}>{APP_PITCH}</p>

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
          <Button
            variant="ghost"
            size="small"
            icon={<Bug size={14} />}
            title="A bug report on GitHub, with these details filled in"
            onClick={() => void api.system.openExternal(aboutBugReportUrl(info, cmVersion))}
          >
            Report an Issue
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Lightbulb size={14} />}
            title="A feature request on GitHub"
            onClick={() => void api.system.openExternal(featureRequestUrl(info))}
          >
            Request a Feature
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Scale size={14} />}
            title="The open-source libraries the app includes, with their licenses"
            onClick={() => void api.updates.openThirdPartyNotices()}
          >
            Licenses
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
  const version = foundUpdateVersion(status);
  const hasNotes = useUpdateReleaseNotes().length > 0;

  return (
    <div className={styles.update}>
      <span className={styles.updateLine} data-tone={line.tone} role="status">
        {line.busy && <Spinner size={12} />}
        {line.text}
      </span>
      <div className={styles.updateActions}>
        {version && hasNotes && (
          <Button variant="ghost" size="small" onClick={() => openReleaseNotesDialog(version)}>
            What's New
          </Button>
        )}
        {action.kind === 'install' ? (
          <Button variant="primary" size="small" disabled={!action.enabled} onClick={() => void installUpdate()}>
            {action.label}
          </Button>
        ) : (
          <Button size="small" icon={<RefreshCw size={14} />} disabled={!action.enabled} onClick={() => void checkForUpdates()}>
            Check for Updates
          </Button>
        )}
      </div>
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
