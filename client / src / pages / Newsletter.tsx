import { useState } from "react";
import { Link } from "wouter";
import { ChevronRight, Mail, Bell, Zap, Users, CheckCircle, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);

  const subscribeMutation = trpc.newsletter.subscribe.useMutation();

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !name) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubscribing(true);
    try {
      await subscribeMutation.mutateAsync({
        email,
        name,
      });

      setSubscriptionSuccess(true);
      setEmail("");
      setName("");

      toast.success("Successfully subscribed to our newsletter!");

      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubscriptionSuccess(false);
      }, 5000);
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error("Failed to subscribe. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  };

  const benefits = [
    {
      icon: Zap,
      title: "Latest Updates",
      description: "Get the newest blog posts and articles directly in your inbox",
    },
    {
      icon: Bell,
      title: "Exclusive Content",
      description: "Receive exclusive tips, tutorials, and insights for subscribers only",
    },
    {
      icon: Users,
      title: "Community Access",
      description: "Join our growing community of digital entrepreneurs and tech enthusiasts",
    },
    {
      icon: Mail,
      title: "Weekly Digest",
      description: "Curated weekly digest of the best content and industry news",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col">
      <Header />

      <main className="flex-1 w-full px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-8 text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Newsletter</span>
          </div>

          {/* Hero Section */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-8 h-8 text-indigo-400" />
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Subscribe to Our Newsletter
              </h1>
            </div>
            <p className="text-lg text-slate-300 max-w-2xl">
              Stay updated with the latest blog posts, digital marketing tips, web development insights, and exclusive content delivered directly to your inbox. Join thousands of subscribers who are growing their digital presence with us.
            </p>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Subscription Form */}
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Get Started</h2>

              {subscriptionSuccess ? (
                <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-8 text-center">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-green-300 mb-2">
                    Welcome to Our Newsletter!
                  </h3>
                  <p className="text-green-200 mb-4">
                    Check your email for a confirmation message. You'll start receiving updates soon.
                  </p>
                  <p className="text-sm text-green-200/70">
                    We respect your privacy and won't spam your inbox.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="space-y-4">
                  {/* Name Field */}
                  <div>
                    <label className="block text-white font-bold mb-2">Your Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                      disabled={isSubscribing}
                    />
                  </div>

                  {/* Email Field */}
                  <div>
                    <label className="block text-white font-bold mb-2">Email Address *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                      disabled={isSubscribing}
                    />
                  </div>

                  {/* Privacy Notice */}
                  <p className="text-sm text-slate-400">
                    We respect your privacy. Unsubscribe at any time.
                  </p>

                  {/* Subscribe Button */}
                  <button
                    type="submit"
                    disabled={isSubscribing}
                    className={`w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-indigo-500/50 transition-all flex items-center justify-center gap-2 ${
                      isSubscribing ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {isSubscribing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Subscribing...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Subscribe Now
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Benefits Section */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">What You'll Get</h2>

              <div className="space-y-4">
                {benefits.map((benefit, index) => {
                  const Icon = benefit.icon;
                  return (
                    <div
                      key={index}
                      className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold mb-1">{benefit.title}</h3>
                          <p className="text-slate-400 text-sm">{benefit.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Newsletter Content Preview */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 mb-16">
            <h2 className="text-2xl font-bold text-white mb-6">What We Share</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="w-12 h-12 bg-indigo-500/20 border border-indigo-500/50 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-indigo-400 font-bold">📝</span>
                </div>
                <h3 className="text-white font-bold mb-2">Blog Updates</h3>
                <p className="text-slate-400 text-sm">
                  Latest articles on web development, digital marketing, and tech trends
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="w-12 h-12 bg-purple-500/20 border border-purple-500/50 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-purple-400 font-bold">💡</span>
                </div>
                <h3 className="text-white font-bold mb-2">Pro Tips</h3>
                <p className="text-slate-400 text-sm">
                  Exclusive tips and tricks to grow your online presence and business
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="w-12 h-12 bg-pink-500/20 border border-pink-500/50 rounded-lg flex items-center justify-center mb-3">
                  <span className="text-pink-400 font-bold">🚀</span>
                </div>
                <h3 className="text-white font-bold mb-2">Resources</h3>
                <p className="text-slate-400 text-sm">
                  Tools, templates, and resources to help you succeed online
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Don't Miss Out on Exclusive Content
            </h2>
            <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
              Join our growing community of digital entrepreneurs and tech enthusiasts. Get actionable insights delivered to your inbox every week.
            </p>
            <a
              href="#subscribe"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-indigo-500/50 transition-all hover:scale-105"
            >
              Subscribe Now
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
