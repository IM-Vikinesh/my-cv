document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    initFileUpload();
    initMobileMenu();
    initAutoSave();
    initProfileUrlListener();
});

let currentUser = null;
let siteData = {
    profile: {},
    hero: {},
    about: {},
    education: [],
    skills: [],
    projects: [],
    social: {},
    messages: []
};

let autoSaveTimers = {};

function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    toggle?.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
}

function initAuth() {
    const loginScreen = document.getElementById('loginScreen');
    const adminWrapper = document.getElementById('adminWrapper');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                loginScreen.style.display = 'none';
                adminWrapper.style.display = 'flex';
                loadAllData();
            } else {
                loginScreen.style.display = 'flex';
                adminWrapper.style.display = 'none';
            }
        });
    }

    loginBtn?.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider)
            .catch(error => {
                console.error('Login error:', error);
                showToast('Login failed: ' + error.message, 'error');
            });
    });

    logoutBtn?.addEventListener('click', () => {
        firebase.auth().signOut();
    });
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.dataset.section;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            contentSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                }
            });
        });
    });
}

function initFileUpload() {
    const fileInput = document.getElementById('profileFileInput');
    const dropZone = document.getElementById('dropZone');
    
    if (!fileInput || !dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect({ target: { files } });
        }
    });
    
    fileInput?.addEventListener('change', handleFileSelect);
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showToast('File size must be less than 2MB', 'error');
        return;
    }
    
    showToast('Uploading image...', 'info');
    
    try {
        const storageRef = storage.ref();
        const fileRef = storageRef.child('profile/' + Date.now() + '_' + file.name);
        const snapshot = await fileRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        updateProfileImage(downloadURL);
        showToast('Image uploaded successfully!', 'success');
    } catch (error) {
        console.error('Upload error:', error);
        const reader = new FileReader();
        reader.onload = (event) => {
            updateProfileImage(event.target.result);
            showToast('Image loaded (local mode)', 'success');
        };
        reader.readAsDataURL(file);
    }
}

function updateProfileImage(url) {
    document.getElementById('profileUrl').value = url;
    const previewImg = document.querySelector('#profilePreview img');
    if (previewImg) {
        previewImg.src = url;
    }
}

function initProfileUrlListener() {
    const urlInput = document.getElementById('profileUrl');
    urlInput?.addEventListener('input', (e) => {
        const url = e.target.value;
        if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:'))) {
            const previewImg = document.querySelector('#profilePreview img');
            if (previewImg) {
                previewImg.src = url;
            }
        }
    });
}

function initAutoSave() {
    const inputs = document.querySelectorAll('.edit-card input, .edit-card textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(autoSaveTimers[input.id]);
            autoSaveTimers[input.id] = setTimeout(() => {
                showToast('Auto-saving...', 'info');
                const section = input.closest('.content-section');
                if (section) {
                    const sectionId = section.id;
                    if (sectionId === 'hero') saveHero();
                    else if (sectionId === 'about') saveAbout();
                    else if (sectionId === 'social') saveSocial();
                }
            }, 3000);
        });
    });
}

async function loadAllData() {
    if (typeof db === 'undefined') {
        showToast('Firebase not configured', 'error');
        return;
    }
    
    try {
        // Load all sections
        const [profileDoc, heroDoc, aboutDoc, eduSnap, skillsSnap, projSnap, socialDoc, msgSnap] = await Promise.all([
            db.collection('site').doc('profile').get(),
            db.collection('site').doc('hero').get(),
            db.collection('site').doc('about').get(),
            db.collection('education').orderBy('order').get(),
            db.collection('skills').orderBy('order').get(),
            db.collection('projects').orderBy('createdAt', 'desc').get(),
            db.collection('site').doc('social').get(),
            db.collection('messages').orderBy('createdAt', 'desc').get()
        ]);

        siteData.profile = profileDoc.exists ? profileDoc.data() : {};
        siteData.hero = heroDoc.exists ? heroDoc.data() : {};
        siteData.about = aboutDoc.exists ? aboutDoc.data() : {};
        siteData.education = eduSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        siteData.skills = skillsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        siteData.projects = projSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        siteData.social = socialDoc.exists ? socialDoc.data() : {};
        siteData.messages = msgSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        populateForms();
        renderSkills();
        renderEducation();
        renderProjects();
        renderMessages();
        updateMessageBadge();
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error loading data', 'error');
    }
}

function populateForms() {
    // Profile
    if (siteData.profile.profilePic) {
        document.querySelector('#profilePreview img').src = siteData.profile.profilePic;
        document.getElementById('profileUrl').value = siteData.profile.profilePic;
    }

    // Hero
    document.getElementById('heroName').value = siteData.hero.name || 'S. Vikinesh';
    document.getElementById('heroGreeting').value = siteData.hero.greeting || 'Hello, I\'m';
    document.getElementById('heroIntro').value = siteData.hero.intro || '';
    document.getElementById('heroRoles').value = siteData.hero.roles ? siteData.hero.roles.join(', ') : 'Web Developer, Frontend Enthusiast, Problem Solver';

    // About
    document.getElementById('aboutBio').value = siteData.about.bio || '';
    document.getElementById('aboutEmail').value = siteData.about.email || '';
    document.getElementById('aboutPhone').value = siteData.about.phone || '';
    document.getElementById('aboutLocation').value = siteData.about.location || '';
    document.getElementById('aboutExp').value = siteData.about.experience || '';
    document.getElementById('aboutProjects').value = siteData.about.projects || '';
    document.getElementById('aboutTech').value = siteData.about.technologies || '';

    // Social
    document.getElementById('socialGithub').value = siteData.social.github || '';
    document.getElementById('socialLinkedin').value = siteData.social.linkedin || '';
    document.getElementById('socialInstagram').value = siteData.social.instagram || '';
    document.getElementById('socialFacebook').value = siteData.social.facebook || '';
    document.getElementById('socialWhatsapp').value = siteData.social.whatsapp || '';
    if (document.getElementById('socialTwitter')) {
        document.getElementById('socialTwitter').value = siteData.social.twitter || '';
    }
    if (document.getElementById('socialYoutube')) {
        document.getElementById('socialYoutube').value = siteData.social.youtube || '';
    }
    if (document.getElementById('socialStackoverflow')) {
        document.getElementById('socialStackoverflow').value = siteData.social.stackoverflow || '';
    }
}

// Save Functions
async function saveProfile() {
    const profilePic = document.getElementById('profileUrl').value;
    
    if (!profilePic) {
        showToast('Please select a profile picture', 'error');
        return;
    }
    
    try {
        await db.collection('site').doc('profile').set({ profilePic }, { merge: true });
        showToast('Profile saved to Firebase!', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function previewProfile() {
    const profilePic = document.getElementById('profileUrl').value;
    if (profilePic) {
        window.open(profilePic, '_blank');
    } else {
        showToast('Please select a profile picture first', 'error');
    }
}

async function saveHero() {
    const heroData = {
        name: document.getElementById('heroName').value,
        greeting: document.getElementById('heroGreeting').value,
        intro: document.getElementById('heroIntro').value,
        roles: document.getElementById('heroRoles').value.split(',').map(r => r.trim()).filter(r => r)
    };
    
    try {
        await db.collection('site').doc('hero').set(heroData, { merge: true });
        showToast('Hero section saved!', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function saveAbout() {
    const aboutData = {
        bio: document.getElementById('aboutBio').value,
        email: document.getElementById('aboutEmail').value,
        phone: document.getElementById('aboutPhone').value,
        location: document.getElementById('aboutLocation').value,
        experience: document.getElementById('aboutExp').value,
        projects: document.getElementById('aboutProjects').value,
        technologies: document.getElementById('aboutTech').value
    };
    
    try {
        await db.collection('site').doc('about').set(aboutData, { merge: true });
        showToast('About section saved!', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function saveSocial() {
    const socialData = {
        github: document.getElementById('socialGithub').value,
        linkedin: document.getElementById('socialLinkedin').value,
        instagram: document.getElementById('socialInstagram').value,
        facebook: document.getElementById('socialFacebook').value,
        whatsapp: document.getElementById('socialWhatsapp').value,
        twitter: document.getElementById('socialTwitter')?.value || '',
        youtube: document.getElementById('socialYoutube')?.value || '',
        stackoverflow: document.getElementById('socialStackoverflow')?.value || ''
    };
    
    try {
        await db.collection('site').doc('social').set(socialData, { merge: true });
        showToast('Social links saved to Firebase!', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function testSocialLinks() {
    const links = [
        { id: 'socialGithub', name: 'GitHub' },
        { id: 'socialLinkedin', name: 'LinkedIn' },
        { id: 'socialInstagram', name: 'Instagram' },
        { id: 'socialFacebook', name: 'Facebook' },
        { id: 'socialWhatsapp', name: 'WhatsApp' },
        { id: 'socialTwitter', name: 'Twitter' },
        { id: 'socialYoutube', name: 'YouTube' },
        { id: 'socialStackoverflow', name: 'Stack Overflow' }
    ];
    
    const validLinks = links.filter(link => {
        const url = document.getElementById(link.id)?.value;
        return url && (url.startsWith('http://') || url.startsWith('https://'));
    });
    
    if (validLinks.length === 0) {
        showToast('No valid links to test. Please add some social links first.', 'error');
        return;
    }
    
    validLinks.forEach(link => {
        const url = document.getElementById(link.id).value;
        window.open(url, '_blank');
    });
    
    showToast(`Opening ${validLinks.length} links in new tabs`, 'success');
}

// Skills
function renderSkills() {
    const list = document.getElementById('skillsList');
    
    if (siteData.skills.length === 0) {
        list.innerHTML = '<p class="empty-text">No skills added yet</p>';
        return;
    }

    list.innerHTML = siteData.skills.map(skill => `
        <div class="simple-item">
            <div class="simple-item-info">
                <div class="simple-item-name">${skill.name}</div>
                <div class="simple-item-percent">${skill.percentage}%</div>
            </div>
            <div class="simple-item-actions">
                <input type="number" class="skill-percent-input" value="${skill.percentage}" 
                    onchange="updateSkillPercent('${skill.id}', this.value)" min="0" max="100">
                <button class="btn-delete" onclick="deleteSkill('${skill.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

async function addSkill() {
    const name = document.getElementById('newSkillName').value.trim();
    const percentage = parseInt(document.getElementById('newSkillPercent').value);
    
    if (!name || !percentage) {
        showToast('Please enter skill name and percentage', 'error');
        return;
    }
    
    try {
        await db.collection('skills').add({
            name,
            percentage,
            order: siteData.skills.length
        });
        
        document.getElementById('newSkillName').value = '';
        document.getElementById('newSkillPercent').value = '';
        
        showToast('Skill added!', 'success');
        await loadAllData();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function updateSkillPercent(id, percent) {
    try {
        await db.collection('skills').doc(id).update({ percentage: parseInt(percent) });
        showToast('Skill updated!', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteSkill(id) {
    if (!confirm('Delete this skill?')) return;
    
    try {
        await db.collection('skills').doc(id).delete();
        showToast('Skill deleted!', 'success');
        await loadAllData();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// Education
function renderEducation() {
    const list = document.getElementById('educationList');
    
    if (siteData.education.length === 0) {
        list.innerHTML = '<p class="empty-text">No education entries yet</p>';
        return;
    }

    list.innerHTML = siteData.education.map(edu => `
        <div class="list-item">
            <div class="list-item-header">
                <div>
                    <div class="list-item-title">${edu.title}</div>
                    <div class="list-item-date">${edu.date}</div>
                </div>
                <div class="list-item-actions">
                    <button class="btn-edit" onclick="editEducation('${edu.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteEducation('${edu.id}')">Delete</button>
                </div>
            </div>
            <p class="list-item-desc">${edu.description}</p>
        </div>
    `).join('');
}

function showAddEducation() {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = 'Add Education';
    document.getElementById('modalBody').innerHTML = `
        <form id="eduForm">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="eduTitle" required placeholder="e.g., HNDIT">
            </div>
            <div class="form-group">
                <label>Date/Year</label>
                <input type="text" id="eduDate" required placeholder="e.g., 2024 - Present">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="eduDesc" rows="3" placeholder="Description..."></textarea>
            </div>
            <button type="submit" class="btn-save">Add Education</button>
        </form>
    `;
    
    document.getElementById('eduForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await db.collection('education').add({
            title: document.getElementById('eduTitle').value,
            date: document.getElementById('eduDate').value,
            description: document.getElementById('eduDesc').value,
            order: siteData.education.length
        });
        modal.classList.remove('active');
        showToast('Education added!', 'success');
        await loadAllData();
    });
    
    modal.classList.add('active');
}

async function editEducation(id) {
    const edu = siteData.education.find(e => e.id === id);
    if (!edu) return;
    
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = 'Edit Education';
    document.getElementById('modalBody').innerHTML = `
        <form id="eduForm">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="eduTitle" required value="${edu.title}">
            </div>
            <div class="form-group">
                <label>Date/Year</label>
                <input type="text" id="eduDate" required value="${edu.date}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="eduDesc" rows="3">${edu.description}</textarea>
            </div>
            <button type="submit" class="btn-save">Save Changes</button>
        </form>
    `;
    
    document.getElementById('eduForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await db.collection('education').doc(id).update({
            title: document.getElementById('eduTitle').value,
            date: document.getElementById('eduDate').value,
            description: document.getElementById('eduDesc').value
        });
        modal.classList.remove('active');
        showToast('Education updated!', 'success');
        await loadAllData();
    });
    
    modal.classList.add('active');
}

async function deleteEducation(id) {
    if (!confirm('Delete this education entry?')) return;
    
    try {
        await db.collection('education').doc(id).delete();
        showToast('Education deleted!', 'success');
        await loadAllData();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// Projects
function renderProjects() {
    const grid = document.getElementById('projectsGrid');
    
    if (siteData.projects.length === 0) {
        grid.innerHTML = '<p class="empty-text">No projects added yet</p>';
        return;
    }

    grid.innerHTML = siteData.projects.map(proj => `
        <div class="item-card">
            <div class="item-image">
                <img src="${proj.imageURL || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop'}" alt="${proj.title}">
            </div>
            <div class="item-content">
                <h3 class="item-title">${proj.title}</h3>
                <p class="item-description">${proj.description}</p>
                <div class="item-meta">
                    ${(proj.technologies || []).map(t => `<span>${t}</span>`).join('')}
                </div>
                <div class="item-actions">
                    <button class="btn-edit" onclick="editProject('${proj.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteProject('${proj.id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function showAddProject() {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = 'Add Project';
    document.getElementById('modalBody').innerHTML = `
        <form id="projForm">
            <div class="form-group">
                <label>Project Title</label>
                <input type="text" id="projTitle" required placeholder="Project name">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="projDesc" rows="3" placeholder="Project description"></textarea>
            </div>
            <div class="form-group">
                <label>Image URL</label>
                <input type="url" id="projImage" placeholder="https://...">
            </div>
            <div class="form-group">
                <label>Technologies (comma separated)</label>
                <input type="text" id="projTech" placeholder="React, Node.js, MongoDB">
            </div>
            <div class="form-group">
                <label>GitHub Link</label>
                <input type="url" id="projGithub" placeholder="https://github.com/...">
            </div>
            <div class="form-group">
                <label>Live Demo Link</label>
                <input type="url" id="projLive" placeholder="https://...">
            </div>
            <button type="submit" class="btn-save">Add Project</button>
        </form>
    `;
    
    document.getElementById('projForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await db.collection('projects').add({
            title: document.getElementById('projTitle').value,
            description: document.getElementById('projDesc').value,
            imageURL: document.getElementById('projImage').value || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop',
            technologies: document.getElementById('projTech').value.split(',').map(t => t.trim()).filter(t => t),
            githubLink: document.getElementById('projGithub').value,
            liveLink: document.getElementById('projLive').value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        modal.classList.remove('active');
        showToast('Project added!', 'success');
        await loadAllData();
    });
    
    modal.classList.add('active');
}

async function editProject(id) {
    const proj = siteData.projects.find(p => p.id === id);
    if (!proj) return;
    
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = 'Edit Project';
    document.getElementById('modalBody').innerHTML = `
        <form id="projForm">
            <div class="form-group">
                <label>Project Title</label>
                <input type="text" id="projTitle" required value="${proj.title}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="projDesc" rows="3">${proj.description}</textarea>
            </div>
            <div class="form-group">
                <label>Image URL</label>
                <input type="url" id="projImage" value="${proj.imageURL || ''}">
            </div>
            <div class="form-group">
                <label>Technologies (comma separated)</label>
                <input type="text" id="projTech" value="${(proj.technologies || []).join(', ')}">
            </div>
            <div class="form-group">
                <label>GitHub Link</label>
                <input type="url" id="projGithub" value="${proj.githubLink || ''}">
            </div>
            <div class="form-group">
                <label>Live Demo Link</label>
                <input type="url" id="projLive" value="${proj.liveLink || ''}">
            </div>
            <button type="submit" class="btn-save">Save Changes</button>
        </form>
    `;
    
    document.getElementById('projForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await db.collection('projects').doc(id).update({
            title: document.getElementById('projTitle').value,
            description: document.getElementById('projDesc').value,
            imageURL: document.getElementById('projImage').value,
            technologies: document.getElementById('projTech').value.split(',').map(t => t.trim()).filter(t => t),
            githubLink: document.getElementById('projGithub').value,
            liveLink: document.getElementById('projLive').value
        });
        modal.classList.remove('active');
        showToast('Project updated!', 'success');
        await loadAllData();
    });
    
    modal.classList.add('active');
}

async function deleteProject(id) {
    if (!confirm('Delete this project?')) return;
    
    try {
        await db.collection('projects').doc(id).delete();
        showToast('Project deleted!', 'success');
        await loadAllData();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// Messages
function renderMessages() {
    const list = document.getElementById('messagesList');
    
    if (siteData.messages.length === 0) {
        list.innerHTML = '<p class="empty-text">No messages yet</p>';
        return;
    }

    list.innerHTML = siteData.messages.map(msg => `
        <div class="message-card">
            <div class="message-header">
                <div>
                    <div class="message-sender">${msg.name}</div>
                    <a href="mailto:${msg.email}" class="message-email">${msg.email}</a>
                </div>
                <div class="message-date">${formatDate(msg.createdAt)}</div>
            </div>
            <p class="message-text">${msg.message}</p>
        </div>
    `).join('');
}

function formatDate(timestamp) {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function updateMessageBadge() {
    const badge = document.getElementById('messageBadge');
    if (badge) {
        badge.textContent = siteData.messages.length;
        badge.style.display = siteData.messages.length > 0 ? 'inline-block' : 'none';
    }
}

// Modal
document.getElementById('modalClose')?.addEventListener('click', () => {
    document.getElementById('modal').classList.remove('active');
});

document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
        document.getElementById('modal').classList.remove('active');
    }
});

// Toast
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.className = `toast ${type}`;
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

// Make functions global
window.saveProfile = saveProfile;
window.previewProfile = previewProfile;
window.saveHero = saveHero;
window.saveAbout = saveAbout;
window.saveSocial = saveSocial;
window.testSocialLinks = testSocialLinks;
window.addSkill = addSkill;
window.updateSkillPercent = updateSkillPercent;
window.deleteSkill = deleteSkill;
window.showAddEducation = showAddEducation;
window.editEducation = editEducation;
window.deleteEducation = deleteEducation;
window.showAddProject = showAddProject;
window.editProject = editProject;
window.deleteProject = deleteProject;
