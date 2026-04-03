/**
 * Categories that require DLM (Direct Line Manager) approval before reaching the IT support team.
 * Based on enterprise ERP Dynamic 360 org-chart hierarchy.
 */
export const DLM_REQUIRED_CATEGORIES = new Set([
  "DEVICES",          // Hardware
  "SOFTWARE",         // Software
  "DIGITAL_REQUEST",  // Software / digital services
  "ACCESS",           // Access management
  "NG_DEPLOYMENTS",   // Deployments / Infrastructure
  "SAP",              // SAP & ERP systems
  "SERVICE_DESK",     // IT Service Desk requests
]);

export function requiresDlmApproval(category?: string | null): boolean {
  if (!category) return false;
  return DLM_REQUIRED_CATEGORIES.has(category.toUpperCase());
}
