import { useState, useEffect } from "react";
import { Mail, X, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

/**
 * Newsletter Popup Component
 * - Auto-appears after 30 seconds on the website
 * - Beautiful modal with smooth animations
 * - Saves subscriber data to database
 * - Shows success message on subscription
 */

export default function NewsletterPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  // Check localStorage to avoid showing popup multiple times per session
  useEffect(() => {
    const hasShownPopup = localStorage.getItem("newsletter_popup_shown");
    if (hasShownPopup) {
      setHasShown(true);
      return;
    }

    // Show popup after 30 seconds
    const timer = setTimeout(() => {
      setIsVisible(true);
      localStorage.setItem("newsletter_popup_shown", "true");
      setHasShown(true);
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, []);

  const { mutate: subscribeNewsletter, isPending } = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
      setEmail("");
      setName("");

      // Auto-close after 3 seconds
      setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    },
    onError: (error) => {
      console.error("Subscription error:", error);
      // Show error but allow retry
    },
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      alert("Please enter your email address");
      return;
    }

    subscribeNewsletter({
      email: email.trim(),
      name: name.trim() || undefined,
    });
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible || hasShown === false) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 z-40 ${
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* Popup Modal */}
      <div
        className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-indigo-500/30 z-50 transition-all duration-300 ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
        }`}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Close newsletter popup"
        >
          <X className="w-5 h-5 text-slate-300" />
        </button>

        {/* Content */}
        <div className="p-8">
          {!isSubmitted ? (
            <>
              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4">
                  <Mail className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Stay Updated</h2>
                <p className="text-slate-300 text-sm">
                  Subscribe to our newsletter for latest updates, tips, and exclusive content.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubscribe} className="space-y-4">
                {/* Name Input */}
                <div>
                  <Input
                    type="text"
                    placeholder="Your name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-indigo-500"
                    disabled={isPending}
                  />
                </div>

                {/* Email Input */}
                <div>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-indigo-500"
                    disabled={isPending}
                    required
                  />
                </div>

                {/* Subscribe Button */}
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/50 text-white font-semibold py-2 rounded-lg transition-all"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Subscribing...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Subscribe Now
                    </>
                  )}
                </Button>
              </form>

              {/* Footer Text */}
              <p className="text-xs text-slate-400 text-center mt-4">
                We respect your privacy. Unsubscribe anytime.
              </p>
            </>
          ) : (
            /* Success State */
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-4 animate-pulse">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Thank You!</h3>
              <p className="text-slate-300 text-sm">
                You've successfully subscribed to our newsletter. Check your email for confirmation.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
