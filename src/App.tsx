import TopBanner from "./components/TopBanner";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import About from "./components/About";
import Services from "./components/Services";
import Process from "./components/Process";
import Gallery from "./components/Gallery";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import Newsletter from "./components/Newsletter";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import FloatingWidgets from "./components/FloatingWidgets";
import LiveChat from "./components/LiveChat";
import AdminPanel from "./components/AdminPanel";
import GlobalPopup from "./components/GlobalPopup";
import { useState, useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  

  const [isLoginRoute, setIsLoginRoute] = useState(false);
  const [isSignupRoute, setIsSignupRoute] = useState(false);

  useEffect(() => {
    if (window.location.pathname === '/login' || window.location.pathname === '/auth') {
      setIsLoginRoute(true);
    }
    if (window.location.pathname === '/signup') {
      setIsSignupRoute(true);
    }
    if (window.location.pathname === '/secret-admin') {
      setIsAdminRoute(true);
    }
  }, []);

  if (isLoginRoute) {
    return <LoginPage />;
  }
  if (isSignupRoute) {
    return <SignupPage />;
  }

  if (isAdminRoute) {
    return <AdminPanel />;
  }

  return (
    <div className="bg-[#030303] text-neutral-50 min-h-screen font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <GlobalPopup />
      <FloatingWidgets />
      <LiveChat />
      <TopBanner />
      <Navbar />
      <main>
        <Hero />
        <About />
        <Services />
        <Process />
        <Gallery />
        <Testimonials />
        <FAQ />
        <Newsletter />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
