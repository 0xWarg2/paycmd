import assert from "node:assert/strict";
import test from "node:test";

import { isNearViewportBottom, jumpToLatestMessage } from "./chat-scroll.ts";

test("shows the latest-message control once the viewport is 56px from the bottom", () => {
  assert.equal(
    isNearViewportBottom({ scrollHeight: 1_000, scrollTop: 444, clientHeight: 500 }),
    false,
  );
  assert.equal(
    isNearViewportBottom({ scrollHeight: 1_000, scrollTop: 445, clientHeight: 500 }),
    true,
  );
});

test("jumps smoothly to the latest message unless reduced motion is requested", () => {
  const calls: ScrollToOptions[] = [];
  const viewport = {
    scrollHeight: 1_200,
    scrollTo: (options: ScrollToOptions) => calls.push(options),
  };

  jumpToLatestMessage(viewport, false);
  jumpToLatestMessage(viewport, true);

  assert.deepEqual(calls, [
    { top: 1_200, behavior: "smooth" },
    { top: 1_200, behavior: "auto" },
  ]);
});
