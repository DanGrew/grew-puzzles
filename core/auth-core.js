// Sign-in's rules: the page Google sends a player back to, and how the site bar shows who is
// signed in. Who may reach a player's progress is the database's rule, never the site's
// (grew-puzzles-tooling's docs/DATABASE.md).

// The page a player started on, without anything a sign-in leaves on its address on the way back:
// Supabase's one-time code, or Google's word that the player cancelled. The site never uses an
// address's #, so that goes too.
export function returnAddress(href) {
  const url = new URL(href);
  ['code', 'error', 'error_code', 'error_description'].forEach(key => url.searchParams.delete(key));
  url.hash = '';
  return url.href;
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
