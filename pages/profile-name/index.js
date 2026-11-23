const store = require('../../utils/store');
const account = require('../../utils/account');
const orders = require('../../utils/orders');
const images = require('../../utils/image-input');

Page({
  data: {zh:true, dark:false, draft:'', initial:'U', canSave:false, saving:false, error:'', avatar:'', avatarBusy:false},
  onLoad() {
    const {language, meAppearance, profile} = store.get();
    if (!profile.onboarded || profile.loggedOut) return wx.navigateBack();
    const zh = language !== 'en';
    const savedName = profile.displayName || profile.name || '';
    this.setData({zh, dark:meAppearance === 'dark', avatar:profile.avatarUrl ? orders.photoURL(profile.avatarUrl) : ''});
    this.updateDraft(savedName);
    wx.setNavigationBarTitle({title:zh ? '修改昵称' : 'Edit display name'});
  },
  updateDraft(draft) {
    const name = draft.trim();
    this.setData({
      draft, initial:Array.from(name || 'U')[0].toUpperCase(),
      canSave:!!name,
      error:''
    });
  },
  input(e) { this.updateDraft(e.detail.value); },
  // The picture saves on its own, so choosing one never needs the name button.
  async pickAvatar() {
    const {zh, avatarBusy} = this.data;
    if (avatarBusy) return;
    let path;
    try { path = await images.chooseImage(['album', 'camera']); } catch (e) { return; }
    this.setData({avatarBusy:true, error:''});
    try {
      const fileID = await orders.upload(await images.compress(path), 'avatar');
      await account.call('saveAvatar', {avatarUrl:fileID});
      orders.sync().catch(() => {});
      this.setData({avatar:path});
      wx.showToast({title:zh ? '头像已更新' : 'Photo updated', icon:'success'});
    } catch (error) {
      this.setData({error:error.message || (zh ? '头像上传失败，请重试。' : 'Could not upload the photo. Try again.')});
    } finally {
      this.setData({avatarBusy:false});
    }
  },
  async removeAvatar() {
    const {zh, avatarBusy} = this.data;
    if (avatarBusy) return;
    this.setData({avatarBusy:true, error:''});
    try {
      await account.call('saveAvatar', {avatarUrl:''});
      orders.sync().catch(() => {});
      this.setData({avatar:''});
      wx.showToast({title:zh ? '已移除头像' : 'Photo removed', icon:'success'});
    } catch (error) {
      this.setData({error:error.message || (zh ? '移除失败，请重试。' : 'Could not remove the photo. Try again.')});
    } finally {
      this.setData({avatarBusy:false});
    }
  },
  async save() {
    const {zh, canSave, saving, draft} = this.data;
    if (!canSave || saving) return;
    const displayName = draft.trim();
    if (displayName.length > 60 || /[\u0000-\u001f\u007f]/.test(displayName)) {
      this.setData({error:zh ? '请输入 1–60 个字符的昵称。' : 'Enter a name of 1–60 characters.'});
      return;
    }
    this.setData({saving:true, error:''});
    try {
      await account.call('saveDisplayName', {displayName});
      orders.sync().catch(() => {});
      wx.navigateBack();
      wx.showToast({title:zh ? '昵称已更新' : 'Name updated', icon:'success'});
    } catch (error) {
      this.setData({error:error.message || (zh ? '保存失败，请重试。' : 'Could not save. Try again.')});
    } finally {
      this.setData({saving:false});
    }
  }
});
