// ============================================================================
// SERVICE LAYER — Single import point for all services
// ============================================================================

export { authService } from './auth-service';
export { workflowEngine, WORKFLOW_STATUSES, ACTIVE_STATUSES, TERMINAL_STATUSES, STATUS_LABELS, STATUS_COLORS } from './workflow-engine';
export type { TransitionInput } from './workflow-engine';
export { productService } from './product-service';
export { inventoryService } from './inventory-service';
export { financeService } from './finance-service';
export { deliveryService } from './delivery-service';
export { notificationService } from './notification-service';
export { chatService } from './chat-service';
export { cmsService } from './cms-service';
export { analyticsService } from './analytics-service';
