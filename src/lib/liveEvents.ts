export const RECORDS_CHANGED_EVENT = 'kbs-records-changed';

/** Tell open dashboards to silently refetch rental/JCB rows. */
export function emitRecordsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(RECORDS_CHANGED_EVENT));
}
