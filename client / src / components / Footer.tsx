import { Link } from "wouter";
import { Mail, MapPin, Facebook, Linkedin, Instagram, MessageCircle, Phone, Send, CheckCircle } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterName, setNewsletterName] = useState("");
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);

  const subscribeNewsletter = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => {
      setNewsletterEmail("");
      setNewsletterName("");
      setNewsletterSuccess(true);
      setTimeout(() => setNewsletterSuccess(false), 4000);
    },
  });

  const facebookServicePage = "https://www.facebook.com/share/1GYmMYYNXz/?mibextid=wwXIfr";
  const genzFrontierLink = "https://www.genzfrontir.com";

  const socialLinks = [
    { icon: Facebook, href: "https://www.facebook.com/share/18GdrYu3LG/?mibextid=wwXIfr", label: "Facebook" },
    { icon: Instagram, href: "https://www.instagram.com/freelancer_bayezid0?igsh=MTdrOWI5NTc2Zjhsag%3D%3D&utm_source=qr", label: "Instagram" },
    { icon: Linkedin, href: "https://www.linkedin.com/in/sayadbayezid?utm_source=share_via&utm_content=profile&utm_medium=member_ios", label: "LinkedIn" },
    { icon: MessageCircle, href: "https://wa.me/message/TDYG575YENF6F1", label: "WhatsApp" },
  ];

  return (
    <footer className="w-full bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-lg font-bold text-white">CWB</span>
              </div>
              <span className="font-bold text-white">Connect With Bayezid</span>
            </div>
            <p className="text-slate-400 text-sm">Your Digital Growth Partner</p>
            <div className="flex gap-3 mt-2">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-indigo-500/20 flex items-center justify-center text-slate-300 hover:text-white transition-all"
                    title={social.label}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-slate-400 hover:text-white transition-colors text-sm">
                  About
                </Link>
              </li>
              <li>
                <Link href="/portfolio" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Portfolio
                </Link>
              </li>
              <li>
                <Link href="/certificates" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Certificates
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/news" className="text-slate-400 hover:text-white transition-colors text-sm">
                  News
                </Link>
              </li>
              <li>
                <Link href="/write-blog" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Write Blog
                </Link>
              </li>
              <li>
                <Link href="/latest-news" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Latest News
                </Link>
              </li>
              <li>
                <Link href="/customer-agreement" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Customer Agreement
                </Link>
              </li>
              <li>
                <a href={facebookServicePage} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Facebook Service Page
                </a>
              </li>
              <li>
                <a href={genzFrontierLink} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors text-sm">
                  GenZ Frontier News
                </a>
              </li>

            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="font-bold text-white mb-4">Policies</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy-policy" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-conditions" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/google-ads-policy" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Google Ads Policy
                </Link>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white transition-colors text-sm">
                  Cookie Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-bold text-white mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <a href="mailto:cwb.agency@outlook.com" className="text-slate-400 hover:text-white transition-colors text-sm">
                  cwb.agency@outlook.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <a href="https://wa.me/01519601517" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors text-sm">
                  +880 1519 601 517
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <div className="text-slate-400 text-sm">
                  <p>Auliabad, Kalihati</p>
                  <p>Tangail, Dhaka</p>
                  <a href="https://maps.app.goo.gl/PqG45pfvditVMPY79?g_st=ic" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 mt-1 inline-block text-xs">
                    View on Map →
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="border-t border-white/10 py-8 mb-8">
          <div className="max-w-2xl mx-auto bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-8">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Subscribe to Our Newsletter</h3>
              <p className="text-slate-300">Get the latest updates, insights, and digital tips delivered to your inbox.</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newsletterEmail) {
                  subscribeNewsletter.mutate({
                    email: newsletterEmail,
                    name: newsletterName,
                  });
                }
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Your Name (optional)"
                  value={newsletterName}
                  onChange={(e) => setNewsletterName(e.target.value)}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <input
                  type="email"
                  placeholder="Your Email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
                <button
                  type="submit"
                  disabled={subscribeNewsletter.isPending}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {subscribeNewsletter.isPending ? (
                    <span>Subscribing...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Subscribe</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {newsletterSuccess && (
              <div className="mt-4 flex items-center justify-center gap-2 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300">
                <CheckCircle className="w-5 h-5" />
                <span>Thank you for subscribing! Check your email for confirmation.</span>
              </div>
            )}

            {subscribeNewsletter.error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-center">
                <span>{subscribeNewsletter.error.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-8">
          {/* Bottom Footer */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-400 text-sm">
              © {currentYear} Connect With Bayezid. All rights reserved.
            </p>
            <p className="text-slate-500 text-xs">
              Concept & Development by Sayad Md Bayezid Hosan
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
