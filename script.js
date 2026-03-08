document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initMobileMenu();
    initTypingAnimation();
    initSmoothScroll();
    initScrollReveal();
    initSkillBars();
    initContactForm();
    loadSiteData();
});

async function loadSiteData() {
    if (typeof db === 'undefined' || !db) {
        console.log('Firebase not configured - using default content');
        return;
    }
    
    try {
        // Load profile
        const profileDoc = await db.collection('site').doc('profile').get();
        if (profileDoc.exists && profileDoc.data().profilePic) {
            const profileImg = document.querySelector('.profile-img');
            if (profileImg) profileImg.src = profileDoc.data().profilePic;
        }

        // Load hero
        const heroDoc = await db.collection('site').doc('hero').get();
        if (heroDoc.exists) {
            const heroData = heroDoc.data();
            if (heroData.name) {
                document.querySelector('.hero-title').textContent = heroData.name;
            }
            if (heroData.greeting) {
                document.querySelector('.hero-greeting').textContent = heroData.greeting;
            }
            if (heroData.intro) {
                document.querySelector('.hero-intro').textContent = heroData.intro;
            }
            if (heroData.roles && heroData.roles.length > 0) {
                // Update typing animation with new roles
                window.heroRoles = heroData.roles;
            }
        }

        // Load about
        const aboutDoc = await db.collection('site').doc('about').get();
        if (aboutDoc.exists) {
            const aboutData = aboutDoc.data();
            const aboutContent = document.querySelector('.about-content');
            if (aboutContent && aboutData.bio) {
                aboutContent.querySelector('h3').textContent = 'Passionate Web Developer';
                aboutContent.querySelector('p').textContent = aboutData.bio;
            }
            if (aboutData.email) {
                const emailLinks = document.querySelectorAll('.contact-value[href^="mailto:"]');
                emailLinks.forEach(link => link.textContent = aboutData.email);
            }
            if (aboutData.phone) {
                const phoneLinks = document.querySelectorAll('.contact-value[href^="tel:"]');
                phoneLinks.forEach(link => {
                    link.textContent = aboutData.phone;
                    link.href = 'tel:' + aboutData.phone;
                });
            }
            if (aboutData.location) {
                const locationEls = document.querySelectorAll('.contact-value:not([href])');
                locationEls.forEach(el => el.textContent = aboutData.location);
            }
            // Stats
            if (aboutData.experience) {
                const statNumbers = document.querySelectorAll('.stat-number');
                if (statNumbers[0]) statNumbers[0].textContent = aboutData.experience + '+';
            }
            if (aboutData.projects) {
                const statNumbers = document.querySelectorAll('.stat-number');
                if (statNumbers[1]) statNumbers[1].textContent = aboutData.projects + '+';
            }
            if (aboutData.technologies) {
                const statNumbers = document.querySelectorAll('.stat-number');
                if (statNumbers[2]) statNumbers[2].textContent = aboutData.technologies + '+';
            }
        }

        // Load social links
        const socialDoc = await db.collection('site').doc('social').get();
        if (socialDoc.exists) {
            const socialData = socialDoc.data();
            const socialLinks = document.querySelectorAll('.hero-social .social-link, .footer-social a');
            if (socialData.github && socialLinks[0]) socialLinks[0].href = socialData.github;
            if (socialData.linkedin && socialLinks[1]) socialLinks[1].href = socialData.linkedin;
            if (socialData.instagram && socialLinks[2]) socialLinks[2].href = socialData.instagram;
            if (socialData.facebook && socialLinks[3]) socialLinks[3].href = socialData.facebook;
            if (socialData.whatsapp && socialLinks[4]) socialLinks[4].href = socialData.whatsapp;
        }

    } catch (error) {
        console.log('Error loading site data:', error);
    }
}

function initHeader() {
    const header = document.getElementById('header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    updateActiveNavLink();
    window.addEventListener('scroll', updateActiveNavLink);
}

function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const nav = document.getElementById('nav');
    const navLinks = document.querySelectorAll('.nav-link');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        nav.classList.toggle('active');
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            nav.classList.remove('active');
        });
    });

    document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && !hamburger.contains(e.target)) {
            hamburger.classList.remove('active');
            nav.classList.remove('active');
        }
    });
}

function initTypingAnimation() {
    const typingText = document.getElementById('typingText');
    const phrases = window.heroRoles || [
        'Web Developer',
        'Frontend Enthusiast',
        'Problem Solver'
    ];
    
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;

    function type() {
        const currentPhrase = phrases[phraseIndex];
        
        if (isDeleting) {
            typingText.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
            typingSpeed = 50;
        } else {
            typingText.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
            typingSpeed = 100;
        }

        if (!isDeleting && charIndex === currentPhrase.length) {
            isDeleting = true;
            typingSpeed = 2000;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typingSpeed = 500;
        }

        setTimeout(type, typingSpeed);
    }

    type();
}

function initSmoothScroll() {
    const navLinks = document.querySelectorAll('.nav-link, .hero-buttons a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    
    const revealOnScroll = () => {
        reveals.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;
            
            if (elementTop < window.innerHeight - elementVisible) {
                element.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll();
}

function initSkillBars() {
    const skillCards = document.querySelectorAll('.skill-card');
    const skillsSection = document.getElementById('skills');
    
    const animateSkillBars = () => {
        const sectionTop = skillsSection.getBoundingClientRect().top;
        const sectionVisible = window.innerHeight - 200;
        
        if (sectionTop < sectionVisible) {
            skillCards.forEach(card => {
                const progress = card.querySelector('.skill-progress');
                const percentage = progress.dataset.progress;
                card.style.setProperty('--progress', `${percentage}%`);
                card.classList.add('animated');
            });
            
            window.removeEventListener('scroll', animateSkillBars);
        }
    };

    window.addEventListener('scroll', animateSkillBars);
    animateSkillBars();
}

function initContactForm() {
    const form = document.getElementById('contactForm');
    
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('.btn-submit');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <span>Sending...</span>
            <svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                <path d="M12 2a10 10 0 0110 10" stroke-linecap="round"/>
            </svg>
        `;

        try {
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;

            if (typeof db !== 'undefined' && db) {
                await db.collection('messages').add({
                    name: name,
                    email: email,
                    message: message,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                showToast('Message sent successfully!', 'success');
                form.reset();
            } else {
                console.log('Form submitted:', { name, email, message });
                showToast('Message sent! (Demo mode)', 'success');
                form.reset();
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Failed to send message. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    
    toast.className = `toast ${type}`;
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Add intersection observer for better scroll performance
if ('IntersectionObserver' in window) {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
    });
}

// Parallax effect for hero section
window.addEventListener('scroll', () => {
    const heroGradient = document.querySelector('.hero-gradient');
    if (heroGradient) {
        const scrolled = window.scrollY;
        heroGradient.style.transform = `translateY(${scrolled * 0.3}px)`;
    }
});

// Add smooth reveal for cards on hover
document.querySelectorAll('.project-card, .blog-card, .skill-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
});

// Header link click tracking
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            console.log(`Navigation to: ${href}`);
        }
    });
});
