export const APP_NAME = "TechniLium";

/** "Commandes - TechniLium Backoffice", or just the app name when no page is named (sign-in). */
export function pageTitle(page: string | null): string {
  return page ? `${page} - ${APP_NAME} Backoffice` : `${APP_NAME} Backoffice`;
}
