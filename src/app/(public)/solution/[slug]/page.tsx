import { notFound } from 'next/navigation';
import Image from 'next/image';
import { solutions } from '@/lib/data';
import Link from 'next/link';

interface SolutionPageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  return solutions.map((solution) => ({
    slug: solution.slug,
  }));
}

export default function SolutionPage({ params }: SolutionPageProps) {
  const solution = solutions.find((s) => s.slug === params.slug);

  if (!solution) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      {/* Hero Image */}
      <div className="relative h-screen w-full overflow-hidden bg-gray-100">
        <Image
          src={solution.image}
          alt={solution.title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 text-center text-white max-w-4xl mx-auto px-6">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4 drop-shadow-2xl">
            {solution.title}
          </h1>
          <p className="text-xl md:text-2xl drop-shadow-lg max-w-2xl mx-auto">
            {solution.category}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 -mt-20">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/50">
          <div className="p-12 lg:p-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
              {/* Description & CTA */}
              <div>
                <p className="text-2xl text-gray-600 mb-8 leading-relaxed">
                  {solution.description}
                </p>
                
                <div className="mb-12">
                  <h3 className="text-2xl font-bold mb-6 text-gray-900">Key Specifications</h3>
                  <ul className="space-y-3 text-lg">
                    {solution.specs.map((spec, index) => (
                      <li key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-2xl">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-3 flex-shrink-0" />
                        <span>{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-xl font-semibold mb-2 text-gray-900">Ideal Use Case</h4>
                    <p className="text-lg text-gray-600">{solution.useCase}</p>
                  </div>
                  
                  <Link
                    href="#contact"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl text-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 w-full text-center"
                  >
                    Ask for Price & Details →
                  </Link>
                </div>
              </div>

              {/* Visual */}
              <div className="lg:sticky lg:top-24 lg:h-[500px] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 lg:p-12 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 bg-blue-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <p className="text-4xl font-bold text-gray-900 mb-2">Reliable</p>
                  <p className="text-xl text-gray-600">Built for 24/7 operation</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

