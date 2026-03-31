import { CmsSolution, Product, CmsPartner } from '@/types/types';
import { supabase } from './supabase';

interface Location {
  name: string;
}

/* ================= SOLUTIONS ================= */

interface StaticSolution {
  slug: string;
  title: string;
  description: string;
  category: string;
  image: string;
  specs: string[];
  useCase: string;
}

export const solutions: StaticSolution[] = [
  {
    slug: 'hematology-analyzer',
    title: 'Hematology Analyzer',
    description: 'High-precision cell counting for complete blood counts.',
    category: 'Equipment',
    image: '',
    specs: ['5-part differential', '20 parameters', '60 samples/hour'],
    useCase: 'Hospitals and labs',
  },
  {
    slug: 'chemistry-analyzer',
    title: 'Chemistry Analyzer',
    description: 'Automated biochemical analysis system.',
    category: 'Equipment',
    image: '',
    specs: ['200 tests/hour', '42 samples', 'QC integrated'],
    useCase: 'Clinical chemistry labs',
  },
  {
    slug: 'poct',
    title: 'POCT Devices',
    description: 'Rapid point-of-care diagnostics.',
    category: 'Equipment',
    image: '',
    specs: ['HbA1c', 'CRP', 'Lipids'],
    useCase: 'Clinics & emergency',
  },
  {
    slug: 'reagents',
    title: 'Reagents',
    description: 'Consumables for lab systems.',
    category: 'Reagents',
    image: '',
    specs: ['Controls', 'Calibrators'],
    useCase: 'Daily lab operation',
  },
  {
    slug: 'support',
    title: 'Support Services',
    description: '24/7 technical & maintenance.',
    category: 'Service',
    image: '',
    specs: ['On-site', 'Hotline', 'PM'],
    useCase: 'Equipment uptime',
  },
];

/* ================= PRODUCTS ================= */

export const products: Product[] = [
  {
    id: 'hema-1',
    name: 'Hematology Analyzer',
    category: 'Equipment',
    image_url: '',
    stock: 5,
    min_stock: 1,
    unit: 'unit',
    is_active: true,
    is_priced: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'chem-1',
    name: 'Chemistry Analyzer',
    category: 'Equipment',
    image_url: '',
    stock: 3,
    min_stock: 1,
    unit: 'unit',
    is_active: true,
    is_priced: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'poct-1',
    name: 'POCT Device',
    category: 'Equipment',
    image_url: '',
    stock: 2,
    min_stock: 1,
    unit: 'unit',
    is_active: true,
    is_priced: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'reag-1',
    name: 'Lab Reagents Kit',
    category: 'Reagents',
    image_url: '',
    stock: 10,
    min_stock: 2,
    unit: 'kit',
    is_active: true,
    is_priced: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/* ================= LOCATIONS ================= */

export const locations = [
  'Bogor',
  'Cirebon',
  'Purwokerto',
];

/* ================= PARTNERS ================= */

export const partners = [
  { name: 'Mindray', logo: '' },
  { name: 'Roche', logo: '' },
  { name: 'Sysmex', logo: '' },
];

/* ================= API ================= */

export const getProducts = async (): Promise<Product[]> => {
	const { data, error } = await supabase
		.from('products')
		.select('*')
		.eq('is_active', true)
		.order('category')
		.order('name');
		
	if (error) throw new Error(`Failed to fetch products: ${error.message}`);
	if (!data) throw new Error('No product data received');
	
	return data as Product[];
};

export const getProductsByIds = async (ids: string[]): Promise<Map<string, string>> => {
	if (ids.length === 0) return new Map();
	
	const { data, error } = await supabase
		.from('products')
		.select('id, name')
		.in('id', ids);
		
	if (error) throw new Error(`Failed to fetch products by IDs: ${error.message}`);
	
	const nameMap = new Map<string, string>();
	(data || []).forEach((p: { id: string, name: string }) => {
		nameMap.set(p.id, p.name);
	});
	
	return nameMap;
};

export const getSolutions = async (): Promise<CmsSolution[]> => {
  const { data, error } = await supabase.from('cms_solutions').select('*').eq('is_active', true).order('sort_order');
  if (error) {
    console.error('Error fetching solutions:', error);
    return [];
  }
  return data as CmsSolution[];
};

export const getPartners = async (): Promise<CmsPartner[]> => {
  const { data, error } = await supabase.from('cms_partners').select('*').eq('is_active', true).order('sort_order');
  if (error) {
    console.error('Error fetching partners:', error);
    return [];
  }
  return data as CmsPartner[];
};

export const getLocations = async (): Promise<string[]> => {
  const { data, error } = await supabase.from('locations').select('name');
  if (error) {
    console.error('Error fetching locations:', error);
    return [];
  }
  return data.map((item: Location) => item.name);
};