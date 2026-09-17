import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export interface SiteConfig {
  announcementBanner: string;
  announcementVisible: boolean;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
}

export const defaultSiteConfig: SiteConfig = {
  announcementBanner: "🚨 NEW: Premium Canvas Deliveries now available across India! 🇮🇳",
  announcementVisible: true,
  heroTitle: "Immortalize Your \nMemories on Canvas",
  heroSubtitle: "Handcrafted portrait art that captures the soul, painted with passion and precision. Turn your favorite moments into timeless masterpieces.",
  aboutText: "Laxmi Artworks is a premier art studio dedicated to creating breathtaking portrait paintings and hyper-realistic canvas art. Every stroke of the brush is driven by a passion to capture not just the likeness, but the very essence and soul of the subject."
};

const SiteContext = createContext<SiteConfig>(defaultSiteConfig);

export const useSiteConfig = () => useContext(SiteContext);

export const SiteProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);

  useEffect(() => {
    // Listen to site_config for general settings (announcement, hero, about)
    const unsubSite = onSnapshot(doc(db, 'settings', 'site_config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(prev => ({
          ...prev,
          announcementBanner: data.announcementBanner ?? prev.announcementBanner,
          announcementVisible: data.announcementVisible ?? prev.announcementVisible,
          heroTitle: data.heroTitle ?? prev.heroTitle,
          heroSubtitle: data.heroSubtitle ?? prev.heroSubtitle,
          aboutText: data.aboutText ?? prev.aboutText
        }));
      }
    }, (error) => {
      if (error.code !== 'unavailable' && !error.message?.includes('offline')) {
        console.error("Failed to load site config via snapshot:", error);
      }
    });

    return () => {
      unsubSite();
    };
  }, []);

  return (
    <SiteContext.Provider value={config}>
      {children}
    </SiteContext.Provider>
  );
};
