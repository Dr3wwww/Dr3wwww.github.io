// The admin panel: sign in, then add, edit, delete and reorder everything the public page shows.
// Writes are allowed by row-level security only for users listed in public.admins (supabase/setup.sql).
import { configured, supabase, BUCKET } from './db.js';
import { PLATFORMS, PLATFORM_ORDER, iconSvg } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  up: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 12V4M4.5 7.5 8 4l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 4v8M4.5 8.5 8 12l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  left: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  img: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m3 16 5-5 4 4 3-3 6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
};

/* ------------------------------------------------------------------ small helpers */
let toastT = 0;
function toast(msg, error = false) {
  const t = $('[data-toast]');
  t.textContent = msg;
  t.classList.toggle('is-error', error);
  t.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-on'), error ? 6000 : 2600);
}
function fail(e, what = 'That did not work') {
  console.error(e);
  const msg = e?.message || String(e);
  toast(`${what}: ${/row-level security|permission|not authorized/i.test(msg) ? 'this account is not allowed to write (is it in public.admins?)' : msg}`, true);
}
const show = view => $$('[data-view]').forEach(v => { v.hidden = v.dataset.view !== view; });
const linesToTags = s => String(s || '').split(/[,\n]/).map(t => t.trim()).filter(Boolean);

async function upload(file, folder) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image`);
  if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is over 5 MB`);
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
async function removeFiles(paths) {
  paths = paths.filter(Boolean);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.warn('Could not delete old images', error);
}

/* ------------------------------------------------------------------ theme */
$('[data-theme-toggle]').addEventListener('click', () => {
  const r = document.documentElement;
  r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', r.dataset.theme); } catch {}
});

/* ------------------------------------------------------------------ auth */
async function boot() {
  if (!configured) { show('setup'); return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await enter(); else show('login');
  supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') { show('login'); $('[data-signout]').hidden = true; } });
}

$('[data-login]').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.currentTarget, status = $('[data-login-status]'), btn = $('button', f);
  status.classList.remove('is-error');
  const email = f.email.value.trim(), password = f.password.value;
  if (!email || !password) { status.textContent = 'Write your email and password.'; status.classList.add('is-error'); return; }
  btn.disabled = true; status.textContent = 'Signing in…';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  if (error) { status.textContent = 'Wrong email or password.'; status.classList.add('is-error'); return; }
  status.textContent = '';
  f.password.value = '';
  await enter();
});

$('[data-signout]').addEventListener('click', async () => { await supabase.auth.signOut(); });

async function enter() {
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error || !isAdmin) {
    await supabase.auth.signOut();
    show('login');
    const s = $('[data-login-status]');
    s.textContent = error ? 'Could not check access. Did you run supabase/setup.sql?' : 'This account is not the site admin.';
    s.classList.add('is-error');
    return;
  }
  $('[data-signout]').hidden = false;
  show('app');
  openTab(sessionStorage.getItem('admin-tab') || 'profile');
}

/* ------------------------------------------------------------------ tabs */
$$('[data-tab]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
let current = '';
function openTab(tab) {
  if (!TABS[tab]) tab = 'profile';
  current = tab;
  try { sessionStorage.setItem('admin-tab', tab); } catch {}
  $$('[data-tab]').forEach(b => b.setAttribute('aria-current', String(b.dataset.tab === tab)));
  TABS[tab]().catch(e => fail(e, 'Could not load'));
}
const content = () => $('[data-content]');

/* ------------------------------------------------------------------ data access */
async function rows(table, filter) {
  let q = supabase.from(table).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (filter) q = filter(q);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
async function move(table, list, index, dir) {
  const j = index + dir;
  if (j < 0 || j >= list.length) return;
  const arr = list.slice();
  [arr[index], arr[j]] = [arr[j], arr[index]];
  const updates = arr.map((r, i) => supabase.from(table).update({ sort_order: i }).eq('id', r.id));
  const res = await Promise.all(updates);
  const err = res.find(r => r.error);
  if (err) throw err.error;
}

/* ------------------------------------------------------------------ field builders */
function fieldHtml(f, v) {
  const id = 'f-' + f.k;
  const req = f.required ? ' required' : '';
  const hint = f.hint ? `<span class="hint" id="${id}-hint">${esc(f.hint)}</span>` : '';
  const desc = f.hint ? ` aria-describedby="${id}-hint"` : '';
  if (f.type === 'textarea') return `<div class="field"><label for="${id}">${esc(f.label)}</label><textarea id="${id}" name="${f.k}" class="${f.tall ? 'tall' : ''}"${req}${desc}>${esc(v)}</textarea>${hint}</div>`;
  if (f.type === 'select') return `<div class="field"><label for="${id}">${esc(f.label)}</label><select id="${id}" name="${f.k}"${req}>${f.options.map(o => `<option value="${esc(o.value)}"${String(o.value) === String(v) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>${hint}</div>`;
  return `<div class="field"><label for="${id}">${esc(f.label)}</label><input id="${id}" name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}"${req}${desc}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>${hint}</div>`;
}

// One image (profile photo, certificate). state: { url, path, file, preview, removed }
function singleImage(container, initial, label) {
  const st = { url: initial.url || '', path: initial.path || '', file: null, preview: '', removed: false };
  const uid = 'img-' + Math.random().toString(36).slice(2, 8);
  const draw = () => {
    const src = st.preview || (!st.removed && st.url) || '';
    container.innerHTML = `<div class="field"><span class="label">${esc(label)}</span>
      ${src ? `<img class="photo-preview" src="${esc(src)}" alt="Current image">` : `<div class="empty" style="padding:16px">No image</div>`}
      <div class="form__actions">
        <span class="file-pick"><input type="file" id="${uid}" accept="image/*"><label class="btn btn--ghost" for="${uid}">${src ? 'Replace image' : 'Upload image'}</label></span>
        ${src ? '<button type="button" class="btn btn--danger" data-remove>Remove image</button>' : ''}
      </div><span class="hint">JPG, PNG or WebP, up to 5 MB.</span></div>`;
    $('input[type=file]', container).addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      if (st.preview) URL.revokeObjectURL(st.preview);
      st.file = file; st.preview = URL.createObjectURL(file); st.removed = false; draw();
    });
    $('[data-remove]', container)?.addEventListener('click', () => { st.file = null; if (st.preview) URL.revokeObjectURL(st.preview); st.preview = ''; st.removed = true; draw(); });
  };
  draw();
  return {
    // uploads a new file if picked; returns { url, path, oldPath to delete after the save }
    async commit(folder) {
      if (st.file) { const up = await upload(st.file, folder); return { url: up.url, path: up.path, oldPath: st.path }; }
      if (st.removed) return { url: '', path: '', oldPath: st.path };
      return { url: st.url, path: st.path, oldPath: '' };
    }
  };
}

// Many images (projects). items: [{ url, path } | { file, preview }]
function multiImage(container, initial) {
  const items = (initial || []).map(i => ({ url: i.url, path: i.path || '' }));
  const removed = [];
  const uid = 'imgs-' + Math.random().toString(36).slice(2, 8);
  const draw = () => {
    container.innerHTML = `<div class="field"><span class="label">Images</span>
      <span class="hint">The first image is the cover on the card. All of them show in the detail view.</span>
      <div class="images">${items.map((it, i) => `
        <div class="img-tile">${i === 0 ? '<span class="img-tile__badge">Cover</span>' : ''}
          <img src="${esc(it.preview || it.url)}" alt="Image ${i + 1}">
          <div class="img-tile__bar">
            <button type="button" class="icon-btn" data-l="${i}" aria-label="Move image ${i + 1} earlier"${i === 0 ? ' disabled' : ''}>${ICON.left}</button>
            <button type="button" class="icon-btn" data-x="${i}" aria-label="Remove image ${i + 1}">${ICON.x}</button>
            <button type="button" class="icon-btn" data-r="${i}" aria-label="Move image ${i + 1} later"${i === items.length - 1 ? ' disabled' : ''}>${ICON.right}</button>
          </div></div>`).join('') || '<div class="empty" style="padding:16px;width:100%">No images yet</div>'}</div>
      <div class="form__actions"><span class="file-pick"><input type="file" id="${uid}" accept="image/*" multiple><label class="btn btn--ghost" for="${uid}">Add images</label></span></div></div>`;
    $('input[type=file]', container).addEventListener('change', e => {
      [...e.target.files].forEach(file => items.push({ file, preview: URL.createObjectURL(file) }));
      draw();
    });
    $$('[data-l]', container).forEach(b => b.addEventListener('click', () => { const i = +b.dataset.l; [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); }));
    $$('[data-r]', container).forEach(b => b.addEventListener('click', () => { const i = +b.dataset.r; [items[i + 1], items[i]] = [items[i], items[i + 1]]; draw(); }));
    $$('[data-x]', container).forEach(b => b.addEventListener('click', () => { const [it] = items.splice(+b.dataset.x, 1); if (it.path) removed.push(it.path); if (it.preview) URL.revokeObjectURL(it.preview); draw(); }));
  };
  draw();
  return {
    async commit(folder) {
      const out = [];
      for (const it of items) out.push(it.file ? await upload(it.file, folder) : { url: it.url, path: it.path });
      return { images: out, oldPaths: removed.slice() };
    }
  };
}

/* ------------------------------------------------------------------ profile */
async function profileTab() {
  const { data, error } = await supabase.from('profile').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  const p = data || { name: 'Andrew Benedict I. Alcantara' };
  content().innerHTML = `
    <div class="section-title"><div><h2>Profile</h2><p class="muted">Your name, tagline, bio and photo, shown at the top of the site.</p></div></div>
    <form class="panel form" data-profile novalidate>
      ${fieldHtml({ k: 'name', label: 'Name', required: true }, p.name)}
      ${fieldHtml({ k: 'tagline', label: 'Tagline', hint: 'One short line under your name, e.g. what you build or study.' }, p.tagline)}
      ${fieldHtml({ k: 'bio', label: 'Bio', type: 'textarea', tall: true, hint: 'Shown large in the About section. Two to four sentences read best.' }, p.bio)}
      <div data-photo></div>
      <div class="form__actions"><button class="btn btn--primary" type="submit">Save profile</button></div>
    </form>`;
  const photo = singleImage($('[data-photo]'), { url: p.photo_url, path: p.photo_path }, 'Profile photo');
  $('[data-profile]').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget, btn = $('button[type=submit]', f);
    if (!f.name.value.trim()) { toast('Your name cannot be empty.', true); f.name.focus(); return; }
    btn.disabled = true;
    try {
      const img = await photo.commit('profile');
      const { error } = await supabase.from('profile').upsert({ id: 1, name: f.name.value.trim(), tagline: f.tagline.value.trim(), bio: f.bio.value.trim(), photo_url: img.url, photo_path: img.path, updated_at: new Date().toISOString() });
      if (error) throw error;
      if (img.oldPath) await removeFiles([img.oldPath]);
      toast('Profile saved. It is live now.');
      await profileTab();
    } catch (err) { fail(err, 'Could not save'); } finally { btn.disabled = false; }
  });
}

/* ------------------------------------------------------------------ generic list editor
   cfg: { table, title, intro, noun, fields, toRow(form, extra) -> row, itemTitle, itemSub, thumb, image: 'single'|'multi', folder } */
function listTab(cfg) {
  return async function draw(root = content()) {
    const list = await rows(cfg.table);
    const extra = cfg.load ? await cfg.load() : {};
    const redraw = cfg.after || (() => draw(root));
    root.innerHTML = `
      <div class="section-title"><div><h2>${esc(cfg.title)}</h2><p class="muted">${esc(cfg.intro)}</p></div>
        <button class="btn btn--primary" type="button" data-add>Add ${esc(cfg.noun)}</button></div>
      <div data-editor-slot></div>
      ${cfg.groupBy ? cfg.groupBy(list, extra).map(g => `<div class="group-block"><div class="subhead"><h3>${esc(g.title)}</h3></div>${listHtml(cfg, g.rows, extra)}</div>`).join('') || `<div class="empty">${esc(cfg.emptyText)}</div>`
        : (list.length ? listHtml(cfg, list, extra) : `<div class="empty">${esc(cfg.emptyText)}</div>`)}`;
    $('[data-add]', root).addEventListener('click', () => editor(root, cfg, null, list, extra, redraw));
    $('[data-edit]', root).forEach(b => b.addEventListener('click', () => editor(root, cfg, list.find(r => r.id === b.dataset.edit), list, extra, redraw)));
    $('[data-del]', root).forEach(b => b.addEventListener('click', async () => {
      const row = list.find(r => r.id === b.dataset.del);
      if (!confirm(`Delete "${cfg.itemTitle(row, extra)}"? This cannot be undone.`)) return;
      try {
        const { error } = await supabase.from(cfg.table).delete().eq('id', row.id);
        if (error) throw error;
        await removeFiles(cfg.paths ? cfg.paths(row) : []);
        toast('Deleted.');
        await redraw();
      } catch (e) { fail(e, 'Could not delete'); }
    }));
    $('[data-move]', root).forEach(b => b.addEventListener('click', async () => {
      const [id, dir] = b.dataset.move.split(':');
      const row = list.find(r => r.id === id);
      const sibs = cfg.siblings ? list.filter(r => cfg.siblings(r, row)) : list;
      try { await move(cfg.table, sibs, sibs.indexOf(row), +dir); await redraw(); } catch (e) { fail(e, 'Could not reorder'); }
    }));
  };
}

function listHtml(cfg, list, extra) {
  return `<ul class="list">${list.map((r, i) => `
    <li class="item">
      <span class="item__thumb">${cfg.thumb ? cfg.thumb(r) : ICON.img}</span>
      <div class="item__main"><div class="item__title">${esc(cfg.itemTitle(r, extra))}</div>${cfg.itemSub ? `<div class="item__sub">${esc(cfg.itemSub(r, extra))}</div>` : ''}</div>
      <div class="item__actions">
        <button type="button" class="icon-btn icon-btn--sm" data-move="${r.id}:-1" aria-label="Move up"${i === 0 ? ' disabled' : ''}>${ICON.up}</button>
        <button type="button" class="icon-btn icon-btn--sm" data-move="${r.id}:1" aria-label="Move down"${i === list.length - 1 ? ' disabled' : ''}>${ICON.down}</button>
        <button type="button" class="btn btn--ghost" data-edit="${r.id}">Edit</button>
        <button type="button" class="btn btn--danger" data-del="${r.id}">Delete</button>
      </div>
    </li>`).join('')}</ul>`;
}

function editor(root, cfg, row, list, extra, redraw) {
  const slot = $('[data-editor-slot]', root);
  const isNew = !row;
  const fields = typeof cfg.fields === 'function' ? cfg.fields(extra) : cfg.fields;
  slot.innerHTML = `<form class="panel form editor" novalidate>
      <h3>${isNew ? `Add ${esc(cfg.noun)}` : `Edit ${esc(cfg.noun)}`}</h3>
      ${fields.map(f => f.k === '_grid' ? `<div class="grid2">${f.fields.map(g => fieldHtml(g, cfg.value(row, g.k))).join('')}</div>` : fieldHtml(f, cfg.value(row, f.k))).join('')}
      <div data-image></div>
      <div class="form__actions"><button class="btn btn--primary" type="submit">${isNew ? `Add ${esc(cfg.noun)}` : 'Save changes'}</button><button class="btn btn--ghost" type="button" data-cancel>Cancel</button></div>
      <p class="form__status" role="status"></p>
    </form>`;
  const form = $('form', slot);
  let img = null;
  if (cfg.image === 'single') img = singleImage($('[data-image]', form), { url: row?.image_url, path: row?.image_path }, cfg.imageLabel || 'Image (optional)');
  if (cfg.image === 'multi') img = multiImage($('[data-image]', form), row?.images);
  $('[data-cancel]', form).addEventListener('click', () => { slot.innerHTML = ''; });
  form.querySelector('input, select, textarea')?.focus();
  slot.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('.form__status', form), btn = $('button[type=submit]', form);
    const missing = $$('[required]', form).find(el => !el.value.trim());
    if (missing) { status.textContent = `Fill in "${$(`label[for="${missing.id}"]`, form).textContent}".`; status.classList.add('is-error'); missing.focus(); return; }
    const problem = cfg.validate?.(form);
    if (problem) { status.textContent = problem; status.classList.add('is-error'); return; }
    status.classList.remove('is-error'); status.textContent = 'Saving…'; btn.disabled = true;
    try {
      const data = cfg.toRow(form, extra);
      let oldPaths = [];
      if (cfg.image === 'single') { const r = await img.commit(cfg.folder); data.image_url = r.url; data.image_path = r.path; if (r.oldPath) oldPaths.push(r.oldPath); }
      if (cfg.image === 'multi') { const r = await img.commit(cfg.folder); data.images = r.images; oldPaths = r.oldPaths; }
      if (isNew) {
        const sibs = cfg.siblings ? list.filter(r => cfg.siblings(r, data)) : list;
        data.sort_order = sibs.length ? Math.max(...sibs.map(r => r.sort_order ?? 0)) + 1 : 0;
      }
      const { error } = isNew ? await supabase.from(cfg.table).insert(data) : await supabase.from(cfg.table).update(data).eq('id', row.id);
      if (error) throw error;
      await removeFiles(oldPaths);
      toast(isNew ? 'Added. It is live now.' : 'Saved. It is live now.');
      await redraw();
    } catch (err) { status.textContent = ''; fail(err, 'Could not save'); btn.disabled = false; }
  });
}

const val = (row, k) => row ? (Array.isArray(row[k]) ? row[k].join(', ') : row[k] ?? '') : '';
const urlProblem = (v, label) => v && !/^https?:\/\/\S+\.\S+/i.test(v) ? `${label} should start with https://` : '';

/* ------------------------------------------------------------------ the tabs */
const socialCfg = {
  table: 'social_links', title: 'Social links', noun: 'link', emptyText: 'No links yet. Add GitHub, LinkedIn, your email and more.',
  intro: 'Pick the platform and paste the link; the icon appears by itself. Email goes in as just the address.',
  fields: [
    { k: 'platform', label: 'Platform', type: 'select', options: PLATFORM_ORDER.map(p => ({ value: p, label: p === 'link' ? 'Custom link' : PLATFORMS[p].label })) },
    { k: 'url', label: 'Link or email address', required: true, placeholder: 'https://github.com/your-name' },
    { k: 'label', label: 'Label (for custom links)', hint: 'e.g. "Blog" or "Resume". Ignored for the named platforms.' }
  ],
  value: (row, k) => row ? row[k] ?? '' : (k === 'platform' ? 'github' : ''),
  validate: f => f.platform.value === 'email'
    ? (/^(mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(f.url.value.trim()) ? '' : 'Write an email address with an @, like name@gmail.com.')
    : urlProblem(f.url.value.trim(), 'The link'),
  toRow: f => ({ platform: f.platform.value, url: f.url.value.trim().replace(/^mailto:/i, f.platform.value === 'email' ? '' : 'mailto:'), label: f.label.value.trim() }),
  itemTitle: r => r.platform === 'link' ? (r.label || 'Custom link') : PLATFORMS[r.platform]?.label || r.platform,
  itemSub: r => r.url,
  thumb: r => iconSvg(r.platform, 20)
};

const categoryCfg = {
  table: 'skill_categories', title: 'Skill categories', noun: 'category', emptyText: 'No categories yet. Start with one, e.g. "Languages" or "Tools".',
  intro: 'Groups on the Skills section, e.g. Languages, Frameworks, Tools.',
  fields: [{ k: 'name', label: 'Category name', required: true }],
  value: val, toRow: f => ({ name: f.name.value.trim() }),
  itemTitle: r => r.name, itemSub: () => 'Category'
};

const skillCfg = {
  table: 'skills', title: 'Skills', noun: 'skill', emptyText: 'No skills yet.',
  intro: 'Each skill sits in a category. Reorder within a category with the arrows.',
  load: async () => ({ cats: await rows('skill_categories') }),
  fields: ex => [
    { k: 'category_id', label: 'Category', type: 'select', options: ex.cats.map(c => ({ value: c.id, label: c.name })) },
    { k: 'name', label: 'Skill', required: true, placeholder: 'e.g. JavaScript' }
  ],
  value: val,
  toRow: f => ({ category_id: f.category_id.value, name: f.name.value.trim() }),
  siblings: (a, b) => a.category_id === b.category_id,
  groupBy: (list, ex) => ex.cats.map(c => ({ title: c.name, rows: list.filter(s => s.category_id === c.id) })).filter(g => g.rows.length),
  itemTitle: r => r.name
};

async function skillsTab() {
  const cats = await rows('skill_categories');
  content().innerHTML = '<div class="content" data-cats></div><hr style="border:0;border-top:1px solid var(--line);margin:8px 0"><div class="content" data-skills></div>';
  const again = () => skillsTab();
  await listTab({ ...categoryCfg, after: again })($('[data-cats]'));
  if (cats.length) await listTab({ ...skillCfg, after: again })($('[data-skills]'));
  else $('[data-skills]').innerHTML = '<div class="empty">Add a category first, then add skills to it.</div>';
}

const projectCfg = {
  table: 'projects', title: 'Projects', noun: 'project', emptyText: 'No projects yet.', image: 'multi', folder: 'projects',
  intro: 'Cards on the site. Clicking a card opens the details with all images.',
  fields: [
    { k: 'title', label: 'Title', required: true },
    { k: 'summary', label: 'Short description (on the card)', type: 'textarea', hint: 'One or two sentences.' },
    { k: 'details', label: 'Full description (in the detail view)', type: 'textarea', tall: true, hint: 'Leave a blank line between paragraphs.' },
    { k: 'tags', label: 'Tech tags', hint: 'Separate with commas: React, Supabase, Tailwind' },
    { k: '_grid', fields: [
      { k: 'live_url', label: 'Live demo link', type: 'url', placeholder: 'https://' },
      { k: 'repo_url', label: 'GitHub link', type: 'url', placeholder: 'https://github.com/…' }
    ] }
  ],
  value: val,
  validate: f => urlProblem(f.live_url.value.trim(), 'The live demo link') || urlProblem(f.repo_url.value.trim(), 'The GitHub link'),
  toRow: f => ({ title: f.title.value.trim(), summary: f.summary.value.trim(), details: f.details.value.trim(), tags: linesToTags(f.tags.value), live_url: f.live_url.value.trim(), repo_url: f.repo_url.value.trim() }),
  paths: r => (r.images || []).map(i => i.path),
  itemTitle: r => r.title, itemSub: r => (r.tags || []).join(', ') || r.summary,
  thumb: r => r.images?.[0]?.url ? `<img class="item__thumb" src="${esc(r.images[0].url)}" alt="">` : ICON.img
};

const educationCfg = {
  table: 'education', title: 'Education', noun: 'school', emptyText: 'No education entries yet.',
  intro: 'Schools and programs, newest first is usual.',
  fields: [
    { k: 'school', label: 'School', required: true },
    { k: 'program', label: 'Degree or program' },
    { k: '_grid', fields: [
      { k: 'start_year', label: 'Start year', placeholder: '2022' },
      { k: 'end_year', label: 'End year', placeholder: '2026 or Present' }
    ] },
    { k: 'notes', label: 'Notes', type: 'textarea', hint: 'Honors, focus, thesis, activities. Optional.' }
  ],
  value: val,
  toRow: f => ({ school: f.school.value.trim(), program: f.program.value.trim(), start_year: f.start_year.value.trim(), end_year: f.end_year.value.trim(), notes: f.notes.value.trim() }),
  itemTitle: r => r.school, itemSub: r => [r.program, [r.start_year, r.end_year].filter(Boolean).join('–')].filter(Boolean).join(' · ')
};

const certCfg = {
  table: 'certifications', title: 'Certifications', noun: 'certification', emptyText: 'No certifications yet.', image: 'single', folder: 'certifications', imageLabel: 'Certificate image (optional)',
  intro: 'Name, issuer, date and the link to verify it.',
  fields: [
    { k: 'name', label: 'Certification name', required: true },
    { k: '_grid', fields: [
      { k: 'issuer', label: 'Issuer', placeholder: 'e.g. Cisco Networking Academy' },
      { k: 'issued_on', label: 'Date', placeholder: 'e.g. March 2026' }
    ] },
    { k: 'credential_url', label: 'Credential link', type: 'url', placeholder: 'https://' }
  ],
  value: val,
  validate: f => urlProblem(f.credential_url.value.trim(), 'The credential link'),
  toRow: f => ({ name: f.name.value.trim(), issuer: f.issuer.value.trim(), issued_on: f.issued_on.value.trim(), credential_url: f.credential_url.value.trim() }),
  paths: r => [r.image_path],
  itemTitle: r => r.name, itemSub: r => [r.issuer, r.issued_on].filter(Boolean).join(' · '),
  thumb: r => r.image_url ? `<img class="item__thumb" src="${esc(r.image_url)}" alt="">` : ICON.img
};

const TABS = {
  profile: profileTab,
  social_links: listTab(socialCfg),
  skills: skillsTab,
  projects: listTab(projectCfg),
  education: listTab(educationCfg),
  certifications: listTab(certCfg)
};

boot().catch(e => fail(e, 'Could not start'));
