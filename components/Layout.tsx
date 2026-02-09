
import React from 'react';
import { SiteSettings } from '../types';

interface LayoutProps {
  settings: SiteSettings;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ settings, children }) => {
  return (
    <div style={{ '--point-color': settings.pointColor } as React.CSSProperties}>
      <div className="min-h-screen flex flex-col transition-colors duration-300">
        {children}
      </div>
    </div>
  );
};

export default Layout;
