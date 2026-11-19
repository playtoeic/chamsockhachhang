import { facebook } from "@/server/channels/facebook";
import { metaContract } from "./meta-contract";

metaContract(facebook, {
  fixtures: "facebook",
  accountId: "1111111111",
  userId: "2222222222",
  profileFields: "name,profile_pic",
});
