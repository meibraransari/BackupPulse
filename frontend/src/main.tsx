import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TimezoneProvider } from './context/TimezoneContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TimezoneProvider>
        <App />
      </TimezoneProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
