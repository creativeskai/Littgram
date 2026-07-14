// src/lib/i18n.js
// UI language for menus and screen titles. Chosen on the login screen,
// changeable in Profile. Content (books, posts) is not affected.
// The language lives in a tiny subscribable store so components re-render
// in place on change — no full page reload.

import { useSyncExternalStore } from 'react';

const KEY = 'littgram_ui_lang';

export const UI_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
];

const STRINGS = {
  en: {
    home: 'Home', explore: 'Explore', library: 'Library', goals: 'Goals', profile: 'Profile',
    myLibrary: 'My Library', challenges: 'Challenges', notifications: 'Notifications',
    quotesWall: 'Quotes wall', continueReading: 'Continue reading', cloudLibrary: 'Cloud library',
    feedLanguage: 'Feed language', genre: 'Genre', signOut: 'Sign out', myPosts: 'My posts',
    yourStory: 'Your story', uiLanguage: 'App language',
  },
  bn: {
    home: 'হোম', explore: 'অন্বেষণ', library: 'লাইব্রেরি', goals: 'লক্ষ্য', profile: 'প্রোফাইল',
    myLibrary: 'আমার লাইব্রেরি', challenges: 'চ্যালেঞ্জ', notifications: 'বিজ্ঞপ্তি',
    quotesWall: 'উদ্ধৃতি দেয়াল', continueReading: 'পড়া চালিয়ে যান', cloudLibrary: 'ক্লাউড লাইব্রেরি',
    feedLanguage: 'ফিডের ভাষা', genre: 'ধরন', signOut: 'সাইন আউট', myPosts: 'আমার পোস্ট',
    yourStory: 'আপনার স্টোরি', uiLanguage: 'অ্যাপের ভাষা',
  },
  hi: {
    home: 'होम', explore: 'खोजें', library: 'पुस्तकालय', goals: 'लक्ष्य', profile: 'प्रोफ़ाइल',
    myLibrary: 'मेरा पुस्तकालय', challenges: 'चुनौतियाँ', notifications: 'सूचनाएँ',
    quotesWall: 'उद्धरण दीवार', continueReading: 'पढ़ना जारी रखें', cloudLibrary: 'क्लाउड पुस्तकालय',
    feedLanguage: 'फ़ीड भाषा', genre: 'शैली', signOut: 'साइन आउट', myPosts: 'मेरी पोस्ट',
    yourStory: 'आपकी स्टोरी', uiLanguage: 'ऐप की भाषा',
  },
  mr: {
    home: 'होम', explore: 'शोधा', library: 'ग्रंथालय', goals: 'ध्येय', profile: 'प्रोफाइल',
    myLibrary: 'माझे ग्रंथालय', challenges: 'आव्हाने', notifications: 'सूचना',
    quotesWall: 'उद्धरण भिंत', continueReading: 'वाचन सुरू ठेवा', cloudLibrary: 'क्लाउड ग्रंथालय',
    feedLanguage: 'फीड भाषा', genre: 'प्रकार', signOut: 'साइन आउट', myPosts: 'माझ्या पोस्ट',
    yourStory: 'तुमची स्टोरी', uiLanguage: 'अ‍ॅपची भाषा',
  },
};

let current = localStorage.getItem(KEY) || 'en';
const listeners = new Set();

export const getUiLang = () => current;
export const setUiLang = (code) => {
  current = code;
  localStorage.setItem(KEY, code);
  listeners.forEach(fn => fn());
};
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// Components that render t() strings call this so they update live.
export const useUiLang = () => useSyncExternalStore(subscribe, getUiLang);

export const t = (key) => STRINGS[current]?.[key] ?? STRINGS.en[key] ?? key;
