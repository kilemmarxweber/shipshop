export const appConfigQuery = `*[_id == "appConfig"][0]{
  montage{
    clipSeconds,
    maxImages,
    motions
  },
  nsfw{
    forbidden,
    blockedLabels,
    rejectFr,
    rejectEn,
    rejectPt
  },
  experimentId
}`;

export const seoDefaultsQuery = `*[_id == "seoDefaults"][0]{
  titleTemplate,
  description,
  faq[]{ question, answer }
}`;

export const catalogTracksQuery = `*[_type == "catalogTrack" && isActive != false && defined(audio.asset)]|order(title asc){
  _id,
  title,
  artist,
  mood,
  durationMs,
  "audioUrl": audio.asset->url
}`;
