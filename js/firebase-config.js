import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDnysYHqyScesOvuCo9_E--gmCS0bmo1WU",
  authDomain: "v-achievements.firebaseapp.com",
  projectId: "v-achievements",
  messagingSenderId: "737670174682",
  appId: "1:737670174682:web:a639c66f4871089fe592e3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);