import { Link } from "react-router-dom";
import { Shield, ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary-400" />
              <span className="text-sm font-semibold text-white">
                StealthPay<span className="text-primary-400">402</span>
              </span>
            </div>
            <p className="text-xs text-gray-500">
              x402 privacy payments on Polygon Mainnet (137)
            </p>
          </div>

          {/* Pages */}
          <div>
            <div className="mb-2 text-xs font-medium text-gray-400">Pages</div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { to: "/demo", label: "Live Demo" },
                { to: "/dashboard", label: "Dashboard" },
                { to: "/agents", label: "Agents" },
                { to: "/scanner", label: "Scanner" },
                { to: "/docs", label: "Docs" },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* External */}
          <div>
            <div className="mb-2 text-xs font-medium text-gray-400">Links</div>
            <div className="flex flex-col gap-1">
              <a
                href="https://github.com/Pratiikpy/stealthpay402"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
              >
                GitHub <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href="https://polygonscan.com/address/0x78308d47c2f534C4D51B35B1e1E95dFb689b9a86#code"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
              >
                Router on Polygonscan <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href="https://polygonscan.com/tx/0xdf5edc40df3728f795d2d78c1fa9c4bd53b971bb24d1027eb9a4590617a0caeb"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
              >
                E2E Payment TX <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
