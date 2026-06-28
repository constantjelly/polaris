(function () {
  'use strict';

  let currentUser = null;
  let currentProfile = null;

  async function init() {
    const { data: { session }, error } = await polarisDb.auth.getSession();
    if (error || !session) {
      currentUser = null;
      currentProfile = null;
      updateNavUI(null, null);
      document.dispatchEvent(new CustomEvent('auth-ready'));
      return;
    }

    currentUser = session.user;
    try {
      const { data: profile, error: profileErr } = await polarisDb
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      currentProfile = profileErr ? null : profile;
    } catch {
      currentProfile = null;
    }

    updateNavUI(currentUser, currentProfile);
    document.dispatchEvent(new CustomEvent('auth-ready'));
  }

  function updateNavUI(user, profile) {
    const el = document.getElementById('nav-auth');
    if (!el) return;

    if (!user) {
      el.textContent = 'LOGIN';
      el.href = '#';
      el.onclick = async function (e) {
        e.preventDefault();
        await signIn();
      };
      return;
    }

    if (profile && profile.username) {
      el.textContent = profile.username.toUpperCase();
      el.href = 'profile.html?username=' + encodeURIComponent(profile.username);
      el.onclick = null;
    } else {
      el.textContent = 'SETUP';
      el.href = 'join.html';
      el.onclick = null;
    }
  }

  function injectNavLink() {
    if (document.getElementById('nav-auth')) return;
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    const li = document.createElement('li');
    li.innerHTML = '<a href="#" id="nav-auth">LOGIN</a>';
    navLinks.appendChild(li);
  }

  async function signIn(redirectTo) {
    const redirect = redirectTo || window.location.href;
    const { error } = await polarisDb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/join.html?redirect=' + encodeURIComponent(redirect),
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    await polarisDb.auth.signOut();
    window.location.reload();
  }

  async function checkUsername(username) {
    const { data, error } = await polarisDb
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (error) throw error;
    return !data;
  }

  async function setUsername(username) {
    if (!currentUser) throw new Error('Not authenticated');
    const { error } = await polarisDb
      .from('profiles')
      .update({ username: username.toLowerCase() })
      .eq('id', currentUser.id);
    if (error) throw error;
    if (currentProfile) currentProfile.username = username.toLowerCase();
  }

  async function updateProfile(fields) {
    if (!currentUser) throw new Error('Not authenticated');
    const { error } = await polarisDb
      .from('profiles')
      .update(fields)
      .eq('id', currentUser.id);
    if (error) throw error;
    currentProfile = { ...(currentProfile || {}), ...fields };
  }

  function getUser() { return currentUser; }
  function getProfile() { return currentProfile; }
  function isAdmin() { return currentProfile && currentProfile.is_admin === true; }

  // Listen for OAuth redirect result
  polarisDb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectNavLink();
      init();
    });
  } else {
    injectNavLink();
    init();
  }

  window.AUTH = {
    init,
    signIn,
    signOut,
    checkUsername,
    setUsername,
    updateProfile,
    getUser,
    getProfile,
    isAdmin,
  };
})();
