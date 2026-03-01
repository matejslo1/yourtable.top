import React from 'react';
import ReactDOM from 'react-dom/client';
import { BookingWidget } from './components/BookingWidget';
import './styles.css';

// Auto-mount widget from script tag attributes
// Usage: <script src="https://app.yourtable.top/widget.js" data-tenant="demo-restavracija" data-theme="light"></script>
function init() {
  const scripts = document.querySelectorAll('script[data-tenant]');

  scripts.forEach((script) => {
    const tenant = script.getAttribute('data-tenant');
    const theme = (script.getAttribute('data-theme') || 'light') as 'light' | 'dark';
    const containerId = script.getAttribute('data-container');

    if (!tenant) return;

    // Find or create container
    let container: HTMLElement | null = null;

    if (containerId) {
      container = document.getElementById(containerId);
    }

    if (!container) {
      container = document.createElement('div');
      container.id = `yourtable-widget-${tenant}`;
      script.parentNode?.insertBefore(container, script.nextSibling);
    }

    // Mount React app
    const root = ReactDOM.createRoot(container);
    root.render(
      React.createElement(BookingWidget, { tenantSlug: tenant, theme })
    );
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Also expose for manual mounting
(window as any).YourTableWidget = {
  mount(element: HTMLElement, config: { tenantSlug: string; theme?: 'light' | 'dark' }) {
    const root = ReactDOM.createRoot(element);
    root.render(
      React.createElement(BookingWidget, config)
    );
    return { unmount: () => root.unmount() };
  },
};
