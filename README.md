# S. Vikinesh Portfolio Website

A premium modern personal portfolio website with dark theme, glassmorphism design, and Firebase integration.

## Features

- **Modern Dark Theme** - Black and blue gradient design
- **Glassmorphism UI** - Frosted glass card effects
- **Smooth Animations** - Scroll reveal, typing effects, hover animations
- **Responsive Design** - Mobile-first, works on all devices
- **Firebase Integration** - Contact form, admin panel
- **Admin Panel** - Manage projects, skills, blog posts, and messages

## File Structure

```
D:\my cv\
├── index.html          # Main portfolio website
├── styles.css          # All CSS styles
├── script.js           # Main JavaScript (animations)
├── admin.html          # Admin panel
├── admin.css           # Admin styles
├── admin.js            # Admin JavaScript
├── firebase-config.js  # Firebase configuration
├── SPEC.md            # Design specification
└── README.md          # This file
```

## Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Firestore Database**
4. Enable **Authentication** (Google Sign-In)
5. Go to Project Settings > Your apps > Web app
6. Copy the Firebase config

### 2. Configure Firebase

Edit `firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. Deploy to Vercel

#### Option A: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

#### Option B: Git Integration

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Import your repository
4. Configure build settings:
   - Framework Preset: Other
   - Build Command: (leave empty)
   - Output Directory: ./
5. Deploy

### 4. Firebase Security Rules

Deploy Firestore rules using Firebase CLI:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init

# Deploy rules
firebase deploy --only firestore:rules
```

## Admin Panel

Access the admin panel at `/admin.html`

1. Sign in with Google
2. Manage:
   - **Projects** - Add, edit, delete portfolio projects
   - **Skills** - Manage skill bars with percentages
   - **Blog** - Create and edit blog posts
   - **Messages** - View contact form submissions
   - **About** - Update bio and contact info

## Customization

### Update Profile Image
Replace the image URL in `index.html` at line ~150:
```html
<img src="YOUR_IMAGE_URL" alt="S. Vikinesh" class="profile-img">
```

### Update Social Links
Edit the social links in the hero section of `index.html`.

### Add More Skills
In `admin.html`, go to Skills section and add new skills with percentages.

### Add More Projects
In `admin.html`, go to Projects section and add new projects.

## Technologies Used

- **HTML5** - Semantic markup
- **CSS3** - Modern CSS with variables, animations
- **JavaScript** - Vanilla JS for interactions
- **Firebase** - Firestore, Authentication
- **Vercel** - Hosting and deployment

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License - Feel free to use this template for your own portfolio!

---

Built with ❤️ by S. Vikinesh
