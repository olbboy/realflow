import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@realflow/react/styles.css';
import './process.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
