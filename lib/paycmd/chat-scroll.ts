export const AUTO_SCROLL_BOTTOM_THRESHOLD = 56;

type ViewportMetrics = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
};

type ScrollableViewport = {
  scrollHeight: number;
  scrollTo: (options: ScrollToOptions) => void;
};

export function isNearViewportBottom(viewport: ViewportMetrics) {
  return (
    viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
    AUTO_SCROLL_BOTTOM_THRESHOLD
  );
}

export function jumpToLatestMessage(
  viewport: ScrollableViewport,
  prefersReducedMotion: boolean,
) {
  viewport.scrollTo({
    top: viewport.scrollHeight,
    behavior: prefersReducedMotion ? "auto" : "smooth",
  });
}
