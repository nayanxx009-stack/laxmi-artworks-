import { ReactNode } from 'react';

export interface NavItem {
  name: string;
  href: string;
}

export interface Service {
  title: string;
  description: string;
  icon: string;
}

export interface GalleryItem {
  id: number;
  title: string;
  category: string;
  image: string;
}

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  content: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}
