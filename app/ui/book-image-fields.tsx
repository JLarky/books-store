import { clientEntry, css, on, type Handle } from "remix/ui";
import { MAX_IMAGE_EDGE } from "../utils/image.ts";
import { muted } from "./styles.ts";

function loadImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    image.src = url;
  });
}

function assignFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
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
    let descriptionText = h.props.description ?? "";
    let previewUrl = h.props.existingImageSrc ?? null;
    let objectUrl: string | null = null;
    let message: string | null = null;
    let messageKind: "error" | "notice" = "notice";

    function setPreview(file: File) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      previewUrl = objectUrl;
    }

    async function acceptImage(file: File, input: HTMLInputElement | null) {
      try {
        const size = await loadImageSize(file);
        if (size.width > MAX_IMAGE_EDGE || size.height > MAX_IMAGE_EDGE) {
          messageKind = "error";
          message = `Image must be at most ${MAX_IMAGE_EDGE}×${MAX_IMAGE_EDGE} pixels (got ${size.width}×${size.height}). Client-side resize is coming later.`;
          void h.update();
          return;
        }
        if (input) assignFile(input, file);
        setPreview(file);
        messageKind = "notice";
        message = `Cover set from pasted image (${size.width}×${size.height}).`;
        void h.update();
      } catch {
        messageKind = "error";
        message = "Could not read that image.";
        void h.update();
      }
    }

    function onPaste(event: Event) {
      const clipboard = event as ClipboardEvent;
      const target = clipboard.target as HTMLTextAreaElement;
      descriptionText = target.value;
      const items = clipboard.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        clipboard.preventDefault();
        const form = target.closest("form");
        const input = form?.querySelector<HTMLInputElement>('input[name="image"]') ?? null;
        void acceptImage(file, input);
        return;
      }
    }

    function onFileChange(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          const size = await loadImageSize(file);
          if (size.width > MAX_IMAGE_EDGE || size.height > MAX_IMAGE_EDGE) {
            input.value = "";
            messageKind = "error";
            message = `Image must be at most ${MAX_IMAGE_EDGE}×${MAX_IMAGE_EDGE} pixels (got ${size.width}×${size.height}). Client-side resize is coming later.`;
            previewUrl = h.props.existingImageSrc ?? null;
            void h.update();
            return;
          }
          setPreview(file);
          messageKind = "notice";
          message = null;
          void h.update();
        } catch {
          messageKind = "error";
          message = "Could not read that image.";
          void h.update();
        }
      })();
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
            value={descriptionText}
            placeholder="Title, notes… Paste an image here to set the cover."
            mix={[
              on<HTMLTextAreaElement>("paste", onPaste),
              on<HTMLTextAreaElement>("input", (event) => {
                descriptionText = (event.target as HTMLTextAreaElement).value;
              }),
            ]}
          />
        </label>
        <p mix={css({ ...muted, margin: 0, fontSize: "13px" })}>
          Paste an image into the description field to use it as the cover. Max {MAX_IMAGE_EDGE}×
          {MAX_IMAGE_EDGE} px for now.
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
