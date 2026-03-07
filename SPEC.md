# S. Vikinesh - Personal Portfolio Website Specification

## Project Overview

**Project Name:** S. Vikinesh Portfolio  
**Type:** Personal Portfolio Website with Admin Panel  
**Core Functionality:** A premium dark-themed portfolio showcasing skills, projects, education, and blog posts with Firebase-powered admin management  
**Target Users:** Potential employers, clients, collaborators, and fellow developers

---

## UI/UX Specification

### Layout Structure

#### Page Sections
1. **Header** - Sticky navigation with blur background
2. **Hero** - Full-viewport landing with animated typing text
3. **Profile** - Circular avatar with neon glow
4. **About** - Glassmorphism card with personal info
5. **Education** - Timeline card layout
6. **Experience** - Card-based layout
7. **Skills** - Animated progress bars
8. **Projects** - Modern card grid
9. **Blog** - Card layout with thumbnails
10. **Contact** - Form with Firebase integration
11. **Footer** - Social links and copyright

#### Grid System
- Desktop: 12-column grid, max-width 1400px
- Container padding: 2rem (desktop), 1rem (mobile)
- Section spacing: 100px vertical

#### Responsive Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Visual Design

#### Color Palette
```css
--bg-primary: #0a0a0a;
--bg-secondary: #0f172a;
--bg-tertiary: #1e293b;
--accent: #3b82f6;
--accent-glow: #60a5fa;
--accent-secondary: #1d4ed8;
--text-primary: #f8fafc;
--text-secondary: #94a3b8;
--text-muted: #64748b;
--glass-bg: rgba(15, 23, 42, 0.6);
--glass-border: rgba(59, 130, 246, 0.2);
--success: #10b981;
--error: #ef4444;
--warning: #f59e0b;
```

#### Typography
- **Primary Font:** 'Outfit', sans-serif (headings)
- **Secondary Font:** 'DM Sans', sans-serif (body)
- **Monospace:** 'JetBrains Mono', monospace (code/tech)

**Font Sizes:**
- Hero Title: 4.5rem (desktop), 2.5rem (mobile)
- Section Title: 2.5rem (desktop), 1.75rem (mobile)
- Body: 1rem
- Small: 0.875rem

#### Spacing System
- Base unit: 8px
- Section padding: 80px 0
- Card padding: 24px
- Gap between cards: 24px

#### Visual Effects
- **Glassmorphism:** backdrop-filter: blur(12px)
- **Neon Glow:** box-shadow: 0 0 20px rgba(59, 130, 246, 0.5)
- **Card Shadow:** 0 4px 24px rgba(0, 0, 0, 0.3)
- **Gradient:** linear-gradient(135deg, #0a0a0a 0%, #0f172a 50%, #1e293b 100%)

### Components

#### Header
- Height: 70px
- Background: rgba(10, 10, 10, 0.8) with backdrop-blur
- Logo: Left-aligned, gradient text
- Nav links: Right-aligned, hover underline animation
- Mobile: Hamburger menu with slide-in panel

#### Hero Section
- Full viewport height (100vh)
- Animated gradient background with subtle movement
- Typing animation for role titles
- Social icons with hover glow
- CTA buttons: Glowing pill-shaped

#### Profile Image
- Size: 200px diameter
- Border: 3px solid with gradient
- Box-shadow: 0 0 30px rgba(59, 130, 246, 0.4)
- Hover: Scale up with intensified glow

#### Education Cards
- Icon on left
- Title and date
- Glow border on hover
- Slide-in animation from bottom

#### Skill Bars
- Animated fill on scroll
- Percentage display
- Gradient fill color
- Subtle background pattern

#### Project Cards
- Image with overlay on hover
- Title, description, tech stack
- Two buttons: Live Demo, GitHub
- Hover: Lift effect with glow

#### Contact Form
- Floating labels
- Input focus glow
- Submit button with loading state
- Success/error toast notifications

---

## Functionality Specification

### Core Features

1. **Smooth Scroll Navigation**
   - Click nav links to scroll to sections
   - Update active nav item based on scroll position

2. **Typing Animation**
   - Cycle through: "Web Developer", "Frontend Enthusiast", "Problem Solver"
   - Type and delete effect

3. **Scroll Reveal Animations**
   - Elements fade in when entering viewport
   - Staggered animation for card groups

4. **Mobile Menu**
   - Hamburger icon animation
   - Slide-in menu from right
   - Close on link click or outside click

5. **Contact Form**
   - Client-side validation
   - Submit to Firebase Firestore
   - Loading state and feedback

### Firebase Integration

#### Firestore Collections

**projects**
```json
{
  "title": "string",
  "description": "string",
  "imageURL": "string",
  "technologies": ["string"],
  "githubLink": "string",
  "liveLink": "string",
  "createdAt": "timestamp"
}
```

**skills**
```json
{
  "name": "string",
  "percentage": "number",
  "category": "string",
  "order": "number"
}
```

**blogs**
```json
{
  "title": "string",
  "preview": "string",
  "thumbnail": "string",
  "content": "string",
  "publishedAt": "timestamp"
}
```

**messages**
```json
{
  "name": "string",
  "email": "string",
  "message": "string",
  "createdAt": "timestamp"
}
```

**about**
```json
{
  "bio": "string",
  "email": "string",
  "phone": "string",
  "location": "string"
}
```

### Admin Panel Features

1. **Authentication**
   - Firebase Google Sign-In
   - Protected routes
   - Session persistence

2. **Dashboard**
   - Quick stats overview
   - Recent messages
   - Quick actions

3. **Projects Management**
   - List all projects
   - Add new project
   - Edit existing
   - Delete project

4. **Skills Management**
   - Add/edit/delete skills
   - Reorder capability

5. **Blog Management**
   - Create posts
   - Edit posts
   - Delete posts

6. **Messages Viewer**
   - View all submissions
   - Mark as read

---

## Acceptance Criteria

### Visual Checkpoints
- [ ] Dark theme with black and blue gradients throughout
- [ ] Glassmorphism cards with blur effect
- [ ] Neon glow on interactive elements
- [ ] Smooth animations without jank
- [ ] Responsive on all breakpoints
- [ ] Typography is crisp and readable
- [ ] Consistent spacing and alignment

### Functional Checkpoints
- [ ] Navigation scrolls to correct sections
- [ ] Typing animation plays smoothly
- [ ] Mobile menu opens/closes properly
- [ ] Contact form submits to Firebase
- [ ] Admin login works
- [ ] Admin can CRUD operations
- [ ] Scroll reveal animations trigger correctly

### Performance
- [ ] Page loads under 3 seconds
- [ ] Animations run at 60fps
- [ ] No console errors

---

## File Structure

```
D:\my cv\
├── index.html              # Main website
├── styles.css             # All styles
├── script.js              # Main JavaScript
├── admin.html             # Admin panel
├── admin.css              # Admin styles
├── admin.js               # Admin JavaScript
├── firebase-config.js    # Firebase configuration
├── SPEC.md                # This specification
└── README.md              # Deployment instructions
```
