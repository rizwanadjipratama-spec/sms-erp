import { motion } from 'framer-motion';

const About = () => {
  return (
    <section id="about" className="py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-32 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
              Real Experience.
              <br />
              Real Reliability.
            </h2>
            <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
              We understand laboratory workflows — not just from theory, but from real operational experience.
              <br />
              <br />
              Our team brings hands-on knowledge of equipment installation, daily operations, maintenance challenges, and troubleshooting under pressure.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-8 lg:p-12 shadow-2xl border border-gray-100">
              <ul className="space-y-4 text-lg">
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Equipment selection based on actual throughput needs</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                  <span>Installation optimized for your lab layout</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                  <span>24/7 support from technicians who understand your workflow</span>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;

