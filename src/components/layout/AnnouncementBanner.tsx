'use client';

import { useState, useEffect } from 'react';
import { cmsService } from '@/lib/services';
import type { CmsSettings } from '@/types/types';

export default function AnnouncementBanner() {
  const [settings, setSettings] = useState<CmsSettings | null>(null);

  useEffect(() => {
    cmsService.getSettings().then(setSettings).catch(console.error);
  }, []);

  if (!settings?.announcement_is_active || !settings.announcement_text) return null;

  return (
    <div className="w-full bg-[var(--apple-blue)] text-white text-sm py-2 px-4 shadow-sm z-50 relative">
      <div className="mx-auto max-w-7xl flex items-center justify-center text-center">
        <span>{settings.announcement_text}</span>
        {settings.announcement_link && (
          <a
            href={settings.announcement_link}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 font-semibold underline underline-offset-2 hover:text-white/80 transition-colors"
          >
            Learn More
          </a>
        )}
      </div>
    </div>
  );
}
