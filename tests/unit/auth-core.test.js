import { returnAddress, accountView } from '../../core/auth-core.js';

const player = (metadata) => ({ user: { email: 'pat@example.com', user_metadata: metadata } });

describe('auth-core.js', () => {
  test('a player comes back to the page they started on, its own address untouched', () => {
    expect(returnAddress('https://dangrew.github.io/grew-puzzles/app/play.html?id=WSCH-0042'))
      .toBe('https://dangrew.github.io/grew-puzzles/app/play.html?id=WSCH-0042');
    expect(returnAddress('https://dangrew.github.io/grew-puzzles/app/?type=Collections&sort=title&dir=asc'))
      .toBe('https://dangrew.github.io/grew-puzzles/app/?type=Collections&sort=title&dir=asc');
    expect(returnAddress('https://dangrew.github.io/grew-puzzles/app/'))
      .toBe('https://dangrew.github.io/grew-puzzles/app/');
  });

  test('the one-time code a sign-in brings back leaves the address', () => {
    expect(returnAddress('https://dangrew.github.io/grew-puzzles/app/play.html?id=WSCH-0042&code=abc'))
      .toBe('https://dangrew.github.io/grew-puzzles/app/play.html?id=WSCH-0042');
  });

  test('a cancelled sign-in leaves no trace on the address', () => {
    const back = 'https://dangrew.github.io/grew-puzzles/app/collection.html?slug=issue-1'
      + '&error=access_denied&error_code=422&error_description=The+user+denied+access';
    expect(returnAddress(back)).toBe('https://dangrew.github.io/grew-puzzles/app/collection.html?slug=issue-1');
    expect(returnAddress('https://dangrew.github.io/grew-puzzles/app/?error=access_denied'))
      .toBe('https://dangrew.github.io/grew-puzzles/app/');
    expect(returnAddress('https://dangrew.github.io/grew-puzzles/app/#error=access_denied&error_description=x'))
      .toBe('https://dangrew.github.io/grew-puzzles/app/');
  });

  test('signed out, the site bar shows Sign in and no one', () => {
    expect(accountView(null)).toEqual({ signedIn: false, picture: '', initial: '', email: '' });
  });

  test('signed in, the site bar shows the player\'s Google picture and email', () => {
    expect(accountView(player({ full_name: 'Pat Player', avatar_url: 'https://lh3.example/pat.png' }))).toEqual({
      signedIn: true, picture: 'https://lh3.example/pat.png', initial: 'P', email: 'pat@example.com',
    });
  });

  test('with no picture from Google, the player\'s initial stands in, from their name', () => {
    expect(accountView(player({ full_name: 'élodie Grew' }))).toEqual({
      signedIn: true, picture: '', initial: 'É', email: 'pat@example.com',
    });
  });

  test('with no name from Google either, the initial is their email\'s', () => {
    expect(accountView(player({})).initial).toBe('P');
    expect(accountView({ user: { email: 'zed@example.com', user_metadata: { full_name: '' } } }).initial).toBe('Z');
  });
});
