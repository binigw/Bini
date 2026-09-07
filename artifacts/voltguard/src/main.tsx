import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { getApiBaseUrl } from './lib/api-url';

import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('VoltGuard root element was not found.');
}

try {
  setBaseUrl(getApiBaseUrl() || null);
} catch (error) {
  console.error(
    'VoltGuard API client initialization failed; using same-origin requests.',
    error,
  );
}

createRoot(rootElement).render(<App />);
