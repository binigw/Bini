export const ROUTES = {
  dashboard: "/",
  machines: "/machines",
  alerts: "/alerts",
  analytics: "/analytics",
  analysis: "/analysis",
  faultLogs: "/fault-logs",
  reports: "/reports",
  personnel: "/personnel",
  settings: "/settings",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export function normalizeRoutePath(path: string): string {
  if (path === "/") return path;
  return path.replace(/\/+$/, "") || "/";
}