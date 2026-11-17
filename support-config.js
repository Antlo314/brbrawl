/* Battle Rap Brawl — supporter config (v80).
   Edit amounts, perks, delivery timing, and (later) Stripe Payment Links here.
   STRIPE_LINKS stay empty and hidden until Ant adds them. Cash App is the only
   payment path right now. Day One includes an Instagram shoutout from
   @brbrawl_official. */
(function (root) {
  const CASH = {
    cashtag: '$lumenlabs1',
    url: 'https://cash.app/$lumenlabs1',
    qr: '/art/support/cashapp-qr.png',
  };
  const SIGN_MAX = 40;
  const BILLBOARD_MAX = 48;
  const IG_OFFICIAL = '@brbrawl_official';

  const BRB_CONTACT_EMAIL = 'info@brbrawl.com';
const BRB_SUPPORT = {
    cashApp: CASH,
    deliveryWeeks: 8,
    officialIg: IG_OFFICIAL,
    signMax: SIGN_MAX,
    /* Payment Links go here once Ant picks the Viral Cartel Stripe account.
       While every value is empty, the page hides all Stripe / card buttons. */
    STRIPE_LINKS: {
      fan: '',
      dayone: '',
      hypeman: '',
      ringcard: '',
      cameo: '',
      legend: '',
      custom: '',
    },
    tiers: [
      { id: 'fan', name: 'Fan', amount: 5, perks: 'Your name in the supporters credits.' },
      { id: 'dayone', name: 'Day One', amount: 25, perks: 'Credits, plus an Instagram shoutout from ' + IG_OFFICIAL + '.' },
      { id: 'hypeman', name: 'Hype Man', amount: 100, perks: 'Credits, plus a custom crowd sign or banner in a stage.' },
      { id: 'ringcard', name: 'Ring Card', amount: 250, perks: 'Your name or brand on a stage billboard.' },
      { id: 'cameo', name: 'Cameo', amount: 500, perks: 'You appear as a background crowd or stage cameo character.' },
      { id: 'legend', name: 'Playable Legend', amount: 1000, limited: true,
        perks: 'You become a playable fighter (custom V2 sprite pack, name, and super), plus exclusive rights to that character’s likeness in-game. Limited slots, subject to approval and content guidelines.' },
    ],
    /* Instagram and YouTube only, and only handles we could verify. A battler
       with no link still appears in the list; we do not guess. */
    battlers: [
      { id: 'rosenberg2', name: 'Rosenberg', ig: 'https://www.instagram.com/rosenbergraw610/', yt: 'https://www.youtube.com/@frozenbergtv' },
      { id: 'jaemillz', name: 'Jae Millz', ig: 'https://www.instagram.com/jaemillz/', yt: 'https://www.youtube.com/@JaeMillzTv' },
      { id: 'mook', name: 'Murda Mook', ig: 'https://www.instagram.com/murdamookez/' },
      { id: 'cassidy', name: 'Cassidy', ig: 'https://www.instagram.com/cassidy_larsiny/' },
      { id: 'ttop', name: 'T-Top', ig: 'https://www.instagram.com/_topbizzy/' },
      { id: 'msfit', name: 'Ms. Fit', ig: 'https://www.instagram.com/msdotfit/', yt: 'https://www.youtube.com/@MsDotFit' },
      { id: 'lucastro', name: 'Lu Castro', ig: 'https://www.instagram.com/whynotcastro/' },
      { id: 'trufoe', name: 'Tru Foe', ig: 'https://www.instagram.com/foe_tru/' },
      { id: 'kshine', name: 'K-Shine', ig: 'https://www.instagram.com/zipemup_kshine/' },
      { id: 'nitty', name: 'Nitty' },
      { id: 'dizaster', name: 'Dizaster', ig: 'https://www.instagram.com/mrdizaster/', yt: 'https://www.youtube.com/@DIZASTERBATTLES' },
      { id: 'ave', name: 'Ave', yt: 'https://www.youtube.com/@avecronym' },
    ],
  };

  function stripeEnabled() {
    const L = BRB_SUPPORT.STRIPE_LINKS || {};
    return Object.keys(L).some(k => !!(L[k] && String(L[k]).trim()));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function field(opts) {
    const id = opts.id, label = opts.label, typ = opts.type || 'text';
    const req = opts.required ? ' required' : '';
    const max = opts.max ? ` maxlength="${opts.max}"` : '';
    const extra = opts.attrs || '';
    const hint = opts.hint ? `<small class="sup-hint">${esc(opts.hint)}</small>` : '';
    if (typ === 'textarea') {
      return `<label class="sup-field" for="${esc(id)}">${esc(label)}${hint}` +
        `<textarea id="${esc(id)}" name="${esc(opts.name || id)}" rows="${opts.rows || 4}"${max}${req} ${extra}></textarea></label>`;
    }
    if (typ === 'file') {
      const many = opts.multiple ? ' multiple' : '';
      return `<label class="sup-field" for="${esc(id)}">${esc(label)}${hint}` +
        `<input id="${esc(id)}" name="${esc(opts.name || id)}" type="file" accept="image/jpeg,image/png,image/webp"${many}${req}></label>`;
    }
    if (typ === 'checkbox') {
      return `<label class="sup-check" for="${esc(id)}">` +
        `<input id="${esc(id)}" name="${esc(opts.name || id)}" type="checkbox" value="yes"${req}>` +
        `<span>${esc(label)}</span></label>`;
    }
    return `<label class="sup-field" for="${esc(id)}">${esc(label)}${hint}` +
      `<input id="${esc(id)}" name="${esc(opts.name || id)}" type="${esc(typ)}"${max}${req} ${extra} value="${esc(opts.value || '')}"></label>`;
  }

  function tierFields(tierId, customAmount) {
    if (tierId === 'fan') {
      return field({ id: 'sup-credit-name', name: 'credit_name', label: 'Name in the credits', required: true, max: 80 });
    }
    if (tierId === 'dayone') {
      return field({ id: 'sup-credit-name', name: 'credit_name', label: 'Name in the credits', required: true, max: 80 }) +
        field({ id: 'sup-shoutout-ig', name: 'shoutout_ig', label: 'Instagram handle for the shoutout', required: true, max: 40, hint: 'Shoutout comes from ' + IG_OFFICIAL + '. Leave this as your IG if it is the same.', attrs: 'data-ig-sync="1"' });
    }
    if (tierId === 'hypeman') {
      return field({ id: 'sup-sign-text', name: 'sign_text', label: 'Crowd sign text', required: true, max: SIGN_MAX, hint: SIGN_MAX + ' characters max. Keep it short so it reads in the crowd.' });
    }
    if (tierId === 'ringcard') {
      return field({ id: 'sup-billboard', name: 'billboard_text', label: 'Billboard name or brand text', required: true, max: BILLBOARD_MAX }) +
        field({ id: 'sup-logo', name: 'logo', label: 'Optional logo', type: 'file', hint: 'JPEG, PNG, or WebP, 5 MB max.' });
    }
    if (tierId === 'cameo') {
      return field({ id: 'sup-cameo-name', name: 'cameo_name', label: 'Name shown for the cameo', required: true, max: 80 }) +
        field({ id: 'sup-appearance', name: 'appearance', label: 'Appearance description', type: 'textarea', required: true, hint: 'Clothing, hair, build, and any details we should lock in.' }) +
        field({ id: 'sup-photos', name: 'photos', label: 'Reference photos (up to 3)', type: 'file', multiple: true, hint: 'JPEG, PNG, or WebP, 5 MB each.' });
    }
    if (tierId === 'legend') {
      return field({ id: 'sup-fighter-name', name: 'fighter_name', label: 'Fighter name', required: true, max: 80 }) +
        field({ id: 'sup-appearance', name: 'appearance', label: 'Appearance description', type: 'textarea', required: true, hint: 'Clothing, hair, build, and the look we should draw.' }) +
        field({ id: 'sup-photos', name: 'photos', label: 'Reference photos (up to 5)', type: 'file', multiple: true, hint: 'JPEG, PNG, or WebP, 5 MB each.' }) +
        field({ id: 'sup-supers', name: 'super_ideas', label: 'Signature move / super ideas', type: 'textarea', rows: 3 }) +
        field({ id: 'sup-hometown', name: 'hometown', label: 'Hometown', max: 80 }) +
        field({ id: 'sup-walkout', name: 'walkout', label: 'Walkout song or vibe', max: 200 }) +
        field({ id: 'sup-likeness', name: 'likeness_consent', type: 'checkbox', required: true,
          label: 'I confirm I am the person in these photos, or I have the rights to this likeness, and I consent to it being used as a playable character in Battle Rap Brawl.' });
    }
    if (tierId === 'custom') {
      return field({ id: 'sup-custom-amount', name: 'custom_amount', label: 'Amount (USD)', type: 'number', required: true, value: customAmount ? String(customAmount) : '', attrs: 'min="1" step="1" inputmode="numeric"' }) +
        field({ id: 'sup-custom-note', name: 'custom_note', label: 'Note', type: 'textarea', required: true, hint: 'Tell us what this support is for.' });
    }
    return '';
  }

  function supportApi() {
    if (root.BRB_SUPPORT_API) return root.BRB_SUPPORT_API;
    if (location.port === '8080' || location.port === '8081') return 'http://localhost:3000/api/support';
    return '/api/support';
  }
  function contactApi() {
    if (location.port === '8080' || location.port === '8081') return 'http://localhost:3000/api/contact';
    return '/api/contact';
  }

  function memoFor(tier, ig, customAmount) {
    const name = tier ? tier.name : 'Custom';
    const handle = ig ? (ig.charAt(0) === '@' ? ig : '@' + ig) : '@yourIG';
    return name + ' · ' + handle;
  }

  function amountOf(tier, customAmount) {
    return tier ? tier.amount : customAmount;
  }

  function paySuccess(tier, ig, customAmount) {
    const dollars = amountOf(tier, customAmount);
    const memo = memoFor(tier, ig, customAmount);
    const label = tier ? (tier.name + ' — $' + tier.amount) : ('Custom — $' + customAmount);
    return (
      `<div class="sup-success" id="sup-success">` +
        `<p class="sup-kicker">YOU'RE IN</p>` +
        `<h3>Thanks. Now send it on Cash App</h3>` +
        `<p>Your details are in. Open <b>Cash App ${esc(CASH.cashtag)}</b> and send <b>$${esc(dollars)}</b>. In the memo, put your Instagram handle and this tier:</p>` +
        `<p class="sup-memo" id="sup-memo">${esc(memo)}</p>` +
        `<div class="sup-actions">` +
          `<a class="btn primary cash-btn" href="${esc(CASH.url)}" target="_blank" rel="noopener">Open Cash App ${esc(CASH.cashtag)}</a>` +
          `<button type="button" class="btn ghost" id="sup-copy">Copy memo</button>` +
        `</div>` +
        `<p class="sup-fine">We match the payment to this form using the memo, your Instagram handle, and the Cash App cashtag you listed. Questions? Email <a href="mailto:info@brbrawl.com">info@brbrawl.com</a> or use the contact form below.</p>` +
      `</div>`
    );
  }

  function renderForm(tier, customAmount) {
    const label = tier ? (tier.name + ' — $' + tier.amount) : ('Custom — $' + (customAmount || ''));
    const tid = tier ? tier.id : 'custom';
    return (
      `<form class="sup-form" id="sup-form" novalidate>` +
        `<p class="sup-kicker">YOUR DETAILS</p>` +
        `<h3>${esc(label)}</h3>` +
        `<p class="sup-lede">Fill this out first so we can credit you and build your perk. After you submit, we will ask you to pay on Cash App ${esc(CASH.cashtag)} with your Instagram handle and tier in the memo.</p>` +
        `<input type="hidden" name="tier" value="${esc(tid)}">` +
        `<div class="sup-hp" aria-hidden="true">` +
          `<label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>` +
        `</div>` +
        `<div class="sup-grid">` +
          field({ id: 'sup-name', name: 'name', label: 'Name', required: true, max: 80 }) +
          field({ id: 'sup-email', name: 'email', label: 'Email', type: 'email', required: true, max: 200, attrs: 'autocomplete="email"' }) +
          field({ id: 'sup-ig', name: 'ig_handle', label: 'Instagram handle', required: true, max: 40, hint: 'Used in the Cash App memo so we can match your payment.', attrs: 'placeholder="@yourhandle"' }) +
          field({ id: 'sup-cashtag', name: 'cashapp_cashtag', label: 'Cash App $cashtag you are paying from', max: 40, hint: 'Optional if you have not paid yet. Helps us match the payment.', attrs: 'placeholder="$cashtag"' }) +
          field({ id: 'sup-paymemo', name: 'payment_memo', label: 'Payment memo or confirmation', max: 200, hint: 'Optional. Paste the memo you used, or a confirmation number, after you pay.' }) +
          tierFields(tid, customAmount) +
        `</div>` +
        field({ id: 'sup-terms', name: 'terms_agreed', type: 'checkbox', required: true, label: 'I agree to the supporter terms below. Donations are non-refundable and fund ongoing development of a free game. Art and character perks are subject to approval and content guidelines.' }) +
        `<p class="sup-form-err" id="sup-form-err" hidden></p>` +
        `<div class="sup-actions">` +
          `<button type="submit" class="btn primary" id="sup-submit">Submit details</button>` +
        `</div>` +
      `</form>`
    );
  }

  function renderTiers() {
    return BRB_SUPPORT.tiers.map(t => (
      `<article class="sup-tier${t.limited ? ' legend' : ''}" data-tier="${esc(t.id)}">` +
        `<small>${esc(t.name).toUpperCase()}</small>` +
        `<b>$${t.amount}</b>` +
        `<p>${esc(t.perks)}</p>` +
        `<button type="button" class="btn primary" data-pay="${esc(t.id)}">Choose this tier</button>` +
      `</article>`
    )).join('');
  }

  function renderBattlers() {
    return BRB_SUPPORT.battlers.map(b => {
      const links = [];
      if (b.ig) links.push(`<a href="${esc(b.ig)}" target="_blank" rel="noopener">Instagram</a>`);
      if (b.yt) links.push(`<a href="${esc(b.yt)}" target="_blank" rel="noopener">YouTube</a>`);
      return `<li class="sup-battler"><b>${esc(b.name)}</b>${links.length ? `<span>${links.join(' · ')}</span>` : `<span class="mute">Links coming once we confirm them</span>`}</li>`;
    }).join('');
  }

  function renderCredits(list) {
    if (!list || !list.length) {
      return '<p class="sup-empty">No names in the credits yet. Be the first — pick a tier, send in the form, and pay on Cash App.</p>';
    }
    return '<ul class="sup-credit-list">' + list.map(s => {
      const name = typeof s === 'string' ? s : (s && s.name) || '';
      const tier = s && s.tier ? ` <small>${esc(s.tier)}</small>` : '';
      return name ? `<li>${esc(name)}${tier}</li>` : '';
    }).join('') + '</ul>';
  }

  async function loadCredits() {
    try {
      const r = await fetch('/supporters.json', { cache: 'no-store' });
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : (j.supporters || []);
    } catch (e) { return []; }
  }

  function bindCopy(slot) {
    const btn = slot.querySelector('#sup-copy');
    if (btn) btn.addEventListener('click', async () => {
      const text = (slot.querySelector('#sup-memo') || {}).textContent || '';
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy memo'; }, 1600); }
      catch (e) { btn.textContent = 'Copy failed'; }
    });
  }

  function fileLimit(tierId) {
    if (tierId === 'ringcard') return 1;
    if (tierId === 'cameo') return 3;
    if (tierId === 'legend') return 5;
    return 0;
  }

  function bind(rootEl) {
    const showForm = (tier, customAmount) => {
      const slot = rootEl.querySelector('#sup-pay-slot');
      if (!slot) return;
      rootEl.querySelectorAll('.sup-tier').forEach(el => {
        el.classList.toggle('on', !!(tier && el.getAttribute('data-tier') === tier.id));
      });
      slot.innerHTML = renderForm(tier, customAmount);
      slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

      const form = slot.querySelector('#sup-form');
      const ig = slot.querySelector('#sup-ig');
      const shout = slot.querySelector('#sup-shoutout-ig');
      if (ig && shout && !shout.value) {
        const sync = () => { if (!shout.dataset.touched) shout.value = ig.value.replace(/^@+/, ''); };
        shout.addEventListener('input', () => { shout.dataset.touched = '1'; });
        ig.addEventListener('input', sync);
      }

      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const err = slot.querySelector('#sup-form-err');
        const btn = slot.querySelector('#sup-submit');
        const showErr = msg => { err.hidden = false; err.textContent = msg; };
        err.hidden = true;

        if (form.website && form.website.value) return;

        const igVal = (form.ig_handle.value || '').trim();
        if ((form.name.value || '').trim().length < 2) return showErr('Enter your name.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((form.email.value || '').trim())) return showErr('Enter a valid email.');
        if (igVal.replace(/^@+/, '').length < 2) return showErr('Enter your Instagram handle so we can match the Cash App memo.');
        if (!form.terms_agreed.checked) return showErr('Please agree to the supporter terms.');

        const tid = (form.tier.value || '').toLowerCase();
        if (tid === 'fan' && (form.credit_name.value || '').trim().length < 2) return showErr('Enter the name that should appear in the credits.');
        if (tid === 'dayone') {
          if ((form.credit_name.value || '').trim().length < 2) return showErr('Enter the name that should appear in the credits.');
          if ((form.shoutout_ig.value || '').replace(/^@+/, '').trim().length < 2) return showErr('Enter the Instagram handle for the shoutout.');
        }
        if (tid === 'hypeman' && !(form.sign_text.value || '').trim()) return showErr('Enter the crowd sign text (' + SIGN_MAX + ' characters max).');
        if (tid === 'ringcard' && (form.billboard_text.value || '').trim().length < 2) return showErr('Enter the billboard name or brand text.');
        if (tid === 'cameo') {
          if ((form.cameo_name.value || '').trim().length < 2) return showErr('Enter the name shown for your cameo.');
          if ((form.appearance.value || '').trim().length < 8) return showErr('Describe how the cameo should look.');
        }
        if (tid === 'legend') {
          if ((form.fighter_name.value || '').trim().length < 2) return showErr('Enter the fighter name.');
          if ((form.appearance.value || '').trim().length < 8) return showErr('Describe the fighter appearance.');
          if (!form.likeness_consent.checked) return showErr('Confirm you are the person pictured or have the rights to the likeness.');
        }
        if (tid === 'custom') {
          const n = Number(form.custom_amount.value);
          if (!n || n < 1) return showErr('Enter the amount you are sending.');
          if ((form.custom_note.value || '').trim().length < 2) return showErr('Add a short note with your custom request.');
        }

        const limit = fileLimit(tid);
        const photos = [];
        if (form.logo && form.logo.files) photos.push(...form.logo.files);
        if (form.photos && form.photos.files) photos.push(...form.photos.files);
        if (photos.length > limit) return showErr('You can attach up to ' + limit + ' image' + (limit === 1 ? '' : 's') + ' for this tier.');
        for (let i = 0; i < photos.length; i++) {
          const f = photos[i];
          const okType = /image\/(jpeg|png|webp)/i.test(f.type);
          if (!okType) return showErr(f.name + ' must be a JPEG, PNG, or WebP image.');
          if (f.size > 5 * 1024 * 1024) return showErr(f.name + ' is over the 5 MB limit.');
        }

        btn.disabled = true;
        btn.textContent = 'Sending…';
        try {
          const body = new FormData(form);
          const res = await fetch(supportApi(), { method: 'POST', body });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            showErr(data.error || 'Could not send the form. Try again.');
            btn.disabled = false;
            btn.textContent = 'Submit details';
            return;
          }
          const customAmt = tid === 'custom' ? Number(form.custom_amount.value) : undefined;
          slot.innerHTML = paySuccess(tier, igVal, customAmt);
          bindCopy(slot);
          slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (e) {
          showErr('Could not reach the server. If you are on the local game, start the site with next dev (port 3000) and try again.');
          btn.disabled = false;
          btn.textContent = 'Submit details';
        }
      });
    };

    rootEl.querySelectorAll('[data-pay]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = BRB_SUPPORT.tiers.find(x => x.id === btn.getAttribute('data-pay'));
        if (t) showForm(t);
      });
    });

    const customBtn = rootEl.querySelector('#sup-custom-go');
    const customIn = rootEl.querySelector('#sup-custom-amt');
    if (customBtn && customIn) {
      customBtn.addEventListener('click', () => {
        const n = Math.round(Number(customIn.value));
        if (!n || n < 1) { customIn.focus(); return; }
        showForm(null, n);
      });
    }
  }

  function renderBRBSupport(rootEl, opts) {
    if (!rootEl) return;
    const weeks = BRB_SUPPORT.deliveryWeeks;
    const inGame = !!(opts && opts.inGame);
    opts = Object.assign({ qr: inGame ? 'art/support/cashapp-qr.png' : CASH.qr }, opts || {});
    rootEl.classList.add('support-root');
    rootEl.innerHTML =
      `<section class="sup-hero">` +
        `<p class="sup-kicker">BATTLE RAP BRAWL</p>` +
        `<h1>SUPPORT THE GAME</h1>` +
        `<p class="sup-lede">The game is free to play. If you want to support the next battlers, stages, and improvements, this is the box. We’ll keep updating the free game as support comes in.</p>` +
      `</section>` +

      `<section class="sup-cash" id="cashapp">` +
        `<p class="sup-kicker">PAY WITH CASH APP</p>` +
        `<h2>Cash App ${esc(CASH.cashtag)}</h2>` +
        `<p>Pick a tier, fill out the form, then send that amount on Cash App. In the memo, put your <b>Instagram handle</b> and the <b>tier</b> (Fan, Day One, Hype Man, Ring Card, Cameo, Playable Legend, or Custom).</p>` +
        `<div class="sup-cash-row">` +
          `<div class="sup-cash-cta">` +
            `<a class="btn primary cash-btn cash-btn-xl" href="${esc(CASH.url)}" target="_blank" rel="noopener">Cash App ${esc(CASH.cashtag)}</a>` +
            `<p class="sup-fine">Opens ${esc(CASH.url)}</p>` +
          `</div>` +
          `<figure class="sup-qr">` +
            `<img src="${esc((opts && opts.qr) || CASH.qr)}" width="320" height="320" alt="Cash App QR code for ${esc(CASH.cashtag)}">` +
            `<figcaption>Scan to pay ${esc(CASH.cashtag)}</figcaption>` +
          `</figure>` +
        `</div>` +
        `<div id="sup-pay-slot"></div>` +
      `</section>` +

      `<section class="sup-tiers" id="tiers">` +
        `<p class="sup-kicker">PICK A TIER</p>` +
        `<h2>What your support unlocks</h2>` +
        `<p class="sup-lede">Choose a tier to open the form for that perk. Then send the amount on Cash App ${esc(CASH.cashtag)} with your Instagram handle and tier in the memo. Amounts are set in the support config and can be edited there.</p>` +
        `<div class="sup-tier-grid">${renderTiers()}</div>` +
        `<form class="sup-custom" id="sup-custom" onsubmit="return false;">` +
          `<label>Custom amount (USD)` +
            `<input id="sup-custom-amt" type="number" min="1" step="1" inputmode="numeric" placeholder="25">` +
          `</label>` +
          `<button type="button" class="btn primary" id="sup-custom-go">Choose custom amount</button>` +
        `</form>` +
      `</section>` +

      `<section class="sup-faq" id="faq">` +
        `<p class="sup-kicker">THE FINE PRINT</p>` +
        `<h2>Supporter FAQ &amp; terms</h2>` +
        `<dl>` +
          `<dt>How do I pay?</dt>` +
          `<dd>Fill out the form for your tier first, then send the amount on Cash App only, to ${esc(CASH.cashtag)}. Put your Instagram handle and the tier in the memo so we can credit you. Card payments will come later.</dd>` +
          `<dt>How do I send my name, art, or likeness?</dt>` +
          `<dd>The form changes with the tier you pick — credit name, crowd sign text, a logo, cameo or fighter reference photos, and so on. We use that submission, plus your Cash App memo, to match the payment.</dd>` +
          `<dt>Refunds</dt>` +
          `<dd>Donations are non-refundable. They fund ongoing development of a free game.</dd>` +
          `<dt>When do character and art tiers land?</dt>` +
          `<dd>Hype Man, Ring Card, Cameo, and Playable Legend rewards are delivered within ${weeks} weeks after an art approval round with you. Playable Legend slots are limited and subject to approval and content guidelines. We reserve the right to decline content (including names, likenesses, logos, and verses) that we can’t ship.</dd>` +
          `<dt>Fan and Day One credits</dt>` +
          `<dd>Names go on the supporters list in Settings → Credits and on this page after we confirm the payment and the memo. Day One also includes an Instagram shoutout from ${esc(IG_OFFICIAL)}.</dd>` +
        `</dl>` +
      `</section>` +

      `<section class="sup-credits" id="credits">` +
        `<p class="sup-kicker">THE WALL</p>` +
        `<h2>Supporters</h2>` +
        `<div id="sup-credit-box">${renderCredits([])}</div>` +
      `</section>` +

      `<section class="sup-battlers" id="battlers">` +
        `<p class="sup-kicker">SECONDARY</p>` +
        `<h2>Support the battlers</h2>` +
        `<p class="sup-lede">Want to show love directly to the MCs in the game? Here are the public Instagram and YouTube pages we could verify. This is separate from supporting the game.</p>` +
        `<ul class="sup-battler-list">${renderBattlers()}</ul>` +
      `</section>` +

      (inGame ? '' : `<p class="sup-foot"><a href="/play/index.html">Play Battle Rap Brawl free</a> · <a href="/">Home</a></p>`);

    bind(rootEl);
    loadCredits().then(list => {
      const box = rootEl.querySelector('#sup-credit-box');
      if (box) box.innerHTML = renderCredits(list);
    });
  }

  function renderSupportersList(el) {
    if (!el) return;
    loadCredits().then(list => { el.innerHTML = renderCredits(list); });
  }

  root.BRB_SUPPORT = BRB_SUPPORT;
  root.stripeEnabled = stripeEnabled;
  root.renderBRBSupport = renderBRBSupport;
  root.renderSupportersList = renderSupportersList;
})(typeof window !== 'undefined' ? window : this);

  function contactSuccess() {
    return (
      '<div class="sup-success" id="contact-success">' +
        '<p class="sup-kicker">GOT IT</p>' +
        '<h3>Thanks for writing in</h3>' +
        '<p>We read every message. If we need to follow up, it will come from <a href="mailto:' + BRB_CONTACT_EMAIL + '">' + BRB_CONTACT_EMAIL + '</a>.</p>' +
      '</div>'
    );
  }

  function renderContactForm(root, opts) {
    if (!root) return;
    opts = opts || {};
    root.innerHTML =
      '<form class="sup-form" id="contact-form" novalidate>' +
        '<p class="sup-kicker">CONTACT / FEEDBACK</p>' +
        '<h3>Write to the team</h3>' +
        '<p class="sup-lede">Questions, feedback, press, or a bug in the game. You can also email <a href="mailto:' + BRB_CONTACT_EMAIL + '">' + BRB_CONTACT_EMAIL + '</a>.</p>' +
        '<div class="sup-hp" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<div class="sup-grid">' +
          '<label class="sup-field">Name<input name="name" required maxlength="80" autocomplete="name"></label>' +
          '<label class="sup-field">Email<input name="email" type="email" required maxlength="200" autocomplete="email"></label>' +
          '<label class="sup-field">Instagram (optional)<input name="ig_handle" maxlength="40" placeholder="@handle" autocomplete="off"></label>' +
          '<label class="sup-field">Topic<select name="topic">' +
            '<option value="feedback">Feedback</option>' +
            '<option value="support">Support / billing</option>' +
            '<option value="bug">Bug report</option>' +
            '<option value="press">Press</option>' +
            '<option value="other">Other</option>' +
          '</select></label>' +
        '</div>' +
        '<label class="sup-field">Message<textarea name="message" required minlength="8" maxlength="2000" rows="6"></textarea></label>' +
        '<p class="sup-form-err" id="contact-err" hidden></p>' +
        '<div class="sup-actions" style="margin-top:14px"><button class="btn primary" type="submit">SEND MESSAGE</button></div>' +
      '</form>';
    const form = root.querySelector('#contact-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const err = root.querySelector('#contact-err');
      err.hidden = true;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'SENDING…';
      try {
        const res = await fetch(contactApi(), { method: 'POST', body: new FormData(form) });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok || !data.ok) {
          err.textContent = data.error || 'Could not send. Please try again.';
          err.hidden = false;
          btn.disabled = false; btn.textContent = 'SEND MESSAGE';
          return;
        }
        root.innerHTML = contactSuccess();
      } catch (err2) {
        err.textContent = 'Could not send. Check your connection and try again.';
        err.hidden = false;
        btn.disabled = false; btn.textContent = 'SEND MESSAGE';
      }
    });
  }

  window.renderContactForm = renderContactForm;
  window.BRB_CONTACT_EMAIL = BRB_CONTACT_EMAIL;

  const _renderBRBSupport = window.renderBRBSupport;
  window.renderBRBSupport = function (root, opts) {
    const r = _renderBRBSupport(root, opts);
    if (root) {
      root.classList.add('has-support-panel');
      if (!root.querySelector('#brb-contact-slot')) {
        const slot = document.createElement('div');
        slot.id = 'brb-contact-slot';
        slot.className = 'sup-contact';
        root.appendChild(slot);
        renderContactForm(slot, opts || {});
      }
      if (!root.querySelector('.sup-contact-mail')) {
        const mail = document.createElement('p');
        mail.className = 'sup-fine sup-contact-mail';
        mail.innerHTML = 'Email the team: <a href="mailto:' + BRB_CONTACT_EMAIL + '">' + BRB_CONTACT_EMAIL + '</a>';
        root.appendChild(mail);
      }
    }
    return r;
  };
