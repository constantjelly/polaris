(function () {
  'use strict';

  let editingId = null;
  let uploadedFile = null;
  let uploadedUrl = null;

  const overlay = document.getElementById('login-overlay');
  const panel = document.getElementById('admin-panel');
  const loginTitle = document.getElementById('admin-login-title');
  const loginDesc = document.getElementById('admin-login-desc');
  const loginBtn = document.getElementById('admin-login-btn');
  const loginError = document.getElementById('login-error');
  const loginLoading = document.getElementById('admin-login-loading');
  const logoutLink = document.getElementById('logout-link');
  const welcomeEl = document.getElementById('admin-welcome');

  // Article form elements
  const articleForm = document.getElementById('article-form');
  const articlePage = document.getElementById('article-page');
  const articleTitle = document.getElementById('article-title');
  const articleContent = document.getElementById('article-content');
  const articleImage = document.getElementById('article-image');
  const imagePreview = document.getElementById('image-preview');
  const previewImg = document.getElementById('preview-img');
  const removeImageBtn = document.getElementById('remove-image');
  const publishBtn = document.getElementById('publish-btn');
  const articlesList = document.getElementById('articles-list');
  const filterPage = document.getElementById('filter-page');
  const tabs = document.querySelectorAll('.admin-tab');
  const tabContents = document.querySelectorAll('.admin-tab-content');
  const approvalsList = document.getElementById('approvals-list');
  const galleryList = document.getElementById('gallery-list');
  const articleApprovalsList = document.getElementById('article-approvals-list');

  function setStatus(msg, isError) {
    const statusMsg = document.getElementById('status-msg');
    if (!statusMsg) return;
    statusMsg.textContent = msg;
    statusMsg.style.color = isError ? '#ef4444' : '#22c55e';
    setTimeout(() => { if (statusMsg) statusMsg.textContent = ''; }, 4000);
  }

  function showTab(tabId) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    tabContents.forEach(tc => tc.classList.toggle('active', tc.id === 'tab-' + tabId));
  }

  tabs.forEach(tab => tab.addEventListener('click', () => {
    showTab(tab.dataset.tab);
    if (tab.dataset.tab === 'approvals') renderApprovals();
    if (tab.dataset.tab === 'gallery') renderGallery();
    if (tab.dataset.tab === 'article-approvals') renderArticleApprovals();
  }));

  function showOverlay() {
    overlay.style.display = 'flex';
    panel.style.display = 'none';
  }

  function showPanel() {
    overlay.style.display = 'none';
    panel.style.display = 'block';
  }

  logoutLink.addEventListener('click', async e => {
    e.preventDefault();
    await AUTH.signOut();
  });

  loginBtn.addEventListener('click', () => {
    AUTH.signIn(window.location.href);
  });

  async function checkAccess() {
    const profile = AUTH.getProfile();
    if (!profile) {
      loginTitle.textContent = 'SIGN IN REQUIRED';
      loginDesc.textContent = 'Sign in with Google to continue.';
      loginBtn.style.display = 'inline-block';
      loginLoading.style.display = 'none';
      showOverlay();
      return;
    }

    if (!AUTH.isAdmin()) {
      loginTitle.textContent = 'ACCESS DENIED';
      loginDesc.textContent = 'Only admins can access this page.';
      loginBtn.style.display = 'none';
      loginLoading.style.display = 'none';
      showOverlay();
      return;
    }

    welcomeEl.textContent = 'Logged in as @' + profile.username;
    showPanel();
    renderArticles();
  }

  document.addEventListener('auth-ready', checkAccess);

  // ---- Article image handling ----
  articleImage.addEventListener('change', () => {
    const file = articleImage.files[0];
    if (!file) return;
    uploadedFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      previewImg.src = e.target.result;
      imagePreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });

  removeImageBtn.addEventListener('click', () => {
    uploadedFile = null;
    uploadedUrl = null;
    articleImage.value = '';
    imagePreview.style.display = 'none';
  });

  async function uploadImage(file) {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const { error } = await polarisDb.storage
      .from('article-images')
      .upload(`public/${fileName}`, file);
    if (error) throw error;
    const { data } = polarisDb.storage
      .from('article-images')
      .getPublicUrl(`public/${fileName}`);
    return data.publicUrl;
  }

  async function resetForm() {
    articleForm.reset();
    editingId = null;
    uploadedFile = null;
    uploadedUrl = null;
    imagePreview.style.display = 'none';
    publishBtn.textContent = 'PUBLISH ARTICLE';
    publishBtn.disabled = false;
    articleTitle.focus();
  }

  articleForm.addEventListener('submit', async e => {
    e.preventDefault();
    const title = articleTitle.value.trim();
    const content = articleContent.value.trim();
    const page = articlePage.value;
    if (!title || !content) return;

    publishBtn.textContent = 'SAVING...';
    publishBtn.disabled = true;

    try {
      let imageUrl = uploadedUrl;
      if (uploadedFile) {
        imageUrl = await uploadImage(uploadedFile);
      }

      const article = {
        title,
        content,
        page,
        image_url: imageUrl || null,
        date: new Date().toISOString(),
        published: true,
      };

      if (editingId) {
        const { error } = await polarisDb
          .from('articles')
          .update(article)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await polarisDb
          .from('articles')
          .insert(article);
        if (error) throw error;
      }

      setStatus('Article saved successfully!');
      await resetForm();
      await renderArticles();
      showTab('manage');
    } catch (err) {
      setStatus('Error: ' + err.message, true);
      publishBtn.textContent = editingId ? 'UPDATE ARTICLE' : 'PUBLISH ARTICLE';
      publishBtn.disabled = false;
    }
  });

  async function renderArticles() {
    let query = polarisDb.from('articles').select('*').order('date', { ascending: false });
    const filter = filterPage.value;
    if (filter !== 'all') {
      query = query.eq('page', filter);
    }

    const { data: articles, error } = await query;
    if (error) {
      articlesList.innerHTML = '<p style="color:#ef4444;text-align:center;padding:2rem;">Failed to load articles.</p>';
      return;
    }

    if (!articles || !articles.length) {
      articlesList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem;">No articles yet.</p>';
      return;
    }

    articlesList.innerHTML = articles.map(a => {
      const pageLabel = { facts: 'Space Facts', nights: 'Starry Nights', exams: 'Exams & Scholarships' }[a.page] || a.page;
      const dateStr = new Date(a.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return `
        <div class="admin-article-card">
          <div class="admin-article-info">
            <span class="admin-article-tag">${pageLabel}</span>
            <strong>${a.title}</strong>
            <span class="admin-article-meta">${dateStr}</span>
          </div>
          <div class="admin-article-actions">
            <button class="admin-btn small" data-edit="${a.id}">EDIT</button>
            <button class="admin-btn small danger" data-delete="${a.id}">DELETE</button>
          </div>
        </div>
      `;
    }).join('');

    articlesList.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => editArticle(parseInt(btn.dataset.edit)));
    });
    articlesList.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteArticle(parseInt(btn.dataset.delete)));
    });
  }

  filterPage.addEventListener('change', renderArticles);

  async function editArticle(id) {
    const { data, error } = await polarisDb.from('articles').select('*').eq('id', id).single();
    if (error || !data) return;
    const article = data;

    editingId = id;
    articlePage.value = article.page;
    articleTitle.value = article.title;
    articleContent.value = article.content;
    uploadedUrl = article.image_url;

    if (article.image_url) {
      previewImg.src = article.image_url;
      imagePreview.style.display = 'flex';
      uploadedFile = null;
    } else {
      uploadedFile = null;
      uploadedUrl = null;
      imagePreview.style.display = 'none';
    }

    publishBtn.textContent = 'UPDATE ARTICLE';
    showTab('new');
    articleTitle.focus();
  }

  async function deleteArticle(id) {
    if (!confirm('Delete this article?')) return;
    const { error } = await polarisDb.from('articles').delete().eq('id', id);
    if (error) {
      setStatus('Failed to delete: ' + error.message, true);
      return;
    }
    setStatus('Article deleted.');
    renderArticles();
  }

  // ---- Photo Approvals ----
  async function renderApprovals() {
    approvalsList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem;font-family:var(--font-serif);">Loading...</p>';

    const { data: submissions, error } = await polarisDb
      .from('submissions')
      .select('*, profiles!submissions_user_id_fkey(username)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      approvalsList.innerHTML = '<p style="color:#ef4444;text-align:center;padding:2rem;">Failed to load submissions.</p>';
      return;
    }

    if (!submissions || !submissions.length) {
      approvalsList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem;font-family:var(--font-serif);">No pending submissions.</p>';
      return;
    }

    approvalsList.innerHTML = submissions.map(s => {
      const dateStr = new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return `
        <div class="approval-card" data-id="${s.id}">
          <div class="approval-img-wrap">
            <img src="${s.image_url}" alt="Submission" class="approval-img" />
          </div>
          <div class="approval-info">
            <div class="approval-meta">
              <span class="approval-user">@${s.profiles?.username || 'unknown'}</span>
              <span class="approval-date">${dateStr}</span>
            </div>
            <p class="approval-desc">${s.description || 'No description'}</p>
            ${s.location ? '<p class="approval-location">📍 ' + s.location + '</p>' : ''}
            <div class="approval-actions">
              <button class="admin-btn small approval-approve">APPROVE</button>
              <button class="admin-btn small danger approval-reject">REJECT</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    approvalsList.querySelectorAll('.approval-approve').forEach(btn => {
      btn.addEventListener('click', async function () {
        const card = this.closest('.approval-card');
        const id = parseInt(card.dataset.id);
        await reviewSubmission(id, 'approved', card);
      });
    });

    approvalsList.querySelectorAll('.approval-reject').forEach(btn => {
      btn.addEventListener('click', async function () {
        const card = this.closest('.approval-card');
        const id = parseInt(card.dataset.id);
        await reviewSubmission(id, 'rejected', card);
      });
    });
  }

  async function reviewSubmission(id, status, cardEl) {
    const profile = AUTH.getProfile();
    if (!profile) return;

    cardEl.style.opacity = '0.5';

    const { error } = await polarisDb
      .from('submissions')
      .update({
        status: status,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      cardEl.style.opacity = '1';
      setStatus('Error: ' + error.message, true);
      return;
    }

    cardEl.style.transition = 'opacity 0.3s, transform 0.3s';
    cardEl.style.opacity = '0';
    cardEl.style.transform = 'translateX(30px)';
    setTimeout(() => cardEl.remove(), 300);
    setStatus('Submission ' + status + '.');
  }

  async function renderGallery() {
    galleryList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem;font-family:var(--font-serif);">Loading...</p>';

    const { data: submissions, error } = await polarisDb
      .from('submissions')
      .select('*, profiles!submissions_user_id_fkey(username)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      galleryList.innerHTML = '<p style="color:#ef4444;text-align:center;padding:2rem;">Failed to load gallery photos.</p>';
      return;
    }

    if (!submissions || !submissions.length) {
      galleryList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem;font-family:var(--font-serif);">No approved gallery photos.</p>';
      return;
    }

    galleryList.innerHTML = submissions.map(s => {
      const dateStr = new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return `
        <div class="approval-card" data-id="${s.id}">
          <div class="approval-img-wrap">
            <img src="${s.image_url}" alt="Submission" class="approval-img" />
          </div>
          <div class="approval-info">
            <div class="approval-meta">
              <span class="approval-user">@${s.profiles?.username || 'unknown'}</span>
              <span class="approval-date">${dateStr}</span>
            </div>
            <p class="approval-desc">${s.description || 'No description'}</p>
            ${s.location ? '<p class="approval-location">' + s.location + '</p>' : ''}
            <div class="approval-actions">
              <button class="admin-btn small danger gallery-delete">DELETE FROM GALLERY</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    galleryList.querySelectorAll('.gallery-delete').forEach(btn => {
      btn.addEventListener('click', async function () {
        const card = this.closest('.approval-card');
        const id = parseInt(card.dataset.id);
        await deleteGallerySubmission(id, card);
      });
    });
  }

  async function deleteGallerySubmission(id, cardEl) {
    if (!confirm('Delete this approved photo from the gallery?')) return;
    cardEl.style.opacity = '0.5';

    const { error } = await polarisDb
      .from('submissions')
      .delete()
      .eq('id', id)
      .eq('status', 'approved');

    if (error) {
      cardEl.style.opacity = '1';
      setStatus('Error: ' + error.message, true);
      return;
    }

    cardEl.remove();
    setStatus('Gallery photo deleted.');
  }

  async function renderArticleApprovals() {
    articleApprovalsList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem;font-family:var(--font-serif);">Loading...</p>';

    const { data: articles, error } = await polarisDb
      .from('article_submissions')
      .select('*, profiles!article_submissions_user_id_fkey(username)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      articleApprovalsList.innerHTML = '<p style="color:#ef4444;text-align:center;padding:2rem;">Failed to load article submissions.</p>';
      return;
    }

    if (!articles || !articles.length) {
      articleApprovalsList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem;font-family:var(--font-serif);">No pending article submissions.</p>';
      return;
    }

    const pageLabels = { facts: 'Space Facts', nights: 'Starry Nights', exams: 'Exams & Scholarships' };
    articleApprovalsList.innerHTML = articles.map(a => {
      const dateStr = new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return `
        <div class="approval-card" data-id="${a.id}">
          <div class="approval-info">
            <div class="approval-meta">
              <span class="approval-user">@${a.profiles?.username || 'unknown'}</span>
              <span class="approval-date">${dateStr}</span>
              <span class="approval-date">${pageLabels[a.page] || a.page}</span>
            </div>
            <h3 style="font-family:var(--font-display);letter-spacing:0.1em;margin:0.4rem 0;">${a.title}</h3>
            <p class="approval-desc">${a.content.replace(/\n/g, '<br/>')}</p>
            <div class="approval-actions">
              <button class="admin-btn small article-approve">PUBLISH</button>
              <button class="admin-btn small danger article-reject">REJECT</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    articleApprovalsList.querySelectorAll('.article-approve').forEach(btn => {
      btn.addEventListener('click', async function () {
        const card = this.closest('.approval-card');
        const id = parseInt(card.dataset.id);
        await reviewArticleSubmission(id, 'approved', card);
      });
    });

    articleApprovalsList.querySelectorAll('.article-reject').forEach(btn => {
      btn.addEventListener('click', async function () {
        const card = this.closest('.approval-card');
        const id = parseInt(card.dataset.id);
        await reviewArticleSubmission(id, 'rejected', card);
      });
    });
  }

  async function reviewArticleSubmission(id, status, cardEl) {
    cardEl.style.opacity = '0.5';

    const { data: submission, error: fetchError } = await polarisDb
      .from('article_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !submission) {
      cardEl.style.opacity = '1';
      setStatus('Error: failed to load article submission.', true);
      return;
    }

    if (status === 'approved') {
      const { error: publishError } = await polarisDb
        .from('articles')
        .insert({
          title: submission.title,
          content: submission.content,
          page: submission.page,
          image_url: null,
          date: new Date().toISOString(),
          published: true,
        });
      if (publishError) {
        cardEl.style.opacity = '1';
        setStatus('Error: ' + publishError.message, true);
        return;
      }
    }

    const { error: updateError } = await polarisDb
      .from('article_submissions')
      .update({ status: status, reviewed_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      cardEl.style.opacity = '1';
      setStatus('Error: ' + updateError.message, true);
      return;
    }

    cardEl.remove();
    setStatus(status === 'approved' ? 'Article published.' : 'Article rejected.');
  }

  // Add status message element
  const statusDiv = document.createElement('div');
  statusDiv.id = 'status-msg';
  statusDiv.style.cssText = 'margin:-1.5rem 0 2rem;font-family:var(--font-body);font-size:0.7rem;letter-spacing:0.1em;text-align:center;';
  document.querySelector('.admin-tabs')?.insertAdjacentElement('afterend', statusDiv);
})();
