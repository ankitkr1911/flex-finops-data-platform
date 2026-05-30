import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { PartnerRuntimeApp } from 'partner-ui';
import 'partner-ui/styles.css';

const isExtension = Boolean((globalThis as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime?.id);
const Router = isExtension ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <PartnerRuntimeApp
        appId="rpt"
        appName="dhub-rpt"
        theme="violet"
        tagline="Planning & capacity"
        marketplaceUrl="http://localhost:5176/"
      />
    </Router>
  </React.StrictMode>
);
