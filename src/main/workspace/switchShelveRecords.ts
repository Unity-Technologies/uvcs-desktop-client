import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { SettingsStore } from '../settings/SettingsStore';

type RecordKey = Pick<SwitchShelveRecord, 'shelveId' | 'repository'>;

const sameShelve = (a: RecordKey, b: RecordKey): boolean => a.shelveId === b.shelveId && a.repository === b.repository;

/** The automatic shelves this app created while switching, kept in the app settings. */
export class SwitchShelveRecords {
  constructor(private readonly settings: SettingsStore) {}

  forWorkspace(workspaceGuid: string): SwitchShelveRecord[] {
    return this.all().filter((record) => record.workspaceGuid === workspaceGuid);
  }

  find(key: RecordKey): SwitchShelveRecord | undefined {
    return this.all().find((record) => sameShelve(record, key));
  }

  save(record: SwitchShelveRecord): void {
    this.settings.update({ switchShelves: [...this.all().filter((existing) => !sameShelve(existing, record)), record] });
  }

  remove(keys: RecordKey[]): void {
    this.settings.update({ switchShelves: this.all().filter((record) => !keys.some((key) => sameShelve(record, key))) });
  }

  private all(): SwitchShelveRecord[] {
    return this.settings.get().switchShelves;
  }
}
