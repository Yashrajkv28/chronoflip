import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBKYELpT_gMTwqXiM5fGIQgFZhtnJGlQdw",
  authDomain: "speechtimer-ceb4b.firebaseapp.com",
  databaseURL: "https://speechtimer-ceb4b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "speechtimer-ceb4b",
  storageBucket: "speechtimer-ceb4b.firebasestorage.app",
  messagingSenderId: "896018288207",
  appId: "1:896018288207:web:f40d630645477fa8dc643a",
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
