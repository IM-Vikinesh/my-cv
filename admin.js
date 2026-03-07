document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    initModals();
});

let currentUser = null;
let projects = [];
let skills = [];
let blogs = [];
let messages = [];

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

function initModals() {
    const modal = document.getElementById('modal');
    const modalClose = document.getElementById('modalClose');

    modalClose?.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    document.getElementById('addProjectBtn')?.addEventListener('click', showAddProjectModal);
    document.getElementById('addSkillBtn')?.addEventListener('click', showAddSkillModal);
    document.getElementById('addBlogBtn')?.addEventListener('click', showAddBlogModal);
    document.getElementById('aboutForm')?.addEventListener('submit', saveAbout);
}

async function loadAllData() {
    await Promise.all([
        loadProjects(),
        loadSkills(),
        loadBlogs(),
        loadMessages(),
        loadAbout()
    ]);
    updateStats();
}

async function loadProjects() {
    const grid = document.getElementById('projectsGrid');
    
    if (typeof db === 'undefined') {
        grid.innerHTML = '<div class="empty-state"><p>Firebase not configured. Showing demo data.</p></div>';
        projects = getDemoProjects();
        renderProjects();
        return;
    }

    try {
        const snapshot = await db.collection('projects').orderBy('createdAt', 'desc').get();
        projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProjects();
    } catch (error) {
        console.error('Error loading projects:', error);
        projects = getDemoProjects();
        renderProjects();
    }
}

function renderProjects() {
    const grid = document.getElementById('projectsGrid');
    
    if (projects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
                <h3>No Projects Yet</h3>
                <p>Add your first project to get started</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = projects.map(project => `
        <div class="item-card">
            <div class="item-image">
                <img src="${project.imageURL || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop'}" alt="${project.title}">
            </div>
            <div class="item-content">
                <h3 class="item-title">${project.title}</h3>
                <p class="item-description">${project.description}</p>
                <div class="item-meta">
                    ${(project.technologies || []).map(tech => `<span>${tech}</span>`).join('')}
                </div>
                <div class="item-actions">
                    <button class="btn-edit" onclick="editProject('${project.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteProject('${project.id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function getDemoProjects() {
    return [
        {
            id: '1',
            title: 'E-Commerce Platform',
            description: 'A full-featured online shopping platform with cart functionality.',
            imageURL: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop',
            technologies: ['React', 'Node.js', 'MongoDB'],
            githubLink: '#',
            liveLink: '#'
        }
    ];
}

function showAddProjectModal() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = 'Add Project';
    modalBody.innerHTML = `
        <form id="projectForm">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="projectTitle" required placeholder="Project title">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="projectDescription" required placeholder="Project description" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Image URL</label>
                <input type="url" id="projectImage" placeholder="https://example.com/image.jpg">
            </div>
            <div class="form-group">
                <label>Technologies (comma separated)</label>
                <input type="text" id="projectTech" placeholder="React, Node.js, MongoDB">
            </div>
            <div class="form-group">
                <label>GitHub Link</label>
                <input type="url" id="projectGithub" placeholder="https://github.com/...">
            </div>
            <div class="form-group">
                <label>Live Demo Link</label>
                <input type="url" id="projectLive" placeholder="https://...">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn-submit">Add Project</button>
            </div>
        </form>
    `;

    document.getElementById('projectForm').addEventListener('submit', saveProject);
    modal.classList.add('active');
}

async function saveProject(e) {
    e.preventDefault();

    const projectData = {
        title: document.getElementById('projectTitle').value,
        description: document.getElementById('projectDescription').value,
        imageURL: document.getElementById('projectImage').value || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop',
        technologies: document.getElementById('projectTech').value.split(',').map(t => t.trim()).filter(t => t),
        githubLink: document.getElementById('projectGithub').value,
        liveLink: document.getElementById('projectLive').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('projects').add(projectData);
        showToast('Project added successfully!', 'success');
        closeModal();
        await loadProjects();
        updateStats();
    } catch (error) {
        console.error('Error adding project:', error);
        showToast('Failed to add project', 'error');
    }
}

async function editProject(id) {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = 'Edit Project';
    modalBody.innerHTML = `
        <form id="editProjectForm">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="editProjectTitle" required value="${project.title}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="editProjectDescription" required rows="3">${project.description}</textarea>
            </div>
            <div class="form-group">
                <label>Image URL</label>
                <input type="url" id="editProjectImage" value="${project.imageURL || ''}">
            </div>
            <div class="form-group">
                <label>Technologies (comma separated)</label>
                <input type="text" id="editProjectTech" value="${(project.technologies || []).join(', ')}">
            </div>
            <div class="form-group">
                <label>GitHub Link</label>
                <input type="url" id="editProjectGithub" value="${project.githubLink || ''}">
            </div>
            <div class="form-group">
                <label>Live Demo Link</label>
                <input type="url" id="editProjectLive" value="${project.liveLink || ''}">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn-submit">Save Changes</button>
            </div>
        </form>
    `;

    document.getElementById('editProjectForm').addEventListener('submit', (e) => updateProject(e, id));
    modal.classList.add('active');
}

async function updateProject(e, id) {
    e.preventDefault();

    const projectData = {
        title: document.getElementById('editProjectTitle').value,
        description: document.getElementById('editProjectDescription').value,
        imageURL: document.getElementById('editProjectImage').value,
        technologies: document.getElementById('editProjectTech').value.split(',').map(t => t.trim()).filter(t => t),
        githubLink: document.getElementById('editProjectGithub').value,
        liveLink: document.getElementById('editProjectLive').value
    };

    try {
        await db.collection('projects').doc(id).update(projectData);
        showToast('Project updated successfully!', 'success');
        closeModal();
        await loadProjects();
    } catch (error) {
        console.error('Error updating project:', error);
        showToast('Failed to update project', 'error');
    }
}

async function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
        await db.collection('projects').doc(id).delete();
        showToast('Project deleted successfully!', 'success');
        await loadProjects();
        updateStats();
    } catch (error) {
        console.error('Error deleting project:', error);
        showToast('Failed to delete project', 'error');
    }
}

async function loadSkills() {
    const list = document.getElementById('skillsList');
    
    if (typeof db === 'undefined') {
        skills = getDemoSkills();
        renderSkills();
        return;
    }

    try {
        const snapshot = await db.collection('skills').orderBy('order', 'asc').get();
        skills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSkills();
    } catch (error) {
        console.error('Error loading skills:', error);
        skills = getDemoSkills();
        renderSkills();
    }
}

function renderSkills() {
    const list = document.getElementById('skillsList');
    
    if (skills.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                <h3>No Skills Yet</h3>
                <p>Add your skills to showcase your abilities</p>
            </div>
        `;
        return;
    }

    list.innerHTML = skills.map(skill => `
        <div class="skill-item">
            <div class="skill-info">
                <div class="skill-name">${skill.name}</div>
                <div class="skill-bar">
                    <div class="skill-progress" style="width: ${skill.percentage}%"></div>
                </div>
            </div>
            <span class="skill-percentage">${skill.percentage}%</span>
            <div class="skill-actions">
                <button class="btn-edit" onclick="editSkill('${skill.id}')">Edit</button>
                <button class="btn-delete" onclick="deleteSkill('${skill.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function getDemoSkills() {
    return [
        { id: '1', name: 'HTML5', percentage: 95 },
        { id: '2', name: 'CSS3', percentage: 90 },
        { id: '3', name: 'JavaScript', percentage: 85 }
    ];
}

function showAddSkillModal() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = 'Add Skill';
    modalBody.innerHTML = `
        <form id="skillForm">
            <div class="form-group">
                <label>Skill Name</label>
                <input type="text" id="skillName" required placeholder="e.g., JavaScript">
            </div>
            <div class="form-group">
                <label>Percentage (0-100)</label>
                <input type="number" id="skillPercentage" required min="0" max="100" placeholder="85">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn-submit">Add Skill</button>
            </div>
        </form>
    `;

    document.getElementById('skillForm').addEventListener('submit', saveSkill);
    modal.classList.add('active');
}

async function saveSkill(e) {
    e.preventDefault();

    const skillData = {
        name: document.getElementById('skillName').value,
        percentage: parseInt(document.getElementById('skillPercentage').value),
        order: skills.length
    };

    try {
        await db.collection('skills').add(skillData);
        showToast('Skill added successfully!', 'success');
        closeModal();
        await loadSkills();
        updateStats();
    } catch (error) {
        console.error('Error adding skill:', error);
        showToast('Failed to add skill', 'error');
    }
}

async function editSkill(id) {
    const skill = skills.find(s => s.id === id);
    if (!skill) return;

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = 'Edit Skill';
    modalBody.innerHTML = `
        <form id="editSkillForm">
            <div class="form-group">
                <label>Skill Name</label>
                <input type="text" id="editSkillName" required value="${skill.name}">
            </div>
            <div class="form-group">
                <label>Percentage (0-100)</label>
                <input type="number" id="editSkillPercentage" required min="0" max="100" value="${skill.percentage}">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn-submit">Save Changes</button>
            </div>
        </form>
    `;

    document.getElementById('editSkillForm').addEventListener('submit', (e) => updateSkill(e, id));
    modal.classList.add('active');
}

async function updateSkill(e, id) {
    e.preventDefault();

    const skillData = {
        name: document.getElementById('editSkillName').value,
        percentage: parseInt(document.getElementById('editSkillPercentage').value)
    };

    try {
        await db.collection('skills').doc(id).update(skillData);
        showToast('Skill updated successfully!', 'success');
        closeModal();
        await loadSkills();
    } catch (error) {
        console.error('Error updating skill:', error);
        showToast('Failed to update skill', 'error');
    }
}

async function deleteSkill(id) {
    if (!confirm('Are you sure you want to delete this skill?')) return;

    try {
        await db.collection('skills').doc(id).delete();
        showToast('Skill deleted successfully!', 'success');
        await loadSkills();
        updateStats();
    } catch (error) {
        console.error('Error deleting skill:', error);
        showToast('Failed to delete skill', 'error');
    }
}

async function loadBlogs() {
    const grid = document.getElementById('blogGrid');
    
    if (typeof db === 'undefined') {
        blogs = getDemoBlogs();
        renderBlogs();
        return;
    }

    try {
        const snapshot = await db.collection('blogs').orderBy('publishedAt', 'desc').get();
        blogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderBlogs();
    } catch (error) {
        console.error('Error loading blogs:', error);
        blogs = getDemoBlogs();
        renderBlogs();
    }
}

function renderBlogs() {
    const grid = document.getElementById('blogGrid');
    
    if (blogs.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <h3>No Blog Posts Yet</h3>
                <p>Write your first blog post</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = blogs.map(blog => `
        <div class="item-card">
            <div class="item-image">
                <img src="${blog.thumbnail || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=350&fit=crop'}" alt="${blog.title}">
            </div>
            <div class="item-content">
                <h3 class="item-title">${blog.title}</h3>
                <p class="item-description">${blog.preview}</p>
                <div class="item-actions">
                    <button class="btn-edit" onclick="editBlog('${blog.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteBlog('${blog.id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function getDemoBlogs() {
    return [
        {
            id: '1',
            title: 'Getting Started with Modern Web Development',
            preview: 'Learn the fundamentals of modern web development.',
            thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=350&fit=crop'
        }
    ];
}

function showAddBlogModal() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = 'Add Blog Post';
    modalBody.innerHTML = `
        <form id="blogForm">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="blogTitle" required placeholder="Blog post title">
            </div>
            <div class="form-group">
                <label>Preview Text</label>
                <textarea id="blogPreview" required placeholder="Short preview text" rows="2"></textarea>
            </div>
            <div class="form-group">
                <label>Thumbnail URL</label>
                <input type="url" id="blogThumbnail" placeholder="https://example.com/image.jpg">
            </div>
            <div class="form-group">
                <label>Content</label>
                <textarea id="blogContent" required placeholder="Full blog content" rows="6"></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn-submit">Publish</button>
            </div>
        </form>
    `;

    document.getElementById('blogForm').addEventListener('submit', saveBlog);
    modal.classList.add('active');
}

async function saveBlog(e) {
    e.preventDefault();

    const blogData = {
        title: document.getElementById('blogTitle').value,
        preview: document.getElementById('blogPreview').value,
        thumbnail: document.getElementById('blogThumbnail').value || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=350&fit=crop',
        content: document.getElementById('blogContent').value,
        publishedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('blogs').add(blogData);
        showToast('Blog post published!', 'success');
        closeModal();
        await loadBlogs();
        updateStats();
    } catch (error) {
        console.error('Error adding blog:', error);
        showToast('Failed to publish blog post', 'error');
    }
}

async function editBlog(id) {
    const blog = blogs.find(b => b.id === id);
    if (!blog) return;

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = 'Edit Blog Post';
    modalBody.innerHTML = `
        <form id="editBlogForm">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="editBlogTitle" required value="${blog.title}">
            </div>
            <div class="form-group">
                <label>Preview Text</label>
                <textarea id="editBlogPreview" required rows="2">${blog.preview}</textarea>
            </div>
            <div class="form-group">
                <label>Thumbnail URL</label>
                <input type="url" id="editBlogThumbnail" value="${blog.thumbnail || ''}">
            </div>
            <div class="form-group">
                <label>Content</label>
                <textarea id="editBlogContent" required rows="6">${blog.content || ''}</textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn-submit">Save Changes</button>
            </div>
        </form>
    `;

    document.getElementById('editBlogForm').addEventListener('submit', (e) => updateBlog(e, id));
    modal.classList.add('active');
}

async function updateBlog(e, id) {
    e.preventDefault();

    const blogData = {
        title: document.getElementById('editBlogTitle').value,
        preview: document.getElementById('editBlogPreview').value,
        thumbnail: document.getElementById('editBlogThumbnail').value,
        content: document.getElementById('editBlogContent').value
    };

    try {
        await db.collection('blogs').doc(id).update(blogData);
        showToast('Blog post updated!', 'success');
        closeModal();
        await loadBlogs();
    } catch (error) {
        console.error('Error updating blog:', error);
        showToast('Failed to update blog post', 'error');
    }
}

async function deleteBlog(id) {
    if (!confirm('Are you sure you want to delete this blog post?')) return;

    try {
        await db.collection('blogs').doc(id).delete();
        showToast('Blog post deleted!', 'success');
        await loadBlogs();
        updateStats();
    } catch (error) {
        console.error('Error deleting blog:', error);
        showToast('Failed to delete blog post', 'error');
    }
}

async function loadMessages() {
    const list = document.getElementById('messagesList');
    
    if (typeof db === 'undefined') {
        messages = [];
        renderMessages();
        return;
    }

    try {
        const snapshot = await db.collection('messages').orderBy('createdAt', 'desc').get();
        messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMessages();
        updateMessageBadge();
    } catch (error) {
        console.error('Error loading messages:', error);
        messages = [];
        renderMessages();
    }
}

function renderMessages() {
    const list = document.getElementById('messagesList');
    
    if (messages.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <h3>No Messages Yet</h3>
                <p>Messages from the contact form will appear here</p>
            </div>
        `;
        return;
    }

    list.innerHTML = messages.map(msg => `
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
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function updateMessageBadge() {
    const badge = document.getElementById('messageBadge');
    if (badge) {
        badge.textContent = messages.length;
        badge.style.display = messages.length > 0 ? 'inline-block' : 'none';
    }
}

async function loadAbout() {
    if (typeof db === 'undefined') return;

    try {
        const doc = await db.collection('about').doc('info').get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('aboutBio').value = data.bio || '';
            document.getElementById('aboutEmail').value = data.email || '';
            document.getElementById('aboutPhone').value = data.phone || '';
            document.getElementById('aboutLocation').value = data.location || '';
        }
    } catch (error) {
        console.error('Error loading about:', error);
    }
}

async function saveAbout(e) {
    e.preventDefault();

    const aboutData = {
        bio: document.getElementById('aboutBio').value,
        email: document.getElementById('aboutEmail').value,
        phone: document.getElementById('aboutPhone').value,
        location: document.getElementById('aboutLocation').value
    };

    try {
        await db.collection('about').doc('info').set(aboutData);
        showToast('About section updated!', 'success');
    } catch (error) {
        console.error('Error saving about:', error);
        showToast('Failed to save changes', 'error');
    }
}

function updateStats() {
    document.getElementById('totalProjects').textContent = projects.length;
    document.getElementById('totalSkills').textContent = skills.length;
    document.getElementById('totalBlogs').textContent = blogs.length;
    document.getElementById('totalMessages').textContent = messages.length;
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
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

window.editProject = editProject;
window.deleteProject = deleteProject;
window.editSkill = editSkill;
window.deleteSkill = deleteSkill;
window.editBlog = editBlog;
window.deleteBlog = deleteBlog;
window.closeModal = closeModal;
