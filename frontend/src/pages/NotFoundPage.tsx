/**
 * src/pages/NotFoundPage.tsx
 * 404 page styled with SubSentry light theme and direct return links.
 */
import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';

export default function NotFoundPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Page Not Found | SubSentry';
  }, []);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>

      <p className="text-6xl font-black text-indigo-600 font-mono tracking-tight">404</p>
      <h1 className="text-2xl font-bold text-slate-900 mt-2">Page Not Found</h1>
      <p className="text-sm text-slate-600 max-w-md mt-2">
        The requested resource or page could not be located. It might have been moved, deleted, or you might not have authorization to view it.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button
          variant="secondary"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>

        <Link to="/dashboard">
          <Button leftIcon={<Home className="h-4 w-4" />}>
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
