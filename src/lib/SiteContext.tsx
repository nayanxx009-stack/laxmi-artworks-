import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';

export interface SiteConfig {
  popupEnabled?: boolean;
  popupTitle?: string;
  popupDescription?: string;
  popupButtonText?: string;
  popupButtonUrl?: string;
  popupImage?: string;
  imageUrl?: string;
  popupAutoClose?: number;
  popupFrequency?: string;
  popupUpdatedAt?: number;
  popupReadSource?: string;
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
    // 1. Direct server read to ensure fresh configuration from Firestore server (bypassing local IndexedDB cache)
    getDocFromServer(doc(db, 'settings', 'popup'))
      .then((serverSnap) => {
        if (serverSnap.exists()) {
          const data = serverSnap.data();
          const serverImg = (data.imageUrl || data.popupImage || '').trim();
          const isEnabled = data.enabled !== undefined 
            ? Boolean(data.enabled) 
            : (data.popupEnabled !== undefined ? Boolean(data.popupEnabled) : false);
          const freq = data.frequency || 'session';
          
          setConfig(prev => ({
            ...prev,
            popupEnabled: isEnabled,
            popupFrequency: freq,
            popupImage: serverImg,
            imageUrl: serverImg,
            popupUpdatedAt: data.updatedAt,
            popupReadSource: 'Firestore server (getDocFromServer)'
          }));
          console.log('[SiteContext] Fresh server popup loaded:', {
            enabled: isEnabled,
            frequency: freq,
            hasImage: Boolean(serverImg),
            updatedAt: data.updatedAt
          });
        }
      })
      .catch((err) => {
        if (err.code !== 'unavailable' && !err.message?.includes('offline')) {
          console.warn("[SiteContext] Fresh server popup read notice:", err);
        }
      });

    // 2. Listen to canonical popup config (single source of truth for global popup)
    const unsubPopup = onSnapshot(doc(db, 'settings', 'popup'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const activeImg = (data.imageUrl || data.popupImage || '').trim();
        const isEnabled = data.enabled !== undefined 
          ? Boolean(data.enabled) 
          : (data.popupEnabled !== undefined ? Boolean(data.popupEnabled) : false);
        const freq = data.frequency || 'session';
        const source = docSnap.metadata.fromCache 
          ? 'IndexedDB cache (onSnapshot)' 
          : 'Firestore server (onSnapshot)';

        setConfig(prev => {
          // If we already received a newer server read, don't let older cache overwrite
          if (prev.popupUpdatedAt && data.updatedAt && data.updatedAt < prev.popupUpdatedAt) {
            return prev;
          }
          return {
            ...prev,
            popupEnabled: isEnabled,
            popupFrequency: freq,
            popupImage: activeImg,
            imageUrl: activeImg,
            popupUpdatedAt: data.updatedAt || prev.popupUpdatedAt,
            popupReadSource: source
          };
        });
      }
    }, (error) => {
      if (error.code !== 'unavailable' && !error.message?.includes('offline')) {
        console.warn("[SiteContext] Notice in settings/popup snapshot:", error);
      }
    });

    // 3. Listen to site_config for general settings (announcement, hero, about) ONLY
    // CRITICAL: settings/popup is the sole source of truth for popup. site_config must NEVER touch popup properties.
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
      unsubPopup();
      unsubSite();
    };
  }, []);

  return (
    <SiteContext.Provider value={config}>
      {children}
    </SiteContext.Provider>
  );
};
