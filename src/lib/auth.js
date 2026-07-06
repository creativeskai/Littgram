// src/lib/auth.js
// Firebase Auth — Google Sign-In only.
// The Firebase JS SDK handles the OAuth popup and token refresh.
// firebase.js uses getAuthToken() instead of the old anonymous REST auth.

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as _signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA3aB2fNYzSSiWGNL5SM9EmRPGAM71nyQI',
  authDomain: 'littgram-54427.firebaseapp.com',
  projectId: 'littgram-54427',
};

const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOut = () => _signOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

export async function getAuthToken() {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}
