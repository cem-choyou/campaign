import { describe, expect, it } from "vitest";
import { extractYoutubeId } from "@/lib/youtube";

describe("extractYoutubeId", () => {
  const id = "dQw4w9WgXcQ";
  it.each([
    [`https://www.youtube.com/watch?v=${id}`],
    [`https://youtube.com/watch?v=${id}&t=42s`],
    [`https://m.youtube.com/watch?v=${id}`],
    [`https://youtu.be/${id}`],
    [`https://youtu.be/${id}?si=abc`],
    [`https://www.youtube.com/shorts/${id}`],
    [`https://www.youtube.com/embed/${id}`],
    [`https://studio.youtube.com/video/${id}/edit`],
    [`youtube.com/watch?v=${id}`],
    [id],
  ])("reads %s", (input) => {
    expect(extractYoutubeId(input)).toBe(id);
  });

  it.each([
    [""],
    ["https://vimeo.com/123"],
    ["https://www.youtube.com/@itforbusiness"],
    ["not a url"],
  ])("rejects %s", (input) => {
    expect(extractYoutubeId(input)).toBeNull();
  });
});
