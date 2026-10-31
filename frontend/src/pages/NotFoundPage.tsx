/**
 * src/pages/NotFoundPage.tsx
 */
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <p className="text-7xl font-extrabold text-primary-600 opacity-60">404</p>
      <h1 className="text-xl font-bold text-slate-200">Page not found</h1>
      <p className="text-sm text-slate-500 max-w-xs">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button variant="secondary" onClick={() => navigate(-1)}>
        Go back
      </Button>
    </div>
  );
}
