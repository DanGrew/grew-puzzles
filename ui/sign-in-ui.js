// Sign-in, in the site bar of every page. Signed out, a Sign in button beside the burger, opening a
// card that holds Google's own "Sign in with Google" button; Google's window opens over the page and
// the player never leaves it. Signed in, the player's picture, opening a menu with their email and
// Sign out. Supabase's library is vendored (vendor/supabase.js); Google's script is the one thing
// loaded from another site, and only once Sign in is tapped. Supabase's address and public key, and
// Google's client ID, are the only values the site holds — the database's own rules keep every
// player's progress theirs. Its rules are core/auth-core.js's. Its client is the page's one way to
// Supabase: the play page saves a signed-in player's finds through it, and its line under the words
// opens the card (ui/wordsearch/progress-ui.js).
import { hexOf, accountView } from '../core/auth-core.js';

var SUPABASE_URL = 'https://vxschtygvtilsadgixec.supabase.co';
var SUPABASE_PUBLIC_KEY = 'sb_publishable_9q2ENh35OE6EbJvaZ4opsQ_ABWcyMW0';
var GOOGLE_CLIENT_ID = '802523799766-q1aeup0ahrm6ajbmd1v6u1qmjfqk248u.apps.googleusercontent.com';
var GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

export var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

var account = document.createElement('div');
account.className = 'account';
account.innerHTML =
  '<button class="sign-in" type="button" aria-expanded="false" aria-controls="sign-in-card" aria-label="Sign in" hidden>' +
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="7" r="3.5"/><path d="M3.5 17c1-3.5 3.6-5 6.5-5s5.5 1.5 6.5 5"/></svg>' +
    '<span>Sign in</span>' +
  '</button>' +
  '<div class="sign-in-card" id="sign-in-card" hidden>' +
    '<div class="google-button"></div>' +
    '<p class="unavailable" hidden>Google sign-in isn\'t available right now</p>' +
  '</div>' +
  '<button class="avatar" type="button" aria-expanded="false" aria-controls="account-menu" aria-label="Account" hidden>' +
    '<img alt="" referrerpolicy="no-referrer" hidden><span class="initial"></span>' +
  '</button>' +
  '<div class="account-panel" id="account-menu" hidden>' +
    '<p class="signed-in-as">Signed in as <strong></strong></p>' +
    '<button class="sign-out" type="button">Sign out</button>' +
  '</div>';
document.querySelector('[data-site-bar] .menu').before(account);

var signIn = account.querySelector('.sign-in');
var card = account.querySelector('.sign-in-card');
var avatar = account.querySelector('.avatar');
var picture = avatar.querySelector('img');
var initial = avatar.querySelector('.initial');
var panel = account.querySelector('.account-panel');
var FACE = { true: showPicture, false: showInitial };

function show(view) {
  signIn.hidden = view.signedIn;
  avatar.hidden = !view.signedIn;
  initial.textContent = view.initial;
  account.querySelector('.signed-in-as strong').textContent = view.email;
  FACE[Boolean(view.picture)](view);
  setCard(false);
  setPanel(false);
}

function showPicture(view) {
  picture.src = view.picture;
  picture.hidden = false;
  initial.hidden = true;
}

// Also where a picture Google gave, but that won't load, ends up.
function showInitial() {
  picture.removeAttribute('src');
  picture.hidden = true;
  initial.hidden = false;
}

function setCard(open) {
  card.hidden = !open;
  signIn.setAttribute('aria-expanded', String(open));
}

function setPanel(open) {
  panel.hidden = !open;
  avatar.setAttribute('aria-expanded', String(open));
}

function closeAndFocus() {
  setPanel(false);
  avatar.focus();
}

function closeCardAndFocus() {
  setCard(false);
  signIn.focus();
}

// Google's script, fetched the first time the card opens and never again.
var loadGoogle = function () {
  loadGoogle = function () {};
  var script = document.createElement('script');
  script.src = GOOGLE_SCRIPT;
  script.async = true;
  script.addEventListener('load', drawGoogleButton);
  script.addEventListener('error', showUnavailable);
  document.head.append(script);
};

// One Tap — Google's own "Continue as …" prompt — stays off: the button is drawn, never prompted.
async function drawGoogleButton() {
  var word = crypto.randomUUID();
  var fingerprint = hexOf(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(word)));
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: fingerprint,
    auto_select: false,
    callback: function (answer) {
      client.auth.signInWithIdToken({ provider: 'google', token: answer.credential, nonce: word });
    },
  });
  window.google.accounts.id.renderButton(card.querySelector('.google-button'), {
    type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular',
  });
}

function showUnavailable() {
  card.querySelector('.unavailable').hidden = false;
}

// The card opened from elsewhere on the page — the play page's line under the words — and brought
// into view, as Sign in itself would.
export function openSignIn() {
  setCard(true);
  loadGoogle();
  card.scrollIntoView({ block: 'nearest' });
}

signIn.addEventListener('click', function () {
  setCard(card.hidden);
  loadGoogle();
});
account.querySelector('.sign-out').addEventListener('click', function () {
  client.auth.signOut({ scope: 'local' });
});
avatar.addEventListener('click', function () { setPanel(panel.hidden); });
picture.addEventListener('error', showInitial);

// Captured, so a click anywhere else closes the card or the menu — the burger's own click included.
document.addEventListener('click', function (e) {
  [setCard, setPanel].filter(function () { return !account.contains(e.target); }).forEach(function (f) { f(false); });
}, true);
document.addEventListener('keydown', function (e) {
  [closeAndFocus].filter(function () { return [e.key === 'Escape', !panel.hidden].every(Boolean); })
    .forEach(function (f) { f(); });
  [closeCardAndFocus].filter(function () { return [e.key === 'Escape', !card.hidden].every(Boolean); })
    .forEach(function (f) { f(); });
});

// Every change of who is signed in — the first look on loading too — redraws the bar.
client.auth.onAuthStateChange(function (event, session) {
  show(accountView(session));
});
