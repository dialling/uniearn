// Reviewed runner contact can be present even when the general profile is blank.
// Keep the application real name private; trips use the existing display name.
module.exports = account => {
  const p = account && account.profile || {}, v = account && account.verification || {};
  const phone = value => String(value || '').replace(/\s/g, '');
  const reviewed = v.status === 'verified' ? phone(v.phone) : '';
  const candidates = [reviewed, phone(p.phone), phone(account && account.wechatPhone), phone(p.wechatPhone)];
  return {name: String(p.name || '').trim() || 'Runner', phone: candidates.find(value => /^1\d{10}$/.test(value)) || ''};
};
