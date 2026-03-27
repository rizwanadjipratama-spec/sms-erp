import { Solution, Product, Partner, Location } from '@/types/types';
import { supabase } from './supabase';

/* ================= SOLUTIONS ================= */

export const solutions: Solution[] = [
  {
    slug: 'hematology-analyzer',
    title: 'Hematology Analyzer',
    description: 'High-precision cell counting for complete blood counts.',
    category: 'Equipment',
    image: '/products/hema.png',
    specs: ['5-part differential', '20 parameters', '60 samples/hour'],
    useCase: 'Hospitals and labs',
  },
  {
    slug: 'chemistry-analyzer',
    title: 'Chemistry Analyzer',
    description: 'Automated biochemical analysis system.',
    category: 'Equipment',
    image: '/products/chem.png',
    specs: ['200 tests/hour', '42 samples', 'QC integrated'],
    useCase: 'Clinical chemistry labs',
  },
  {
    slug: 'poct',
    title: 'POCT Devices',
    description: 'Rapid point-of-care diagnostics.',
    category: 'Equipment',
    image: '/products/poct.png',
    specs: ['HbA1c', 'CRP', 'Lipids'],
    useCase: 'Clinics & emergency',
  },
  {
    slug: 'reagents',
    title: 'Reagents',
    description: 'Consumables for lab systems.',
    category: 'Reagents',
    image: '/products/reagents.png',
    specs: ['Controls', 'Calibrators'],
    useCase: 'Daily lab operation',
  },
  {
    slug: 'support',
    title: 'Support Services',
    description: '24/7 technical & maintenance.',
    category: 'Service',
    image: '/products/service.png',
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
    image: '/products/hema.png',
    stock: 5,
    status: 'in_stock',
  },
  {
    id: 'chem-1',
    name: 'Chemistry Analyzer',
    category: 'Equipment',
    image: '/products/chem.png',
    stock: 3,
    status: 'in_stock',
  },
  {
    id: 'poct-1',
    name: 'POCT Device',
    category: 'Equipment',
    image: '/products/poct.png',
    stock: 2,
    status: 'in_stock',
  },
  {
    id: 'reag-1',
    name: 'Lab Reagents Kit',
    category: 'Reagents',
    image: '/products/reagents.png',
    stock: 10,
    status: 'in_stock',
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
  { name: 'Mindray', logo: '/images/mindray.png' },
  { name: 'Roche', logo: '/images/roche.png' },
  { name: 'Sysmex', logo: '/images/sysmex.png' },
];

/* ================= API ================= */

export const getProducts = async (): Promise<Product[]> => {
	const { data, error } = await supabase
		.from('products')
		.select('*')
		.eq('status', 'in_stock')
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

export const getSolutions = async (): Promise<Solution[]> => {
  const { data, error } = await supabase.from('solutions').select('*');
  if (error) {
    console.error('Error fetching solutions:', error);
    return [];
  }
  return data as Solution[];
};

export const getPartners = async (): Promise<Partner[]> => {
  const { data, error } = await supabase.from('partners').select('*');
  if (error) {
    console.error('Error fetching partners:', error);
    return [];
  }
  return data as Partner[];
};

export const getLocations = async (): Promise<Location[]> => {
  const { data, error } = await supabase.from('locations').select('name');
  if (error) {
    console.error('Error fetching locations:', error);
    return [];
  }
  return data.map(item => item.name) as Location[];
};