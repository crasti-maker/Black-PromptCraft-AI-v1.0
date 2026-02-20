
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Critical rendering error:", error);
  rootElement.innerHTML = `
    <div style="height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; text-align: center; color: white; background: #020617; font-family: sans-serif;">
      <div>
        <h1 style="color: #ef4444; margin-bottom: 10px;">Startup Error</h1>
        <p style="color: #94a3b8; font-size: 14px;">The application failed to initialize. Please try refreshing or clearing cache.</p>
        <code style="display: block; margin-top: 20px; padding: 10px; background: #0f172a; border-radius: 8px; font-size: 10px; color: #f43f5e;">${error instanceof Error ? error.message : "Unknown Error"}</code>
      </div>
    </div>
  `;
}
