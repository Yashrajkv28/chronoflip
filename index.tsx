import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './services/awsConfig'; // Must be first — configures Amplify
import './styles.css';

const App = React.lazy(() => import('./App'));
const ViewerScreen = React.lazy(() => import('./components/screens/ViewerScreen'));
const AuthGate = React.lazy(() => import('./components/AuthGate'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const path = window.location.pathname;
const viewMatch = path.match(/^\/view\/([A-HJ-NP-Za-km-z2-9]{4,16})$/);

const loadingSpinner = (
  <div className="h-[100dvh] flex items-center justify-center light-mesh-bg">
    <div className="text-center space-y-4">
      <div className="w-10 h-10 border-[3px] border-zinc-300 border-t-zinc-600 rounded-full animate-spin mx-auto" />
      <p className="text-zinc-400 text-sm">Loading...</p>
    </div>
  </div>
);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {viewMatch ? (
      <Suspense fallback={loadingSpinner}>
        <ViewerScreen shareId={viewMatch[1]} />
      </Suspense>
    ) : (
      <Suspense fallback={loadingSpinner}>
        <AuthGate>
          <App />
        </AuthGate>
      </Suspense>
    )}
  </React.StrictMode>
);
