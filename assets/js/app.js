import { initFirebase } from './firebase-config.js';
import { setupAuth, login as firebaseLogin, logout as firebaseLogout } from './auth.js';
import { listPosts, loadPost, savePost, deletePost, loadImages, saveImage } from './firestore.js';

// --- INITIAL STATE ---
const DEFAULT_MD = `# New Medical Topic\n\nWrite your medical content here...`;

let state = {
  view: 'public', // 'public' or 'dashboard'
  page: 'home',   // 'home' or 'post'
  loggedIn: false,
  currentUser: null,
  loginError: '',
  loginEmail: '',
  loginPass: '',
  posts: [],
  activePostId: null,
  activePost: null,
  images: [],
  editorTab: 'write',
  editorContent: '',
  uploadStatus: '',
};

let db, auth;

// --- INITIALIZATION ---
export async function startApp() {
  const firebase = await initFirebase();
  db = firebase.db;
  auth = firebase.auth;

  setupAuth(auth, async (user) => {
    state.loggedIn = !!user;
    state.currentUser = user;
    if (user) {
      state.posts = await listPosts(db);
    }
    render();
  });

  // Initial load
  state.posts = await listPosts(db);
  
  // Simple Hash Routing
  window.onhashchange = handleRouting;
  handleRouting();
}

async function handleRouting() {
  const hash = window.location.hash;
  if (hash.startsWith('#post/')) {
    const id = hash.split('/')[1];
    state.activePostId = id;
    state.activePost = await loadPost(db, id);
    state.page = 'post';
  } else {
    state.page = 'home';
    state.activePostId = null;
    state.activePost = null;
  }
  render();
}

async function refreshData() {
  state.posts = await listPosts(db);
  state.images = await loadImages(db);
  render();
}

// --- RENDER LOGIC ---
function render() {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = buildHTML();
    attachEvents();
  }
}

function buildHTML() {
  return `
    ${buildNav()}
    ${state.view === 'public' ? buildPublicView() : (state.loggedIn ? buildDashboard() : buildLogin())}
  `;
}

function buildNav() {
  return `<nav class="nav">
    <div class="nav-brand" onclick="window.location.hash=''" style="cursor:pointer">
      <span>MD</span>MedLearn
    </div>
    <div class="nav-actions">
      ${state.view === 'public'
        ? `<button class="btn btn-ghost btn-sm" id="btn-dashboard">Dashboard</button>`
        : `<button class="btn btn-ghost btn-sm" id="btn-public">← View Page</button>
           ${state.loggedIn ? `<button class="btn btn-danger btn-sm" id="btn-logout">Logout</button>` : ''}`
      }
    </div>
  </nav>`;
}

function buildPublicView() {
  if (state.page === 'post' && state.activePost) {
    return buildPostPage(state.activePost);
  }
  return buildHomePage();
}

function buildHomePage() {
  const postCards = state.posts.map(post => `
    <div class="content-card" onclick="window.location.hash='post/${post.id}'" style="cursor:pointer; margin-bottom:1rem">
      <div class="card-accent" style="background:var(--blue)"></div>
      <div class="card-body">
        <h2 style="font-family:var(--font-head); font-weight:900; color:var(--blue); margin-bottom:.5rem">${getTitle(post.markdown)}</h2>
        <p style="font-size:.9rem; color:var(--text-muted)">${post.markdown.substring(0, 150).replace(/[#*`>]/g, '')}...</p>
        <div style="margin-top:1rem; font-size:.75rem; color:var(--text-muted)">Updated: ${new Date(post.updatedAt).toLocaleDateString()}</div>
      </div>
    </div>
  `).join('');

  return `<div class="page">
    <div class="hero">
      <div class="hero-tag">Medical Education</div>
      <h1>Clinical Sciences Library</h1>
      <div class="hero-sub">Comprehensive guides for emergency and clinical medicine.</div>
    </div>
    <div class="section-title">Latest Lessons</div>
    <div class="content-grid">
      ${postCards || '<p style="text-align:center; padding:2rem; color:var(--text-muted)">No posts found. Add some in the dashboard!</p>'}
    </div>
  </div>`;
}

function buildPostPage(post) {
  const rendered = renderMarkdownWithImages(post.markdown);
  return `<div class="page">
    <div class="hero">
      <div class="hero-tag">Clinical Sciences</div>
      <h1>${getTitle(post.markdown)}</h1>
      <div class="hero-sub">Emergency Medicine · Clinical Rotations</div>
      <div class="hero-meta">
        <span>📖 Updated: ${new Date(post.updatedAt).toLocaleDateString()}</span>
        <span>✍️ Editor: ${post.lastEditor || 'Admin'}</span>
      </div>
    </div>
    <div class="content-card">
      <div class="card-accent" style="background:linear-gradient(90deg,var(--blue),var(--teal))"></div>
      <div class="card-body">
        <div class="md-body">${rendered}</div>
      </div>
    </div>
    <div style="margin-top:2rem; text-align:center">
      <button class="btn btn-ghost" onclick="window.location.hash=''">← Back to Library</button>
    </div>
  </div>`;
}

function getTitle(md) {
  const m = md.match(/^#\s+(.+)/m);
  return m ? m[1] : 'Untitled Topic';
}

function renderMarkdownWithImages(md) {
  const parts = md.split(/(\[\[IMAGE:[^\]]+\]\])/g);
  let html = '';
  for (const part of parts) {
    const imgMatch = part.match(/\[\[IMAGE:([^\]]+)\]\]/);
    if (imgMatch) {
      const imgId = imgMatch[1].trim();
      const img = state.images.find(i => i.id === imgId || i.name.replace(/\.[^.]+$/,'').toLowerCase().replace(/\s+/g,'-') === imgId.toLowerCase());
      if (img) {
        html += `<div class="content-img-wrap">
          <img src="${img.data}" alt="${img.name}" loading="lazy"/>
          <div class="img-caption">${img.name}</div>
        </div>`;
      } else {
        html += `<div class="content-img-wrap" style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.85rem">
          <div style="font-size:2rem;margin-bottom:.4rem">🖼️</div>
          Image placeholder: <code>${imgId}</code>
        </div>`;
      }
    } else {
      html += window.marked.parse(part);
    }
  }
  return html;
}

function buildLogin() {
  return `<div class="login-wrap">
    <div class="login-card">
      <h2>Dashboard Access</h2>
      <p>Enter your admin credentials to access the content editor.</p>
      ${state.loginError ? `<div class="error-msg">${state.loginError}</div>` : ''}
      <div class="field">
        <label>Email</label>
        <input type="email" id="login-email" value="${state.loginEmail}" placeholder="Admin email…"/>
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" id="login-pass" value="${state.loginPass}" placeholder="Enter password…"/>
      </div>
      <button class="btn btn-primary" style="width:100%" id="btn-do-login">Sign In →</button>
    </div>
  </div>`;
}

function buildDashboard() {
  const postList = state.posts.map(post => `
    <div class="post-item ${state.activePostId === post.id ? 'active' : ''}" 
         style="padding:.75rem; border-radius:var(--radius-sm); border:1.5px solid ${state.activePostId === post.id ? 'var(--blue)' : 'var(--border)'}; background:${state.activePostId === post.id ? 'var(--blue-light)' : '#fff'}; cursor:pointer; margin-bottom:.5rem; font-size:.85rem; display:flex; justify-content:space-between; align-items:center"
         onclick="selectPost('${post.id}')">
      <div style="font-weight:700; color:${state.activePostId === post.id ? 'var(--blue)' : 'var(--text)'}">${getTitle(post.markdown)}</div>
      <button class="btn btn-sm" style="background:transparent; color:var(--red); padding:2px 5px" onclick="event.stopPropagation(); deletePostPrompt('${post.id}')">✕</button>
    </div>
  `).join('');

  const preview = renderMarkdownWithImages(state.editorContent);
  const imgBtns = state.images.map(img => {
    const id = img.name.replace(/\.[^.]+$/,'').toLowerCase().replace(/\s+/g,'-');
    return `<div class="img-thumb" data-img-id="${id}" title="Click to insert: ${img.name}">
      <img src="${img.data}" alt="${img.name}"/>
      <div class="img-thumb-name">${img.name}</div>
    </div>`;
  }).join('');

  return `<div class="dash-layout">
    <aside class="dash-sidebar">
      <button class="btn btn-primary" style="width:100%; margin-bottom:1rem" onclick="createNewPost()">+ Create New Post</button>
      
      <div class="sidebar-card">
        <h3>Manage Topics</h3>
        <div style="max-height:300px; overflow-y:auto; padding-right:.25rem">
          ${postList || '<p style="font-size:.75rem; color:var(--text-muted); text-align:center">No topics found</p>'}
        </div>
      </div>

      <div class="sidebar-card">
        <h3>Image Library</h3>
        <label class="upload-zone">
          <input type="file" id="img-upload" accept="image/*" multiple/>
          <div style="font-size:1.4rem;margin-bottom:.4rem">📁</div>
          Click to upload images
        </label>
        ${state.uploadStatus ? `<div style="font-size:.8rem;color:var(--teal);margin-top:.5rem;text-align:center">${state.uploadStatus}</div>` : ''}
        ${state.images.length > 0 ? `<div class="img-library">${imgBtns}</div>` : ''}
      </div>
    </aside>

    <main class="dash-main">
      ${state.activePostId ? `
        <div class="editor-card">
          <div class="tab-row">
            <button class="tab-btn ${state.editorTab==='write'?'active':''}" id="tab-write">✏️ Edit</button>
            <button class="tab-btn ${state.editorTab==='preview'?'active':''}" id="tab-preview">👁 Preview</button>
          </div>
          ${state.editorTab==='write' ? `
            <div class="editor-toolbar">
              <button class="tb-btn" id="tb-bold">B</button>
              <button class="tb-btn" id="tb-italic">I</button>
              <button class="tb-btn" id="tb-h2">H2</button>
              <button class="tb-btn" id="tb-h3">H3</button>
              <button class="tb-btn" id="tb-list">List</button>
              <button class="tb-btn" id="tb-quote">Quote</button>
              <button class="tb-btn" id="tb-hr">HR</button>
              <button class="tb-btn" id="tb-table">Tbl</button>
              <span style="color:var(--border); padding:0 4px">|</span>
              <span style="font-size:.78rem;color:var(--text-muted)">Editing: <strong>${state.activePostId}</strong></span>
            </div>
            <textarea class="editor-area" id="md-editor">${escHtml(state.editorContent)}</textarea>
          ` : `
            <div class="tab-content">
              <div class="md-body">${preview}</div>
            </div>
          `}
        </div>
        <div style="display:flex;gap:.75rem;justify-content:flex-end">
          <button class="btn btn-ghost" id="btn-discard">Discard</button>
          <button class="btn btn-primary" id="btn-publish">✓ Publish Changes</button>
        </div>
      ` : `
        <div style="background:#fff; border-radius:var(--radius); border:1.5px solid var(--border); padding:4rem; text-align:center; color:var(--text-muted)">
          <div style="font-size:3rem; margin-bottom:1rem">📄</div>
          <h2>Select a topic to edit</h2>
          <p>Or create a new medical guide from the sidebar.</p>
        </div>
      `}
    </main>
  </div>`;
}

function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

// --- GLOBAL ACTIONS (Exposed to window for onclick) ---
window.selectPost = async (id) => {
  state.activePostId = id;
  const post = await loadPost(db, id);
  state.activePost = post;
  state.editorContent = post.markdown;
  state.editorTab = 'write';
  render();
};

window.createNewPost = async () => {
  const title = prompt('Enter a slug/ID for the new post (e.g., "asthma-guide"):');
  if (!title) return;
  const id = title.toLowerCase().replace(/\s+/g, '-');
  await savePost(db, id, { markdown: `# ${title}\n\nStart writing...` }, state.currentUser.email);
  state.posts = await listPosts(db);
  window.selectPost(id);
};

window.deletePostPrompt = async (id) => {
  if (confirm(`Are you sure you want to delete "${id}"?`)) {
    await deletePost(db, id);
    if (state.activePostId === id) {
      state.activePostId = null;
      state.activePost = null;
      state.editorContent = '';
    }
    state.posts = await listPosts(db);
    render();
  }
};

// --- EVENT ATTACHMENT ---
function attachEvents() {
  const $ = (id) => document.getElementById(id);

  if ($('btn-dashboard')) $('btn-dashboard').onclick = () => { state.view = 'dashboard'; render(); };
  if ($('btn-public')) $('btn-public').onclick = () => { state.view = 'public'; render(); };
  if ($('btn-logout')) $('btn-logout').onclick = async () => { await firebaseLogout(auth); state.view = 'public'; };

  if ($('btn-do-login')) $('btn-do-login').onclick = async () => {
    const email = $('login-email').value;
    const pass = $('login-pass').value;
    try {
      await firebaseLogin(auth, email, pass);
      state.loginError = '';
      state.posts = await listPosts(db);
      state.images = await loadImages(db);
    } catch (e) {
      state.loginError = 'Login failed: ' + e.message;
      render();
    }
  };

  if ($('tab-write')) $('tab-write').onclick = () => { setTab('write'); };
  if ($('tab-preview')) $('tab-preview').onclick = () => { setTab('preview'); };

  const ta = $('md-editor');
  if (ta) {
    ta.oninput = () => { state.editorContent = ta.value; };
    ta.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); publish(); }
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = s + 2;
        state.editorContent = ta.value;
      }
    };
  }

  if ($('tb-bold')) $('tb-bold').onclick = () => wrapText('**', '**');
  if ($('tb-italic')) $('tb-italic').onclick = () => wrapText('*', '*');
  if ($('tb-h2')) $('tb-h2').onclick = () => insertLine('## ');
  if ($('tb-h3')) $('tb-h3').onclick = () => insertLine('### ');
  if ($('tb-list')) $('tb-list').onclick = () => insertLine('- ');
  if ($('tb-quote')) $('tb-quote').onclick = () => insertLine('> ');
  if ($('tb-hr')) $('tb-hr').onclick = () => insertLine('---');
  if ($('tb-table')) $('tb-table').onclick = () => insertTableSnippet();

  const imgUpload = $('img-upload');
  if (imgUpload) imgUpload.onchange = (e) => handleImageUpload(e);

  document.querySelectorAll('.img-thumb').forEach(el => {
    el.onclick = () => insertImageTag(el.dataset.imgId);
  });

  if ($('btn-publish')) $('btn-publish').onclick = () => publish();
  if ($('btn-discard')) $('btn-discard').onclick = () => { state.editorContent = state.content; render(); };
}

function setTab(t) {
  const ta = document.getElementById('md-editor');
  if (ta) state.editorContent = ta.value;
  state.editorTab = t;
  render();
}

function wrapText(before, after) {
  const ta = document.getElementById('md-editor'); if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.substring(s, e) || 'text';
  ta.value = ta.value.substring(0,s)+before+sel+after+ta.value.substring(e);
  ta.selectionStart = s+before.length;
  ta.selectionEnd = s+before.length+sel.length;
  state.editorContent = ta.value;
  ta.focus();
}

function insertLine(prefix) {
  const ta = document.getElementById('md-editor'); if (!ta) return;
  const pos = ta.selectionStart;
  const insert = '\n'+prefix;
  ta.value = ta.value.substring(0,pos)+insert+ta.value.substring(pos);
  ta.selectionStart = ta.selectionEnd = pos+insert.length;
  state.editorContent = ta.value;
  ta.focus();
}

function insertTableSnippet() {
  const ta = document.getElementById('md-editor'); if (!ta) return;
  const tbl = '\n\n| Column 1 | Column 2 | Column 3 |\n|---------|---------|----------|\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |\n\n';
  const pos = ta.selectionStart;
  ta.value = ta.value.substring(0,pos)+tbl+ta.value.substring(pos);
  ta.selectionStart = ta.selectionEnd = pos+tbl.length;
  state.editorContent = ta.value;
  ta.focus();
}

function insertImageTag(id) {
  const ta = document.getElementById('md-editor'); if (!ta) return;
  const tag = `\n\n[[IMAGE:${id}]]\n\n`;
  const pos = ta.selectionStart;
  ta.value = ta.value.substring(0,pos)+tag+ta.value.substring(pos);
  ta.selectionStart = ta.selectionEnd = pos+tag.length;
  state.editorContent = ta.value;
  ta.focus();
}

async function publish() {
  const ta = document.getElementById('md-editor');
  if (ta) state.editorContent = ta.value;
  await savePost(db, state.activePostId, { markdown: state.editorContent }, state.currentUser?.email);
  state.posts = await listPosts(db);
  const btn = document.getElementById('btn-publish');
  if (btn) { btn.textContent = '✓ Published!'; btn.style.background='var(--teal)'; setTimeout(()=>render(),1200); }
}

async function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  state.uploadStatus = 'Uploading…';
  render();
  for (const file of files) {
    await new Promise(res => {
      const reader = new FileReader();
      reader.onload = async e => {
        const entry = { name: file.name, data: e.target.result };
        const saved = await saveImage(db, entry);
        state.images.unshift(saved);
        res();
      };
      reader.readAsDataURL(file);
    });
  }
  state.uploadStatus = `✓ ${files.length} image(s) uploaded`;
  setTimeout(() => { state.uploadStatus=''; render(); }, 2000);
}
