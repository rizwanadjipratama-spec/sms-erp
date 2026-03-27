import { motion } from 'framer-motion';
import { partners } from '@/lib/data';

const Partners = () => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Trusted Partners</h3>
          <p className="text-gray-600">Working with leading laboratory equipment manufacturers</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12 items-center justify-items-center">
          {partners.map((partner, index) => (
            <motion.div
              key={partner.name}
              initial={{ opacity: 0.5, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="relative h-20 w-32 bg-white rounded-2xl shadow-md p-4 flex items-center justify-center border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-300 overflow-hidden grayscale group-hover:grayscale-0"
            >
              {/* Partner logo - replace with actual */}
              <div className="text-sm font-semibold text-gray-500 group-hover:text-gray-900">
                {partner.name}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Partners;

