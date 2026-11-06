import { mergeBackup } from '../../../public/backup-domain.js';
import { setPreference, setProjectSharing, setSharingPreference, updateProfile } from '../../../public/settings-domain.js';

export function createSettingsActions(act) {
  const change = (rule, ...args) => act((state) => ({ state: rule(state, ...args) }));
  return {
    setPreference: (key, value) => change(setPreference, key, value),
    setSharingPreference: (key, value) => change(setSharingPreference, key, value),
    setProjectSharing: (id, shared) => change(setProjectSharing, id, shared),
    updateProfile: (patch) => change(updateProfile, patch),
    restoreBackup: (incoming) => change(mergeBackup, incoming),
  };
}
