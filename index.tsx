import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker, autoEnsurePushSubscription } from './pwa';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// PWA
registerServiceWorker();
// 권한이 이미 허용된 경우, 앱 시작 시 자동으로 구독 재등록/DB 갱신
autoEnsurePushSubscription();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
