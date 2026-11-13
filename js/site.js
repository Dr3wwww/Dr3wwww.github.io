// The public page: reads everything from Supabase, renders it, hides empty sections,
// then starts the design kit's scripts (nav, hover layer, hero entrance, the about statement moment).
import { configured, loadAll } from './db.js';
import { iconSvg, platformLabel } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// only http(s), mailto and tel links are ever written into the page
const safeUrl = u => {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return 'mailto:' + u;
  if (/^[\w./-]+\.(svg|png|jpe?g|webp|gif|avif)$/i.test(u) && !u.startsWith('//')) return u;   // a relative image on this site
  if (/^[\w-]+(\.[\w-]+)+/.test(u)) return 'https://' + u;
  return '';
};
const arrow = '<svg class="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path class="m-arrow__stem" d="M1 6h8"/><path class="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5"/></svg>';
const paragraphs = text => String(text || '').split(/\n{2,}|\r\n\r\n/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

/* ------------------------------------------------------------------ theme toggle */
function themeToggle() {
  const btn = $('[data-theme-toggle]');
  const root = document.documentElement;
  const label = () => btn.setAttribute('aria-label', root.dataset.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  label();
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.classList.add('theme-anim');
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    label();
    setTimeout(() => root.classList.remove('theme-anim'), 260);
  });
  // follow the device while the visitor has not chosen
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', e => {
    let saved = null; try { saved = localStorage.getItem('theme'); } catch {}
    if (saved) return;
    root.dataset.theme = e.matches ? 'light' : 'dark'; label();
  });
}

/* ------------------------------------------------------------------ data */
async function getData() {
  if (configured) return loadAll();
  // Not connected yet. On this computer (localhost) a local preview file may stand in; the live site shows the name only.
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    try { const r = await fetch('dev/preview.json', { cache: 'no-store' }); if (r.ok) return r.json(); } catch {}
  }
  console.info('Portfolio: Supabase is not configured yet (js/config.js). Showing the name only.');
  return { profile: {} };
}

/* ------------------------------------------------------------------ render */
function socialItem(s) {
  const href = s.platform === 'email' ? 'mailto:' + String(s.url).replace(/^mailto:/i, '') : safeUrl(s.url);
  if (!href) return '';
  const name = s.platform === 'link' ? (s.label || 'Website') : platformLabel(s.platform);
  const ext = href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<li><a href="${esc(href)}"${ext} aria-label="${esc(name)}" title="${esc(name)}">${iconSvg(s.platform)}</a></li>`;
}

function render(d) {
  const p = d.profile || {};
  const name = (p.name || 'Andrew Benedict I. Alcantara').trim();
  const parts = name.split(/\s+/);
  const shortName = parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
  $$('[data-bind="name"]').forEach(el => { el.textContent = name; });
  $$('[data-bind="short-name"]').forEach(el => { el.textContent = shortName; });
  $$('[data-bind="initials"]').forEach(el => { el.textContent = (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase(); });
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  const socials = (d.social_links || []).filter(s => s.url);
  const email = socials.find(s => s.platform === 'email');
  const emailHref = email ? 'mailto:' + String(email.url).replace(/^mailto:/i, '') : '';
  const projects = d.projects || [];

  // hero
  const tagline = $('[data-bind="tagline"]');
  tagline.textContent = p.tagline || '';
  tagline.hidden = !p.tagline;
  const heroSocials = $('[data-socials="hero"]');
  heroSocials.innerHTML = socials.map(socialItem).join('');
  heroSocials.hidden = !heroSocials.children.length;
  const actions = [];
  if (projects.length) actions.push(`<a class="btn btn--primary" href="#projects">See my projects${arrow}</a>`);
  if (emailHref) actions.push(`<a class="btn ${projects.length ? 'btn--secondary' : 'btn--primary'}" href="${esc(emailHref)}">Email me${projects.length ? '' : arrow}</a>`);
  else if (socials.length) actions.push(`<a class="btn ${projects.length ? 'btn--secondary' : 'btn--primary'}" href="#contact">Get in touch</a>`);
  $('[data-hero-actions]').innerHTML = actions.join('');
  if (p.photo_url && safeUrl(p.photo_url)) {
    $('[data-hero-media]').innerHTML = `<img src="${esc(safeUrl(p.photo_url))}" alt="Portrait of ${esc(name)}" fetchpriority="high" style="--ly-pos: 50% 30%">`;
  }

  // about
  const about = $('#about');
  $('[data-bind="bio"]').textContent = p.bio || '';
  $('[data-bind="bio"]').hidden = !p.bio;
  about.classList.toggle('is-long', (p.bio || '').split(/\s+/).length > 45);

  // skills
  const cats = d.skill_categories || [];
  const skills = d.skills || [];
  const groups = cats.map(c => ({ c, items: skills.filter(s => s.category_id === c.id) })).filter(g => g.items.length);
  $('[data-list="skills"]').innerHTML = groups.map(g => `
    <div class="skill-group"><h3>${esc(g.c.name)}</h3><ul class="skill-list">${g.items.map(s => `<li>${esc(s.name)}</li>`).join('')}</ul></div>`).join('');
  $('#skills').hidden = !groups.length;
  about.hidden = !p.bio && !groups.length;

  // projects
  $('[data-list="projects"]').innerHTML = projects.map(pr => {
    const imgs = (pr.images || []).filter(i => i && safeUrl(i.url));
    const cover = imgs[0] ? `<img class="frame__img" src="${esc(safeUrl(imgs[0].url))}" alt="" loading="lazy">` : `<div class="monogram" aria-hidden="true">${esc((pr.title || '?')[0])}</div>`;
    const links = [
      safeUrl(pr.live_url) && `<a class="link" href="${esc(safeUrl(pr.live_url))}" target="_blank" rel="noopener noreferrer">Live demo</a>`,
      safeUrl(pr.repo_url) && `<a class="link" href="${esc(safeUrl(pr.repo_url))}" target="_blank" rel="noopener noreferrer">GitHub</a>`
    ].filter(Boolean).join('');
    return `
    <article class="card project" id="project-${esc(pr.id)}" data-project="${esc(pr.id)}">
      <a class="project__cover m-zoom" href="#project-${esc(pr.id)}" tabindex="-1" aria-hidden="true">${cover}${imgs.length > 1 ? `<span class="project__count">${imgs.length} images</span>` : ''}</a>
      <div class="project__body">
        <h3><a class="project__title" href="#project-${esc(pr.id)}" aria-haspopup="dialog">${esc(pr.title)}</a></h3>
        ${pr.summary ? `<p>${esc(pr.summary)}</p>` : ''}
        ${(pr.tags || []).length ? `<ul class="tags" aria-label="Built with">${pr.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${links ? `<div class="project__links">${links}</div>` : ''}
      </div>
    </article>`;
  }).join('');
  $('#projects').hidden = !projects.length;
  $('[data-list="projects"]').dataset.count = Math.min(projects.length, 3);

  // education
  const edu = d.education || [];
  $('[data-list="education"]').innerHTML = edu.map(e => {
    const years = [e.start_year, e.end_year].filter(Boolean).join(' to ');
    return `<li>
      <h3>${esc(e.school)}</h3>
      ${years ? `<span class="rows__value">${esc(years)}</span>` : ''}
      ${e.program ? `<p class="edu__program">${esc(e.program)}</p>` : ''}
      ${e.notes ? `<p class="edu__notes">${esc(e.notes)}</p>` : ''}
    </li>`;
  }).join('');
  $('#education').hidden = !edu.length;

  // certifications
  const certs = d.certifications || [];
  $('[data-list="certifications"]').innerHTML = certs.map(c => {
    const url = safeUrl(c.credential_url);
    const img = safeUrl(c.image_url);
    const meta = [c.issuer, c.issued_on].filter(Boolean).map(esc).join(' · ');
    const thumb = img ? (url
      ? `<a class="cert__thumb m-zoom" href="${esc(url)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><img class="frame__img" src="${esc(img)}" alt="" loading="lazy"></a>`
      : `<span class="cert__thumb"><img src="${esc(img)}" alt="Certificate: ${esc(c.name)}" loading="lazy"></span>`) : '';
    return `<li class="${img ? 'has-thumb' : ''}">
      ${thumb}
      <h3>${esc(c.name)}</h3>
      ${meta ? `<p class="cert__meta">${meta}</p>` : ''}
      ${url ? `<a class="link cert__link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">View credential</a>` : ''}
    </li>`;
  }).join('');
  $('#certifications').hidden = !certs.length;
  $('#background').hidden = !edu.length && !certs.length;
  $('[data-bind="background-title"]').textContent = edu.length && certs.length ? 'Education and certifications' : edu.length ? 'Education' : 'Certifications';
  $('#background').classList.toggle('is-split', !!(edu.length && certs.length));

  // contact (in the closing footer)
  const contact = $('[data-contact]');
  contact.hidden = !socials.length;
  $('[data-contact-line]').textContent = emailHref ? `Write to ${emailHref.replace(/^mailto:/, '')}. I read every message.` : '';
  $('[data-contact-main]').innerHTML = emailHref
    ? `<a class="btn btn--primary btn--xl btn--wide" href="${esc(emailHref)}">Email me${arrow}</a>` : '';
  $('[data-socials="contact"]').innerHTML = socials.filter(s => s.platform !== 'email').map(socialItem).join('');

  // nav: one word per visible section, the main action as the one button
  const words = [['about', 'About'], ['skills', 'Skills'], ['projects', 'Projects'], ['education', 'Education'], ['certifications', 'Certificates']]
    .filter(([id]) => !$('#' + id).hidden && !$('#' + id).closest('section')?.hidden);
  if (socials.length) words.push(['contact', 'Contact']);
  $('[data-nav]').innerHTML = words.map(([id, w]) => `<div class="nav__item"><a class="nav__link" href="#${id}">${w}</a></div>`).join('');
  $('[data-nav]').hidden = !words.length;
  $('[data-nav-action] > .btn')?.remove();
  if (emailHref) $('[data-nav-action]').insertAdjacentHTML('afterbegin', `<a class="btn btn--primary" href="${esc(emailHref)}">Email me</a>`);

  projectDialog(projects);
}

/* ------------------------------------------------------------------ project detail */
function projectDialog(projects) {
  const dlg = $('[data-project-dialog]');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  let lastFocus = null;
  const open = id => {
    const pr = projects.find(p => String(p.id) === String(id));
    if (!pr) return;
    lastFocus = document.activeElement;
    $('[data-pd="title"]', dlg).textContent = pr.title;
    const imgs = (pr.images || []).filter(i => i && safeUrl(i.url));
    $('[data-pd="gallery"]', dlg).innerHTML = imgs.map((i, n) => `<img src="${esc(safeUrl(i.url))}" alt="${esc(pr.title)}, image ${n + 1} of ${imgs.length}" loading="${n ? 'lazy' : 'eager'}">`).join('');
    $('[data-pd="gallery"]', dlg).hidden = !imgs.length;
    $('[data-pd="text"]', dlg).innerHTML = paragraphs(pr.details || pr.summary);
    $('[data-pd="tags"]', dlg).innerHTML = (pr.tags || []).map(t => `<li>${esc(t)}</li>`).join('');
    const links = [
      safeUrl(pr.live_url) && `<a class="btn btn--primary" href="${esc(safeUrl(pr.live_url))}" target="_blank" rel="noopener noreferrer">Open the live demo${arrow}</a>`,
      safeUrl(pr.repo_url) && `<a class="btn btn--secondary" href="${esc(safeUrl(pr.repo_url))}" target="_blank" rel="noopener noreferrer">View the code on GitHub</a>`
    ].filter(Boolean);
    $('[data-pd="links"]', dlg).innerHTML = links.join('');
    dlg.showModal();
    dlg.scrollTop = 0;
    if (location.hash !== '#project-' + pr.id) history.replaceState(null, '', '#project-' + pr.id);
  };
  const close = () => dlg.close();
  dlg.addEventListener('close', () => {
    if (location.hash.startsWith('#project-')) history.replaceState(null, '', '#projects');
    lastFocus?.focus?.({ preventScroll: true });
  });
  $('[data-pd-close]', dlg).addEventListener('click', close);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#project-"]');
    if (!a) return;
    e.preventDefault();
    open(a.getAttribute('href').slice('#project-'.length));
  });
  if (location.hash.startsWith('#project-')) open(location.hash.slice('#project-'.length));
}

/* ------------------------------------------------------------------ section heights
   The kit stacks sections at whole screens. Content comes from the database, so each section takes the
   fewest whole screens that hold it (1 or 2 for a usual amount; more only for a long list). */
function fitSections() {
  const vh = window.innerHeight;
  // under 1280 the kit lets a section grow past its screens by itself; whole screens are fitted only on a wide screen
  if (window.innerWidth < 1280) { $$('main > section, footer.closing').forEach(sec => sec.style.removeProperty('--h')); return; }
  $$('main > section:not(.hero):not([hidden]), footer.closing').forEach(sec => {
    const wrap = sec.querySelector(':scope > .wrap');
    if (!wrap) return;
    sec.style.setProperty('--h', 1);
    const cs = getComputedStyle(sec);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const need = wrap.scrollHeight + pad;
    sec.style.setProperty('--h', Math.max(1, Math.ceil((need - 2) / vh)));
  });
}

/* ------------------------------------------------------------------ start */
async function start() {
  themeToggle();
  let data = { profile: {} };
  try {
    data = await Promise.race([getData(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]);
  } catch (e) {
    console.error('Portfolio: could not load content', e);
  }
  render(data);
  await document.fonts?.ready;
  fitSections();
  let t = 0;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fitSections, 150); });
  // the kit: nav, focus and guards; hover and the hero entrance; the hero layouts. system.js mounts the moment.
  await import('../assets/system.js');
  await import('../assets/motion/motion.js');
  await import('../assets/layout/layout.js');
  // images that arrive after the first fit can change a section's height
  $$('main img').forEach(img => { if (!img.complete) img.addEventListener('load', fitSections, { once: true }); });
}

// Content is read live from Supabase on every visit (no build, no cache), so a save in /admin shows on the next load.
start();
