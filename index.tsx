import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ViewerScreen from './components/screens/ViewerScreen';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const path = window.location.pathname;
const viewMatch = path.match(/^\/view\/([A-Za-z0-9]{4,16})$/);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {viewMatch ? <ViewerScreen shareId={viewMatch[1]} /> : <App />}
  </React.StrictMode>
);
