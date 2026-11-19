import {
  fetchUrlMedia,
  metaChallenge,
  metaFetchProfile,
  metaLoginUrl,
  metaPagesFromCode,
  metaReplyWindowHours,
  metaSendText,
  pageCredentials,
  parseMetaWebhook,
  subscribePage,
  verifyMetaSignature,
} from "./meta";
import type { ChannelAdapter } from "./types";

/**
 * Instagram Messaging qua Trang Facebook liên kết với tài khoản Instagram chuyên nghiệp.
 * Kết nối tài khoản Instagram đầu tiên tìm thấy trên các Trang của chủ.
 */
export const instagram: ChannelAdapter = {
  platform: "instagram",
  label: "Instagram",
  replyWindowHours: metaReplyWindowHours,

  beginConnect: (redirectUri, state) =>
    metaLoginUrl(redirectUri, state, [
      "pages_show_list",
      "pages_manage_metadata",
      "pages_messaging",
      "instagram_basic",
      "instagram_manage_messages",
    ]),

  async completeConnect(params, redirectUri) {
    const pages = await metaPagesFromCode(params, redirectUri);
    const page = pages.find((p) => p.instagram_business_account);
    if (!page?.instagram_business_account) {
      throw new Error("Không tìm thấy tài khoản Instagram chuyên nghiệp liên kết với Trang nào");
    }
    await subscribePage(page);
    const ig = page.instagram_business_account;
    return {
      externalAccountId: ig.id,
      displayName: ig.username ? `@${ig.username}` : (ig.name ?? page.name),
      credentials: { ...pageCredentials(page), igId: ig.id },
    };
  },

  verifyChallenge: metaChallenge,
  verifyWebhook: verifyMetaSignature,
  parseWebhook: (raw) => parseMetaWebhook(raw, "instagram"),
  sendText: metaSendText,
  fetchMedia: (_c, ref) => fetchUrlMedia(ref),
  fetchProfile: (c, userId) => metaFetchProfile(c, userId, "name,username,profile_pic"),
};
