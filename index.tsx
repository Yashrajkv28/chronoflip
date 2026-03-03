import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const ViewerScreen = React.lazy(() => import('./components/screens/ViewerScreen'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const path = window.location.pathname;
const viewMatch = path.match(/^\/view\/([A-Za-z0-9]{4,16})$/);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {viewMatch ? (
      <Suspense fallback={
        <div className="h-[100dvh] flex items-center justify-center bg-zinc-950">
          <div className="text-center space-y-4">
            <div className="w-10 h-10 border-[3px] border-white/20 border-t-white/80 rounded-full animate-spin mx-auto" />
            <p className="text-zinc-400 text-sm">Loading timer...</p>
          </div>
        </div>
      }>
        <ViewerScreen shareId={viewMatch[1]} />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
