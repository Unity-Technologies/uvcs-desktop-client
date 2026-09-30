import { create } from 'zustand';
import type { UpdateStatus } from '@shared/domain/appUpdate';
import { api } from '../../api/client';
import { toast, useToastStore } from '../../ui/toast/toastStore';
import { checkFeedback } from './checkFeedback';

interface UpdateState {
  /** Where the app's update stands, as the main process last said (`updateStatusChanged`). */
  status: UpdateStatus;
  /** The ready version the user put off ("Later"): the update card stays hidden for it. */
  dismissedVersion: string | null;
  /** The About dialog shows the update itself, so a check asked from it needs no toast. */
  aboutOpen: boolean;
  /** What's New shows the update and its install button, so the update card steps aside meanwhile. */
  releaseNotesOpen: boolean;
  /** A check this window asked for, until it answers, and the toast that follows it. */
  askedCheck: { toastId: number | null } | null;
  /** A status arrived from main: the one read at start (`loadUpdateStatus`) is older then. */
  heardFromMain: boolean;
}

export const useUpdateStore = create<UpdateState>(() => ({
  status: { state: 'idle' },
  dismissedVersion: null,
  aboutOpen: false,
  releaseNotesOpen: false,
  askedCheck: null,
  heardFromMain: false,
}));

window.uvcs.on('updateStatusChanged', receiveUpdateStatus);

/** Reads where the update stands as the window opens; every change after that arrives as an event. */
export async function loadUpdateStatus(): Promise<void> {
  const status = await api.updates.status();
  if (!useUpdateStore.getState().heardFromMain) useUpdateStore.setState({ status });
}

/** Looks for an update now; this window hears how it goes in a toast, unless the About dialog shows it. */
export async function checkForUpdates(): Promise<void> {
  useUpdateStore.setState({ askedCheck: { toastId: null } });
  try {
    await api.updates.check();
  } catch (error) {
    useUpdateStore.setState({ askedCheck: null });
    toast.error("Couldn't check for updates", error);
  }
}

export async function installUpdate(): Promise<void> {
  try {
    await api.updates.install();
  } catch (error) {
    toast.error("Couldn't install the update", error);
  }
}

/** "Later": hides the update card for the version ready now. */
export function putOffUpdate(): void {
  const { status } = useUpdateStore.getState();
  if (status.state === 'ready') useUpdateStore.setState({ dismissedVersion: status.version });
}

export function setAboutOpen(aboutOpen: boolean): void {
  useUpdateStore.setState({ aboutOpen });
}

export function setReleaseNotesOpen(releaseNotesOpen: boolean): void {
  useUpdateStore.setState({ releaseNotesOpen });
}

function receiveUpdateStatus(status: UpdateStatus): void {
  useUpdateStore.setState({ status, heardFromMain: true });
  const { askedCheck, aboutOpen } = useUpdateStore.getState();
  if (!askedCheck) return;

  // One toast follows the check: "Checking…" turns into its answer, or goes once the update card takes over.
  const feedback = aboutOpen ? null : checkFeedback(status);
  const toasts = useToastStore.getState();
  let { toastId } = askedCheck;
  if (feedback && toastId === null) toastId = toasts.show(feedback);
  else if (feedback && toastId !== null) toasts.update(toastId, { ...feedback, detail: feedback.detail });
  else if (toastId !== null) toasts.dismiss(toastId);
  useUpdateStore.setState({ askedCheck: status.state === 'checking' ? { toastId } : null });
}
