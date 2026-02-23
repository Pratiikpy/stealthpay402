import { Shield } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-400" />
            <span className="text-sm text-gray-400">
              StealthPay402 — x402 Privacy Payments on Polygon
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>Polygon Mainnet (137)</span>
            <span>|</span>
            <a href="https://github.com/Pratiikpy/stealthpay402" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
