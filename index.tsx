import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Validate critical environment variables
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const missingVars = requiredEnvVars.filter(
  (varName) => !import.meta.env[varName] && !import.meta.env[varName.replace('VITE_', 'NEXT_PUBLIC_')]
);

if (missingVars.length > 0) {
  const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}. Please check your .env file.`;
  
  if (import.meta.env.DEV) {
    console.error('❌', errorMessage);
    // In development, show error but don't block
  } else {
    // In production, throw error to prevent app from running
    throw new Error(errorMessage);
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);