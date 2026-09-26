import { describe, expect, it } from "vitest";
import {
  ImageService,
  PollinationsImageProvider,
  OpenAIImageProvider,
  ImageProviderUnavailableError,
} from "../src/images/image.service.js";

describe("ImageService and ImageProviders", () => {
  it("PollinationsImageProvider calculates correct aspect ratio dimensions", async () => {
    const provider = new PollinationsImageProvider();
    expect(await provider.isAvailable()).toBe(true);

    const result = await provider.generate({
      prompt: "A beautiful mountain lake at sunset",
      aspectRatio: "16:9",
      numberOfImages: 1,
    });

    expect(result.prompt).toBe("A beautiful mountain lake at sunset");
    expect(result.modelUsed).toBe("pollinations-flux");
    expect(result.images.length).toBe(1);
    expect(result.images[0].width).toBe(1280);
    expect(result.images[0].height).toBe(720);
    expect(result.images[0].url).toContain("pollinations.ai");
  });

  it("OpenAIImageProvider requires an API key", async () => {
    const withoutKey = new OpenAIImageProvider("");
    expect(await withoutKey.isAvailable()).toBe(false);
    await expect(withoutKey.generate({ prompt: "test" })).rejects.toThrow(ImageProviderUnavailableError);
  });

  it("ImageService disabled state returns false for isAvailable and throws error on generate", async () => {
    const disabledService = new ImageService({ enabled: false });
    expect(await disabledService.isAvailable()).toBe(false);

    await expect(disabledService.generateImage({ prompt: "test" })).rejects.toThrow(
      ImageProviderUnavailableError
    );
  });

  it("ImageService default configuration uses Pollinations and is available", async () => {
    const defaultService = new ImageService();
    expect(await defaultService.isAvailable()).toBe(true);
  });
});
