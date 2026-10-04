// Sign-in, in the site bar of every page. Signed out, a Sign in button beside the burger; signed
// in, the player's picture, opening a menu with their email and Sign out. Supabase's library is
// vendored (vendor/supabase.js), and its address and public key are the only values the site holds
// — the database's own rules keep every player's progress theirs. Its rules are core/auth-core.js's.
import { returnAddress, accountView } from '../core/auth-core.js';

var SUPABASE_URL = 'https://vxschtygvtilsadgixec.supabase.co';
var SUPABASE_PUBLIC_KEY = 'PASTE-THE-PUBLISHABLE-KEY';

var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, { auth: { flowType: 'pkce' } });

var account = document.createElement('div');
account.className = 'account';
account.innerHTML =
  '<button class="sign-in" type="button" aria-label="Sign in" hidden>' +
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="7" r="3.5"/><path d="M3.5 17c1-3.5 3.6-5 6.5-5s5.5 1.5 6.5 5"/></svg>' +
    '<span>Sign in</span>' +
  '</button>' +
  '<button class="avatar" type="button" aria-expanded="false" aria-controls="account-menu" aria-label="Account" hidden>' +
    '<img alt="" referrerpolicy="no-referrer" hidden><span class="initial"></span>' +
  '</button>' +
  '<div class="account-panel" id="account-menu" hidden>' +
    '<p class="signed-in-as">Signed in as <strong></strong></p>' +
    '<button class="sign-out" type="button">Sign out</button>' +
  '</div>';
document.querySelector('[data-site-bar] .menu').before(account);

var avatar = account.querySelector('.avatar');
var picture = avatar.querySelector('img');
var initial = avatar.querySelector('.initial');
var panel = account.querySelector('.account-panel');
var FACE = { true: showPicture, false: showInitial };

function show(view) {
  account.querySelector('.sign-in').hidden = view.signedIn;
  avatar.hidden = !view.signedIn;
  initial.textContent = view.initial;
  account.querySelector('.signed-in-as strong').textContent = view.email;
  FACE[Boolean(view.picture)](view);
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

function setPanel(open) {
  panel.hidden = !open;
  avatar.setAttribute('aria-expanded', String(open));
}

function closeAndFocus() {
  setPanel(false);
  avatar.focus();
}

account.querySelector('.sign-in').addEventListener('click', function () {
  client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: returnAddress(location.href), queryParams: { prompt: 'select_account' } },
  });
});
account.querySelector('.sign-out').addEventListener('click', function () {
  client.auth.signOut({ scope: 'local' });
});
avatar.addEventListener('click', function () { setPanel(panel.hidden); });
picture.addEventListener('error', showInitial);

// Captured, so a click anywhere else closes the menu — the burger's own click included.
document.addEventListener('click', function (e) {
  [setPanel].filter(function () { return !account.contains(e.target); }).forEach(function (f) { f(false); });
}, true);
document.addEventListener('keydown', function (e) {
  [closeAndFocus].filter(function () { return [e.key === 'Escape', !panel.hidden].every(Boolean); })
    .forEach(function (f) { f(); });
});

// Every change of who is signed in — the first look on loading too — redraws the bar, and takes off
// the address whatever the sign-in left there, once Supabase has read it.
client.auth.onAuthStateChange(function (event, session) {
  history.replaceState(history.state, '', returnAddress(location.href));
  show(accountView(session));
});
