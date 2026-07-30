import { clientEntry, css, on, type Handle } from "remix/ui";
import { fitImageSize, MAX_IMAGE_EDGE } from "../utils/image.ts";
import { muted } from "./styles.ts";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    image.src = url;
  });
}

function outputType(file: File): { type: string; quality?: number; extension: string } {
  if (file.type === "image/jpeg") return { type: "image/jpeg", quality: 0.92, extension: "jpg" };
  if (file.type === "image/webp") return { type: "image/webp", quality: 0.92, extension: "webp" };
  return { type: "image/png", extension: "png" };
}

function renamedFile(original: string, extension: string): string {
  const base = original.replace(/\.[^.]+$/, "") || "cover";
  return `${base}.${extension}`;
}

async function resizeImageToFit(file: File): Promise<{
  file: File;
  original: { width: number; height: number };
  size: { width: number; height: number };
  resized: boolean;
}> {
  const image = await loadImage(file);
  const original = { width: image.naturalWidth, height: image.naturalHeight };
  const size = fitImageSize(original.width, original.height);
  if (size.width === original.width && size.height === original.height) {
    return { file, original, size, resized: false };
  }

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not resize image");
  context.drawImage(image, 0, 0, size.width, size.height);

  const { type, quality, extension } = outputType(file);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Could not resize image"));
      },
      type,
      quality,
    );
  });

  return {
    file: new File([blob], renamedFile(file.name || "cover", extension), {
      type: blob.type || type,
    }),
    original,
    size,
    resized: true,
  };
}

function assignFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

export const BookImageFields = clientEntry(
  "/app/ui/book-image-fields.tsx",
  function BookImageFields(
    h: Handle<{
      description?: string;
      imageRequired?: boolean;
      existingImageSrc?: string | null;
    }>,
  ) {
    let previewUrl = h.props.existingImageSrc ?? null;
    let objectUrl: string | null = null;
    let message: string | null = null;
    let messageKind: "error" | "notice" = "notice";

    function setPreview(file: File) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      previewUrl = objectUrl;
    }

    async function acceptImage(file: File, input: HTMLInputElement | null, fromPaste: boolean) {
      try {
        const result = await resizeImageToFit(file);
        if (input) assignFile(input, result.file);
        setPreview(result.file);
        messageKind = "notice";
        if (result.resized) {
          message = `Cover resized from ${result.original.width}×${result.original.height} to ${result.size.width}×${result.size.height}.`;
        } else if (fromPaste) {
          message = `Cover set from pasted image (${result.size.width}×${result.size.height}).`;
        } else {
          message = null;
        }
        void h.update();
      } catch {
        if (input && !fromPaste) input.value = "";
        messageKind = "error";
        message = "Could not read that image.";
        if (!fromPaste) previewUrl = h.props.existingImageSrc ?? null;
        void h.update();
      }
    }

    function onPaste(event: Event) {
      const clipboard = event as ClipboardEvent;
      const target = clipboard.target as HTMLTextAreaElement;
      const items = clipboard.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        clipboard.preventDefault();
        const form = target.closest("form");
        const input = form?.querySelector<HTMLInputElement>('input[name="image"]') ?? null;
        void acceptImage(file, input, true);
        return;
      }
    }

    function onFileChange(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      void acceptImage(file, input, false);
    }

    return () => (
      <div mix={css({ display: "flex", flexDirection: "column", gap: "14px" })}>
        <label>
          Cover image
          <input
            type="file"
            name="image"
            accept="image/*"
            required={h.props.imageRequired ? true : undefined}
            mix={on<HTMLInputElement>("change", onFileChange)}
          />
        </label>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            mix={css({
              width: "120px",
              maxHeight: "160px",
              objectFit: "contain",
              borderRadius: "10px",
              background: "#141210",
              border: "1px solid #4a4036",
            })}
          />
        ) : null}
        <label>
          Description
          <textarea
            name="description"
            required
            defaultValue={h.props.description ?? ""}
            placeholder="Title, notes… Paste an image here to set the cover."
            mix={on<HTMLTextAreaElement>("paste", onPaste)}
          />
        </label>
        <p mix={css({ ...muted, margin: 0, fontSize: "13px" })}>
          Paste an image into the description field to use it as the cover. Images larger than{" "}
          {MAX_IMAGE_EDGE}×{MAX_IMAGE_EDGE} px are resized to fit.
        </p>
        {message ? (
          <p
            mix={css({
              margin: 0,
              fontSize: "14px",
              color: messageKind === "error" ? "#ffb4a8" : "#b8d4a8",
            })}
          >
            {message}
          </p>
        ) : null}
      </div>
    );
  },
);
