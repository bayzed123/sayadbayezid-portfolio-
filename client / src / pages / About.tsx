import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "wouter";
import { ChevronRight, Award, Target, Users, Zap, Shield, BookOpen, FileText, CheckCircle, ArrowRight } from "lucide-react";

/**
 * Design Philosophy: About Us Page
 * - Compelling company story with founder background
 * - Clear service offerings with icons
 * - Professional and trustworthy design
 * - Strong call-to-action sections
 */

export default function About() {
  const services = [
    {
      icon: Zap,
      title: "Digital Marketing",
      description: "Data-driven marketing strategies that increase visibility, engagement, and drive measurable business growth.",
    },
    {
      icon: Shield,
      title: "Meta Technical Support",
      description: "Permission-based technical solutions for Facebook/Meta issues. Policy-following, privacy-respecting, transparent.",
    },
    {
      icon: Target,
      title: "SEO Optimization",
      description: "Strategic SEO services to improve your search rankings, drive organic traffic, and enhance online visibility.",
    },
    {
      icon: BookOpen,
      title: "Content Strategy",
      description: "Compelling content that engages your audience and tells your brand story across all platforms.",
    },
    {
      icon: Users,
      title: "Social Media Management",
      description: "Professional social media management that builds community, engagement, and drives brand awareness.",
    },
    {
      icon: Award,
      title: "Business Asset Management",
      description: "Secure management of digital business assets with the highest standards of privacy and integrity.",
    },
  ];

  const stats = [
    { number: "2,200+", label: "Happy Clients Worldwide" },
    { number: "2,140", label: "Satisfied & Analyzed Clients" },
    { number: "5+", label: "Years Experience" },
    { number: "98%", label: "Client Retention Rate" },
  ];

  const expertise = [
    "SEO Specialist",
    "Content Strategy",
    "Social Media",
    "Tech Support",
    "Asset Management",
    "Content Creation",
  ];

  const latestArticles = [
    {
      title: "Facebook Account Suspensions 2026: Root Causes & Legal Solutions",
      icon: "📄",
    },
    {
      title: "Facebook Unlock Code Explained: How to Get Back Your Account",
      icon: "🔓",
    },
    {
      title: "Digital Marketing 2026: When Data Saturates Humanity",
      icon: "📊",
    },
    {
      title: "Securing Digital Frontier: Vision & Mission as Meta Tech Provider",
      icon: "🛡️",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col">
      <Header />

      <main className="flex-1 w-full px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-8 text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">About Us</span>
          </div>

          {/* Hero Section */}
          <div className="mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">About Connect With Bayezid</h1>
            <div className="space-y-4">
              <p className="text-xl text-slate-300 max-w-3xl">
                <strong className="text-indigo-300">Your Digital Growth Partner</strong>
              </p>
              <p className="text-lg text-slate-300 max-w-3xl leading-relaxed">
                Connect With Bayezid is a leading digital agency and technical consultancy based in Bangladesh. We specialize in Digital Marketing, SEO, Content Strategy, and Social Media Management. As a verified Tech Provider, we're dedicated to solving complex technical issues within the Meta ecosystem through policy-following and transparent practices.
              </p>
            </div>
          </div>

          {/* Core Principles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 flex items-start gap-4">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-white mb-2">Policy-following & Privacy-respecting</h3>
                <p className="text-slate-400 text-sm">Strict adherence to all platform policies and regulations</p>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 flex items-start gap-4">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-white mb-2">Permission-based Technical Solutions</h3>
                <p className="text-slate-400 text-sm">Transparent and authorized technical support</p>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 flex items-start gap-4">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-white mb-2">Educational Content & Tech Tips</h3>
                <p className="text-slate-400 text-sm">Empowering users with knowledge and expertise</p>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 text-center hover:border-indigo-500/50 transition-all">
                <div className="text-3xl md:text-4xl font-bold text-indigo-400 mb-2">{stat.number}</div>
                <div className="text-slate-300 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Meet the Founder Section */}
          <div className="mb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              {/* Founder Image */}
              <div className="rounded-2xl overflow-hidden border border-white/10 order-2 md:order-1 shadow-2xl shadow-indigo-500/20">
                <img src="https://drive.google.com/thumbnail?id=1Cu4SbMQI7dxOWGfOsIKawduFX6jVe4EA&sz=w1000" alt="Sayad Md Bayezid Hosan" className="w-full h-full object-cover" />
              </div>

              {/* Founder Info */}
              <div className="order-1 md:order-2">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Meet the Founder</h2>

                {/* Professional Background */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-indigo-300 mb-3">Professional Background</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Tech Provider and digital content creator specializing in Meta ecosystem technical solutions. Final-year undergraduate student in English at <strong className="text-white">Northern University Bangladesh</strong> (Expected Graduation: June 2026).
                  </p>
                </div>

                {/* Legal Details */}
                <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-lg">
                  <h3 className="text-lg font-bold text-white mb-3">Legal Details</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li><strong className="text-white">Legal Name:</strong> Sayad Md Bayezid Hosan</li>
                    <li><strong className="text-white">Operating Status:</strong> <span className="text-green-400">Active</span></li>
                    <li><strong className="text-white">Founded by:</strong> Sayad Md Bayezid Hosan</li>
                  </ul>
                </div>

                {/* Core Values */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-white mb-3">Core Values</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Policy-following & compliant
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Privacy-respecting practices
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Transparent operations
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      High integrity standards
                    </li>
                  </ul>
                </div>

                {/* Expertise */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {expertise.map((skill, idx) => (
                      <span key={idx} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Founder Quote */}
          <div className="bg-gradient-to-r from-indigo-500/10 to-purple-600/10 border border-indigo-500/30 rounded-2xl p-8 md:p-12 mb-16">
            <blockquote className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-white mb-4 italic">
                "My goal is to help individuals and businesses navigate digital platforms safely and efficiently by combining academic knowledge with practical technical expertise."
              </p>
              <p className="text-indigo-300 font-semibold">— Bayezid Hosan</p>
            </blockquote>
          </div>

          {/* Services Section */}
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">What We Do</h2>
            <p className="text-slate-300 mb-12">Comprehensive digital solutions tailored to your business needs</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service, idx) => {
                const Icon = service.icon;
                return (
                  <div key={idx} className="group bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-2">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">{service.title}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">{service.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Latest Articles Section */}
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Latest Articles</h2>
            <p className="text-slate-300 mb-8">Educational content and insights from our blog</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {latestArticles.map((article, idx) => (
                <Link key={idx} href="/blog" className="group">
                  <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-500/20 h-full">
                    <div className="flex items-start gap-4">
                      <span className="text-3xl flex-shrink-0">{article.icon}</span>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        <div className="mt-4 flex items-center gap-2 text-indigo-400 group-hover:text-indigo-300 transition-colors">
                          <span className="text-sm font-semibold">Read Article</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="text-center mt-8">
              <Link href="/blog" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-indigo-500/50 transition-all hover:scale-105">
                View All Articles
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Get In Touch</h2>
            <p className="text-indigo-100 mb-8 text-lg">Let's Work Together - Ready to take your digital presence to the next level? Reach out and let's discuss your project.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact" className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl hover:bg-slate-100 transition-all hover:scale-105 text-center">
                Get In Touch
              </Link>
              <a href="https://wa.me/message/TDYG575YENF6F1" target="_blank" rel="noopener noreferrer" className="px-8 py-4 border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-all hover:scale-105">
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
