import { motion } from 'framer-motion';

const BusinessModel = () => {
  return (
    <section className="py-32 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-8 text-gray-900">
            Flexible Business Models
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-32 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-8 lg:p-12 border border-blue-100">
              <h3 className="text-3xl font-bold mb-4 text-gray-900">KSO System</h3>
              <p className="text-xl text-gray-600 mb-6 leading-relaxed">
                Equipment loan + reagent system. Get analyzers without large upfront capital.
              </p>
              <ul className="space-y-3 text-lg text-gray-700">
                <li>• Fixed monthly fee</li>
                <li>• Includes installation & training</li>
                <li>• Guaranteed service support</li>
              </ul>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-3xl p-8 lg:p-12 border border-green-100">
              <h3 className="text-3xl font-bold mb-4 text-gray-900">Cost Per Test</h3>
              <p className="text-xl text-gray-600 mb-6 leading-relaxed">
                Predictable pricing based on actual usage. Scale as your volume grows.
              </p>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-white rounded-2xl p-6 shadow-sm border">
                  <div className="text-3xl font-bold text-blue-600">Rp 5K</div>
                  <div className="text-sm text-gray-600 uppercase tracking-wide">CBC Test</div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border">
                  <div className="text-3xl font-bold text-green-600">Rp 15K</div>
                  <div className="text-sm text-gray-600 uppercase tracking-wide">Chemistry</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BusinessModel;

