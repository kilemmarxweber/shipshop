"use client";

import { useEffect } from "react";

function resetFeedScroll() {
  document
    .querySelectorAll(".feed-product-list, .feed-snap, .app-main")
    .forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.scrollTop = 0;
      node.scrollLeft = 0;
    });
}

/**
 * Portrait = 1 card (reel). Landscape / tablette = 2 cards.
 * Au rotate, iOS change le scroller (snap → grille) : on recalage le scroll.
 */
export function useFeedOrientation() {
  useEffect(() => {
    const onTurn = () => {
      window.setTimeout(resetFeedScroll, 60);
      window.setTimeout(resetFeedScroll, 280);
    };
    const mq = window.matchMedia("(orientation: landscape)");
    mq.addEventListener("change", onTurn);
    window.addEventListener("orientationchange", onTurn);
    return () => {
      mq.removeEventListener("change", onTurn);
      window.removeEventListener("orientationchange", onTurn);
    };
  }, []);
}
