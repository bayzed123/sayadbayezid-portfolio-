import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

/**
 * Design Philosophy: Professional Legal Document
 * - Clean, readable layout with clear hierarchy
 * - Consistent with site design using gradient accents
 * - Easy navigation with breadcrumbs
 * - Accessible typography for long-form content
 */

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col">
      <Header />

      <main className="flex-1 w-full px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-8 text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Privacy Policy</span>
          </div>

          {/* Page Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
            <p className="text-slate-400">Last updated: April 15, 2026</p>
          </div>

          {/* Content */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 md:p-12 space-y-8">
            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
              <p className="text-slate-300 leading-relaxed">
                Connect With Bayezid ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, including any other media form, media channel, mobile website, or mobile application related or connected thereto (collectively, the "Site").
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-indigo-300 mb-2">Personal Data</h3>
                  <p className="text-slate-300 leading-relaxed">
                    We may collect personal information that you voluntarily provide to us when you register on the Site, express an interest in obtaining information about us or our products and services, or when you otherwise contact us. This may include:
                  </p>
                  <ul className="list-disc list-inside text-slate-300 mt-2 space-y-1">
                    <li>Name and email address</li>
                    <li>Phone number</li>
                    <li>Mailing address</li>
                    <li>Payment information</li>
                    <li>Any other information you choose to provide</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-indigo-300 mb-2">Automatically Collected Information</h3>
                  <p className="text-slate-300 leading-relaxed">
                    When you access the Site, we automatically collect certain information about your device, including information about your web browser, IP address, time zone, and some of the cookies that are installed on your device. Additionally, as you browse the Site, we collect information about the individual web pages or products that you view, what websites or search terms referred you to the Site, and information about how you interact with the Site.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Use of Your Information</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Site to:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li>Generate a personal profile about you so that future visits to the Site will be personalized</li>
                <li>Increase the efficiency and operation of the Site</li>
                <li>Monitor and analyze usage and trends to improve your experience with the Site</li>
                <li>Notify you of updates to the Site</li>
                <li>Offer new products, services, and/or recommendations to you</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Disclosure of Your Information</h2>
              <p className="text-slate-300 leading-relaxed">
                We may share your information in the following situations:
              </p>
              <ul className="list-disc list-inside text-slate-300 mt-4 space-y-2">
                <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information is necessary to comply with the law</li>
                <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us</li>
                <li><strong>Business Transfers:</strong> Your information may be transferred as part of a merger, sale, or acquisition</li>
                <li><strong>With Your Consent:</strong> We may disclose your information with your explicit consent</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Security of Your Information</h2>
              <p className="text-slate-300 leading-relaxed">
                We use administrative, technical, and physical security measures to protect your personal information. However, perfect security does not exist on the Internet. We cannot guarantee absolute security of your personal information.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Contact Us</h2>
              <p className="text-slate-300 leading-relaxed">
                If you have questions or comments about this Privacy Policy, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-lg">
                <p className="text-slate-300">
                  <strong className="text-white">Connect With Bayezid</strong><br />
                  Email: <a href="mailto:cwb.agency@outlook.com" className="text-indigo-400 hover:text-indigo-300">cwb.agency@outlook.com</a><br />
                  LinkedIn: <a href="https://www.linkedin.com/in/sayadbayezid" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">Sayad Md Bayezid Hosan</a>
                </p>
              </div>
            </section>
          </div>

          {/* Back to Home */}
          <div className="mt-12 text-center">
            <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-indigo-500/50 transition-all hover:scale-105">
              Back to Home
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
