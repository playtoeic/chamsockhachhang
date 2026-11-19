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

/** Facebook Messenger của Trang (research.md R1). Kết nối Trang đầu tiên chủ quản lý. */
export const facebook: ChannelAdapter = {
  platform: "facebook",
  label: "Facebook",
  replyWindowHours: metaReplyWindowHours,

  beginConnect: (redirectUri, state) =>
    metaLoginUrl(redirectUri, state, ["pages_show_list", "pages_manage_metadata", "pages_messaging"]),

  async completeConnect(params, redirectUri) {
    const pages = await metaPagesFromCode(params, redirectUri);
    const page = pages[0];
    if (!page) throw new Error("Tài khoản không quản lý Trang Facebook nào");
    await subscribePage(page);
    return { externalAccountId: page.id, displayName: page.name, credentials: pageCredentials(page) };
  },

  verifyChallenge: metaChallenge,
  verifyWebhook: verifyMetaSignature,
  parseWebhook: (raw) => parseMetaWebhook(raw, "page"),
  sendText: metaSendText,
  fetchMedia: (_c, ref) => fetchUrlMedia(ref),
  fetchProfile: (c, userId) => metaFetchProfile(c, userId, "name,profile_pic"),
};
