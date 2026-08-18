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

const makeSpinner = (bgClass: string, ringClass: string, textClass: string) => (
  <div className={`h-[100dvh] flex items-center justify-center ${bgClass}`}>
    <div className="text-center space-y-4">
      <div className={`w-10 h-10 border-[3px] ${ringClass} rounded-full animate-spin mx-auto`} />
      <p className={`${textClass} text-sm`}>Loading...</p>
    </div>
  </div>
);

// App shell boots onto the EventHQ background so there is no tone shift into AuthGate.
const appSpinner = makeSpinner('bg-bg-primary', 'border-border-soft border-t-accent-slate', 'text-text-muted');
// Viewer is out of scope for the reskin — keep its boot state exactly as it ships today.
const viewerSpinner = makeSpinner('light-mesh-bg', 'border-zinc-300 border-t-zinc-600', 'text-zinc-400');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {viewMatch ? (
      <Suspense fallback={viewerSpinner}>
        <ViewerScreen shareId={viewMatch[1]} />
      </Suspense>
    ) : (
      <Suspense fallback={appSpinner}>
        <AuthGate>
          <App />
        </AuthGate>
      </Suspense>
    )}
  </React.StrictMode>
);
