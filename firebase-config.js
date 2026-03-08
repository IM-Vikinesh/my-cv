// Firebase Configuration Template
// Replace the placeholder values below with your actual Firebase project credentials

// 1. Go to https://console.firebase.google.com/
// 2. Create a new Firebase project
// 3. Enable Firestore Database, Authentication, and Storage
// 4. Go to Project Settings > Your apps > Web app
// 5. Copy your Firebase config object and replace the values below

const firebaseConfig = {
    apiKey: "AIzaSyAeYPYs7L43y30eOyOkQZ8uMuyTZA96poM",
    authDomain: "my-cv-f7583.firebaseapp.com",
    projectId: "my-cv-f7583",
    storageBucket: "my-cv-f7583.firebasestorage.app",
    messagingSenderId: "999722595129",
    appId: "1:999722595129:web:9eb85665f0f8ba7182eee8"
};

// Initialize Firebase
// Check if Firebase is already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app();
}

// Initialize services
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Enable Firestore persistence (optional - enables offline support)
// db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
//     if (err.code == 'failed-precondition') {
//         console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
//     } else if (err.code == 'unimplemented') {
//         console.log('The current browser does not support persistence.');
//     }
// });

// Firestore Collection Schemas

/*

=== PROJECTS COLLECTION ===
Collection: projects
Document structure:
{
    title: "string",
    description: "string", 
    imageURL: "string (URL)",
    technologies: ["array", "of", "strings"],
    githubLink: "string (URL)",
    liveLink: "string (URL)",
    createdAt: timestamp
}

=== SKILLS COLLECTION ===
Collection: skills
Document structure:
{
    name: "string",
    percentage: number (0-100),
    category: "string (optional)",
    order: number
}

=== BLOGS COLLECTION ===
Collection: blogs
Document structure:
{
    title: "string",
    preview: "string",
    thumbnail: "string (URL)",
    content: "string",
    publishedAt: timestamp
}

=== MESSAGES COLLECTION ===
Collection: messages
Document structure:
{
    name: "string",
    email: "string",
    message: "string",
    createdAt: timestamp
}

=== ABOUT COLLECTION ===
Collection: about
Document ID: "info"
Document structure:
{
    bio: "string",
    email: "string",
    phone: "string",
    location: "string"
}

*/

// Security Rules for Firestore (deploy via Firebase CLI)

/*

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow anyone to read projects, skills, blogs, and about
    match /projects/{project} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /skills/{skill} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /blogs/{blog} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /about/{about} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Only authenticated users can write messages
    match /messages/{message} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update, delete: if request.auth != null;
    }
  }
}

*/

// Authentication Setup
// 1. Go to Firebase Console > Authentication
// 2. Enable Google Sign-In provider
// 3. Add your domain to authorized domains

// Deployment Instructions
// 1. Install Firebase CLI: npm install -g firebase-tools
// 2. Login: firebase login
// 3. Initialize: firebase init
// 4. Deploy: firebase deploy
