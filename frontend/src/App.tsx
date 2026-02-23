import { Routes, Route } from "react-router-dom";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import Home from "./pages/Home";
import DashboardPage from "./pages/DashboardPage";
import DemoPage from "./pages/DemoPage";
import DocsPage from "./pages/DocsPage";
import ScannerPage from "./pages/ScannerPage";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
