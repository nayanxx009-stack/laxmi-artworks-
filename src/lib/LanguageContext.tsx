import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'hi' | 'as';

const translations: Record<Language, any> = {
  en: {
    heroTitle1: 'Timeless Artistry',
    heroTitle2: 'for the',
    heroTitle3: 'Modern Collector',
    heroDesc: 'Discover exclusive collections, commissioned portraits, and limited edition prints crafted with uncompromising devotion to detail.',
    explore: 'Explore Collection',
    inquire: 'Inquire Commission'
  },
  hi: {
    heroTitle1: 'आधुनिक संग्राहक',
    heroTitle2: 'के लिए',
    heroTitle3: 'शाश्वत कला',
    heroDesc: 'विस्तार के प्रति अडिग समर्पण के साथ तैयार किए गए विशेष संग्रह, कमीशन किए गए चित्र और सीमित संस्करण प्रिंट खोजें।',
    explore: 'संग्रह का अन्वेषण करें',
    inquire: 'कमीशन पूछताछ'
  },
  as: {
    heroTitle1: 'আধুনিক সংগ্ৰাহকৰ',
    heroTitle2: 'বাবে',
    heroTitle3: 'চিৰন্তন শিল্পকলা',
    heroDesc: 'বিশেষ সংগ্ৰহ, কমিছন কৰা প্ৰতিকৃতি, আৰু সীমাবদ্ধ সংস্কৰণৰ ছপা আৱিষ্কাৰ কৰক যিবোৰ নিখুঁত মনোযোগেৰে তৈয়াৰ কৰা হৈছে।',
    explore: 'সংগ্ৰহ অন্বেষণ কৰক',
    inquire: 'কমিছনৰ বাবে সোধা'
  }
};

const LanguageContext = createContext<any>(null);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('laxmi_lang') as Language;
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'as')) {
      setLang(saved);
    }
  }, []);

  const changeLang = (l: Language) => {
    setLang(l);
    localStorage.setItem('laxmi_lang', l);
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
