/** All operational routes live under /app. The ocean presentation shell lives at "/". */
export const APP = '/app';
export const appPath = (p = '') => `${APP}${p}`;
