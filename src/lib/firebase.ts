import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

// Handle both standard JSON import and situations where it might be a default export object
const firebaseConfig = (firebaseConfigData as any).default || firebaseConfigData;

const app = initializeApp(firebaseConfig);
// CRITICAL: The app will break without passing the database ID if it's not default
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 
export const auth = getAuth(app);
