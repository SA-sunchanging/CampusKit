import { RouterProvider } from 'react-router/dom';
import { AuthProvider } from '../auth/AuthContext.tsx';
import { router } from './router.tsx';

// App shell (role A): auth state around the router.
export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
