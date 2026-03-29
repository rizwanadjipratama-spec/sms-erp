'use client';

import { useState, useEffect } from 'react';
import { cmsService } from '@/lib/services';
import type { CmsSection, CmsPartner, CmsSolution } from '@/types/types';

type CmsData = {
  sections: Map<string, CmsSection>;
  partners: CmsPartner[];
  solutions: CmsSolution[];
  loading: boolean;
};

export function useCmsSections() {
  const [sections, setSections] = useState<Map<string, CmsSection>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cmsService.getSections().then((data) => {
      const map = new Map<string, CmsSection>();
      data.forEach((s) => map.set(s.section_key, s));
      setSections(map);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return { sections, loading };
}

export function useCmsSection(key: string) {
  const [section, setSection] = useState<CmsSection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cmsService.getSection(key).then(setSection).catch(console.error).finally(() => setLoading(false));
  }, [key]);

  return { section, loading };
}

export function useCmsPartners() {
  const [partners, setPartners] = useState<CmsPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cmsService.getPartners().then(setPartners).catch(console.error).finally(() => setLoading(false));
  }, []);

  return { partners, loading };
}

export function useCmsSolutions() {
  const [solutions, setSolutions] = useState<CmsSolution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cmsService.getSolutions().then(setSolutions).catch(console.error).finally(() => setLoading(false));
  }, []);

  return { solutions, loading };
}
