// ============================================================================
// DATABASE LAYER — Single import point
// ============================================================================

export { supabase, requireAuthUser, getAuthUser } from './client';
export {
  profilesDb,
  productsDb,
  priceListDb,
  requestsDb,
  invoicesDb,
  paymentPromisesDb,
  deliveryLogsDb,
  inventoryLogsDb,
  issuesDb,
  monthlyClosingDb,
  notificationsDb,
  chatDb,
  cmsDb,
  activityLogsDb,
  systemLogsDb,
  storageDb,
  analyticsDb,
  technicianAreasDb,
  areaTransfersDb,
  serviceIssuesDb,
  serviceIssueLogsDb,
  equipmentAssetsDb,
  pmSchedulesDb,
  fakturTasksDb,
} from './queries';
