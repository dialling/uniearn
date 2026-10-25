// Reviewed runner contact can be present even when the general profile is blank.
// Keep the application real name private; trips use the existing display name.
module.exports = account => {
  const p = account && account.profile || {}, v = account && account.verification || {};
  const phone = value => String(value || '').replace(/\s/g, '');
  const reviewed = v.status === 'verified' ? phone(v.phone) : '';
  return {name: String(p.name || '').trim() || 'Runner', phone: /^1\d{10}$/.test(reviewed) ? reviewed : phone(p.phone)};
};
