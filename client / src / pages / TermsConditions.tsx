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

export default function TermsConditions() {
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
            <span className="text-white">Terms & Conditions</span>
          </div>

          {/* Page Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms & Conditions</h1>
            <p className="text-slate-400">Last updated: April 15, 2026</p>
          </div>

          {/* Content */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 md:p-12 space-y-8">
            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Agreement to Terms</h2>
              <p className="text-slate-300 leading-relaxed">
                By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Use License</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Permission is granted to temporarily download one copy of the materials (information or software) on Connect With Bayezid's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li>Modifying or copying the materials</li>
                <li>Using the materials for any commercial purpose or for any public display</li>
                <li>Attempting to decompile or reverse engineer any software contained on the website</li>
                <li>Removing any copyright or other proprietary notations from the materials</li>
                <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Disclaimer</h2>
              <p className="text-slate-300 leading-relaxed">
                The materials on Connect With Bayezid's website are provided on an 'as is' basis. Connect With Bayezid makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Limitations</h2>
              <p className="text-slate-300 leading-relaxed">
                In no event shall Connect With Bayezid or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Connect With Bayezid's website.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Accuracy of Materials</h2>
              <p className="text-slate-300 leading-relaxed">
                The materials appearing on Connect With Bayezid's website could include technical, typographical, or photographic errors. Connect With Bayezid does not warrant that any of the materials on its website are accurate, complete, or current. Connect With Bayezid may make changes to the materials contained on its website at any time without notice.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Links</h2>
              <p className="text-slate-300 leading-relaxed">
                Connect With Bayezid has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Connect With Bayezid of the site. Use of any such linked website is at the user's own risk.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Modifications</h2>
              <p className="text-slate-300 leading-relaxed">
                Connect With Bayezid may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Governing Law</h2>
              <p className="text-slate-300 leading-relaxed">
                These terms and conditions are governed by and construed in accordance with the laws of your jurisdiction, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Contact Information</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                If you have any questions about these Terms & Conditions, please contact us at:
              </p>
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
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
