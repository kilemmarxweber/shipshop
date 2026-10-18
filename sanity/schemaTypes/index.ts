import { appConfigType } from "./appConfig";
import { catalogTrackType } from "./catalogTrack";
import { catalogMediaType, helpPageType, legalPageType } from "./legalPage";
import { reviewQueueItemType } from "./reviewQueueItem";
import { seoDefaultsType } from "./seoDefaults";

export const schemaTypes = [
  appConfigType,
  seoDefaultsType,
  catalogTrackType,
  catalogMediaType,
  legalPageType,
  helpPageType,
  reviewQueueItemType,
];

export const singletonTypes = new Set(["appConfig", "seoDefaults"]);
