import { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';

/**
 * ScanRedirect - Router view for processing scanned QR code tags.
 * Verifies if user session is active. If logged in, redirects to the asset details page directly.
 * If not, remembers the destination url path and takes the user to /login first.
 */
export default function ScanRedirect() {
  const { tag } = useParams<{ tag: string }>();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!tag) {
      navigate('/');
      return;
    }

    const isAuthenticated = localStorage.getItem('is_authenticated') === 'true' || !!localStorage.getItem('cmms_token');
    
    if (!isAuthenticated) {
      // Sin sesión -> login y volver al equipo después
      localStorage.setItem('cmms_scan_redirect', `/equipos/${tag}`);
      localStorage.setItem('pending_tag', tag);
      navigate('/login');
    } else {
      // Con sesión -> ir directo al equipo
      navigate(`/equipos/${tag}`);
    }
  }, [tag, navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-slate-950">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Cargando equipo...</p>
        <p className="text-xs text-slate-600 font-mono italic">TAG: {tag}</p>
      </div>
    </div>
  );
}
