export function openNotice(title, message) {
  return openAdminModal({ title, message, mode: 'notice' });
}

export function openConfirm(title, message, options = {}) {
  return openAdminModal({ title, message, mode: 'confirm', danger: options.danger === true, confirmText: options.confirmText || 'Confirm' });
}

export function openForm(title, message, fields = [], options = {}) {
  return openAdminModal({ title, message, mode: 'form', fields, confirmText: options.confirmText || 'Save' });
}

function openAdminModal(config) {
  ensureAdminModal();
  const modal = document.getElementById('adminActionModal');
  const form = document.getElementById('adminActionForm');
  const title = document.getElementById('adminActionTitle');
  const message = document.getElementById('adminActionMessage');
  const fields = document.getElementById('adminActionFields');
  const confirm = document.getElementById('adminActionConfirm');
  const cancel = document.getElementById('adminActionCancel');
  const close = document.getElementById('adminActionClose');

  title.textContent = config.title || 'Admin Action';
  message.textContent = config.message || '';
  fields.innerHTML = (config.fields || []).map(renderField).join('');
  confirm.textContent = config.confirmText || (config.mode === 'notice' ? 'Done' : 'Confirm');
  confirm.className = config.danger ? 'btn danger' : 'btn primary';
  cancel.style.display = config.mode === 'notice' ? 'none' : '';
  modal.classList.add('show');

  return new Promise(resolve => {
    const finish = value => {
      modal.classList.remove('show');
      form.onsubmit = null;
      cancel.onclick = null;
      close.onclick = null;
      resolve(value);
    };
    cancel.onclick = () => finish(null);
    close.onclick = () => finish(null);
    form.onsubmit = event => {
      event.preventDefault();
      if (config.mode === 'notice') return finish(true);
      if (config.mode === 'confirm') return finish(true);
      const result = {};
      for (const field of config.fields || []) {
        const input = form.querySelector(`[name="${field.name}"]`);
        result[field.name] = input ? input.value.trim() : '';
        if (field.required && !result[field.name]) return;
      }
      finish(result);
    };
  });
}

function renderField(field) {
  const value = escapeHtml(field.value || '');
  if (field.type === 'textarea') {
    return `<label>${escapeHtml(field.label)}<textarea name="${escapeHtml(field.name)}" rows="5" ${field.required ? 'required' : ''}>${value}</textarea></label>`;
  }
  if (field.type === 'select') {
    const options = (field.options || []).map(option => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(field.value || '') ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
    return `<label>${escapeHtml(field.label)}<select name="${escapeHtml(field.name)}" ${field.required ? 'required' : ''}>${options}</select></label>`;
  }
  return `<label>${escapeHtml(field.label)}<input name="${escapeHtml(field.name)}" value="${value}" ${field.required ? 'required' : ''}></label>`;
}

function ensureAdminModal() {
  if (document.getElementById('adminActionModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="admin-action-modal" id="adminActionModal">
      <div class="admin-action-backdrop"></div>
      <section class="admin-action-card">
        <button class="admin-action-close" id="adminActionClose" type="button">×</button>
        <p class="eyebrow">Admin Action</p>
        <h2 id="adminActionTitle">Admin Action</h2>
        <p class="muted" id="adminActionMessage"></p>
        <form id="adminActionForm">
          <div id="adminActionFields"></div>
          <div class="admin-action-buttons">
            <button class="btn" id="adminActionCancel" type="button">Cancel</button>
            <button class="btn primary" id="adminActionConfirm" type="submit">Confirm</button>
          </div>
        </form>
      </section>
    </div>
  `);
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}
