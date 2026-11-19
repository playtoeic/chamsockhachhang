import { instagram } from "@/server/channels/instagram";
import { metaContract } from "./meta-contract";

metaContract(instagram, {
  fixtures: "instagram",
  accountId: "17841400000000000",
  userId: "IGSID_33333",
  profileFields: "name,username,profile_pic",
});
