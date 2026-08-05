import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/auth';
import { LanguageProvider } from './lib/LanguageContext';
import { SiteProvider } from './lib/SiteContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
      <AuthProvider>
        <SiteProvider>
          <App />
        </SiteProvider>
      </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
