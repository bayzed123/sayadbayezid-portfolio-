import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Portfolio", href: "/portfolio" },
    { label: "Certificates", href: "/certificates" },
    { label: "Products", href: "/products" },
    { label: "Checkout", href: "/checkout" },
    { label: "Blog", href: "/blog" },
    { label: "News", href: "/news" },
    { label: "Newsletter", href: "/newsletter" },
    { label: "Track Orders", href: "/order-tracking" },
    { label: "Write", href: "/write-blog" },
    { label: "Reviews", href: "/client-reviews" },
    { label: "Agreement", href: "/customer-agreement" },
    { label: "Contact", href: "/contact" },
    { label: "Contact Form", href: "/contact-form" },
    { label: "Admin", href: "/admin" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 backdrop-blur-lg">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <span className="text-xl font-bold text-white">CWB</span>
          </div>
          <span className="text-lg font-bold text-white hidden sm:inline">Connect With Bayezid</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-slate-300 hover:text-white transition-colors font-medium text-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Menu className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <nav className="md:hidden border-t border-white/10 bg-slate-900/95 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="text-slate-300 hover:text-white transition-colors font-medium"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
