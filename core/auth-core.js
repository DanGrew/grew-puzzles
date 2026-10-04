// Sign-in's rules: the fingerprint of the one-time word that ties Google's answer to this page,
// and how the site bar shows who is signed in. Who may reach a player's progress is the
// database's rule, never the site's (grew-puzzles-tooling's docs/DATABASE.md).

// Google is handed the fingerprint of a one-time word, Supabase the word itself, so a token
// Google signs for this page can't be replayed on another. The fingerprint is SHA-256's bytes
// written as lower-case hex, two digits a byte — the form Supabase checks against.
export function hexOf(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

// What the site bar shows. Signed out, the Sign in button. Signed in, the player's Google picture,
// or their initial in a circle when Google gives none, opening a menu with their email.
export function accountView(session) {
  const signedOut = { signedIn: false, picture: '', initial: '', email: '' };
  return session ? signedIn(session.user) : signedOut;
}

function signedIn(user) {
  const name = user.user_metadata.full_name || user.email;
  return {
    signedIn: true,
    picture: user.user_metadata.avatar_url || '',
    initial: Array.from(name)[0].toUpperCase(),
    email: user.email,
  };
}
