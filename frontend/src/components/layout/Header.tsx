import { Link, useLocation } from "react-router-dom";
import { Shield } from "lucide-react";

const navItems = [
  { path: "/", label: "Home" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/demo", label: "Demo" },
  { path: "/scanner", label: "Scanner" },
  { path: "/docs", label: "Docs" },
];

export default function Header() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary-400" />
          <span className="text-lg font-bold text-white">
            StealthPay<span className="text-primary-400">402</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === item.path
                  ? "bg-primary-600/20 text-primary-400"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="badge-green">Polygon</span>
          <a
            href="https://github.com/stealthpay402"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
