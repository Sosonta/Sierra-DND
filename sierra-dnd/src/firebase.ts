import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {

  apiKey: "AIzaSyC5tTG-OvZNJw2lXmH6liVQvUV59kq7iz4",

  authDomain: "sierradnd-b9d52.firebaseapp.com",

  projectId: "sierradnd-b9d52",

  storageBucket: "sierradnd-b9d52.firebasestorage.app",

  messagingSenderId: "916578203465",

  appId: "1:916578203465:web:2912c201dfedbe75478c98"

};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
