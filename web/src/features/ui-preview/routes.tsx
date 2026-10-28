import type { RouteObject } from 'react-router';
import UiPreviewPage from './UiPreviewPage.tsx';

// Public and outside the nav, so teammates can open it in any build.
export const uiPreviewRoutes: RouteObject[] = [
  { path: 'ui-preview', element: <UiPreviewPage /> },
];
