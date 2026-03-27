'use client';

import { Product } from '@/types/types';

interface ProductListProps {
  products: Product[];
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  onAddToCart?: (product: Product) => void;
  isAdmin?: boolean;
}

export function ProductList({ products, onEdit, onDelete, onAddToCart, isAdmin }: ProductListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <div key={product.id} className="group bg-white rounded-2xl border border-apple-gray-border shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden flex flex-col">
          <div className="aspect-square bg-apple-gray-bg relative overflow-hidden">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-apple-gray-border">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/20 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500">
               {isAdmin ? (
                 <div className="flex gap-2">
                   <button onClick={() => onEdit?.(product)} className="flex-1 bg-white/90 backdrop-blur-md hover:bg-white text-apple-text-primary text-[10px] font-bold py-2 rounded-apple transition-all active:scale-95 shadow-lg">EDIT</button>
                   <button onClick={() => onDelete?.(product.id)} className="flex-1 bg-apple-danger/90 backdrop-blur-md hover:bg-apple-danger text-white text-[10px] font-bold py-2 rounded-apple transition-all active:scale-95 shadow-lg">DELETE</button>
                 </div>
               ) : (
                 <button onClick={() => onAddToCart?.(product)} className="w-full bg-apple-blue/90 backdrop-blur-md hover:bg-apple-blue text-white text-[10px] font-bold py-2 rounded-apple transition-all active:scale-95 shadow-lg">ADD TO REQUEST</button>
               )}
            </div>
          </div>
          
          <div className="p-5 flex-1 flex flex-col">
            <div className="flex justify-between items-start gap-3 mb-2">
              <h3 className="font-bold text-apple-text-primary text-sm leading-tight line-clamp-2">{product.name}</h3>
              <p className="text-sm font-black text-apple-blue whitespace-nowrap">Rp{product.price.toLocaleString('id-ID')}</p>
            </div>
            {product.description && (
              <p className="text-xs text-apple-text-secondary line-clamp-2 mb-4 leading-relaxed font-medium">
                {product.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
