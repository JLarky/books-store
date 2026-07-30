import { clientEntry, css, on, type Handle } from "remix/ui";
import {
  fitImageSize,
  IMAGE_EDGE_LADDER,
  MAX_IMAGE_EDGE,
  TARGET_IMAGE_BYTES,
} from "../utils/image.ts";
import { muted } from "./styles.ts";

/** Lossy quality per format — codecs don't treat the same number equally. */
const WEBP_JPEG_QUALITY = 0.82;

type EncodeCandidate = {
  type: string;
  extension: string;
  quality?: number;
  /** JPEG has no alpha; draw over an opaque fill before encoding. */
  opaqueBackground?: string;
};

const ENCODE_CANDIDATES: EncodeCandidate[] = [
  { type: "image/webp", extension: "webp", quality: WEBP_JPEG_QUALITY },
  { type: "image/jpeg", extension: "jpg", quality: WEBP_JPEG_QUALITY, opaqueBackground: "#ffffff" },
];

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

function renamedFile(original: string, extension: string): string {
  const base = original.replace(/\.[^.]+$/, "") || "cover";
  return `${base}.${extension}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), type, quality);
  });
}

function drawCover(
  image: HTMLImageElement,
  size: { width: number; height: number },
  opaqueBackground?: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare image");
  if (opaqueBackground) {
    context.fillStyle = opaqueBackground;
    context.fillRect(0, 0, size.width, size.height);
  }
  context.drawImage(image, 0, 0, size.width, size.height);
  return canvas;
}

function extensionForType(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "bin";
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} KB`;
}

type SizeRow = {
  label: string;
  bytes: number | null;
  selected: boolean;
};

type Contestant = {
  blob: Blob;
  type: string;
  extension: string;
  rowLabel: string;
  width: number;
  height: number;
};

async function encodeAtSize(
  image: HTMLImageElement,
  size: { width: number; height: number },
  edgeLabel: number,
): Promise<{ encoded: { extension: string; blob: Blob | null }[]; contestants: Contestant[] }> {
  const encoded = await Promise.all(
    ENCODE_CANDIDATES.map(async (candidate) => {
      const canvas = drawCover(image, size, candidate.opaqueBackground);
      const blob = await canvasToBlob(canvas, candidate.type, candidate.quality);
      // Unsupported types silently fall back to PNG — reject those.
      if (!blob || blob.size === 0 || blob.type !== candidate.type) {
        return { extension: candidate.extension, blob: null as Blob | null, candidate };
      }
      return { extension: candidate.extension, blob, candidate };
    }),
  );

  const contestants: Contestant[] = [];
  for (const entry of encoded) {
    if (!entry.blob) continue;
    contestants.push({
      blob: entry.blob,
      type: entry.candidate.type,
      extension: entry.extension,
      rowLabel: `${entry.extension}@${edgeLabel}`,
      width: size.width,
      height: size.height,
    });
  }

  return {
    encoded: encoded.map(({ extension, blob }) => ({ extension, blob })),
    contestants,
  };
}

async function prepareCoverImage(file: File): Promise<{
  file: File;
  original: { width: number; height: number };
  size: { width: number; height: number };
  resized: boolean;
  winnerLabel: string;
  underBudget: boolean;
  sizeRows: SizeRow[];
}> {
  const image = await loadImage(file);
  const original = { width: image.naturalWidth, height: image.naturalHeight };
  const originalRowLabel = `original (${extensionForType(file.type) || "image"})`;

  const sizeRows: SizeRow[] = [{ label: originalRowLabel, bytes: file.size, selected: false }];

  let winner: Contestant | null = null;
  let lastSizeKey = "";

  for (const maxEdge of IMAGE_EDGE_LADDER) {
    const size = fitImageSize(original.width, original.height, maxEdge);
    const sizeKey = `${size.width}x${size.height}`;
    if (sizeKey === lastSizeKey) continue;
    lastSizeKey = sizeKey;

    const { encoded, contestants } = await encodeAtSize(image, size, maxEdge);

    const fitsNative = size.width === original.width && size.height === original.height;
    if (fitsNative && file.size > 0 && file.type.startsWith("image/")) {
      contestants.push({
        blob: file,
        type: file.type,
        extension: extensionForType(file.type),
        rowLabel: originalRowLabel,
        width: size.width,
        height: size.height,
      });
    }

    if (contestants.length === 0) continue;

    contestants.sort((a, b) => a.blob.size - b.blob.size);
    const bestAtScale = contestants[0]!;

    for (const entry of encoded) {
      sizeRows.push({
        label: `${entry.extension}@${maxEdge}`,
        bytes: entry.blob?.size ?? null,
        selected: false,
      });
    }

    // Prefer the largest scale that still fits the byte budget.
    if (bestAtScale.blob.size <= TARGET_IMAGE_BYTES) {
      winner = bestAtScale;
      break;
    }

    // Remember the overall smallest in case nothing hits the budget.
    if (!winner || bestAtScale.blob.size < winner.blob.size) {
      winner = bestAtScale;
    }
  }

  if (!winner) throw new Error("Could not encode image");

  for (const row of sizeRows) {
    row.selected = row.label === winner.rowLabel && row.bytes === winner.blob.size;
  }
  if (!sizeRows.some((row) => row.selected)) {
    const match = sizeRows.find((row) => row.bytes === winner!.blob.size);
    if (match) match.selected = true;
  }

  const resized = winner.width !== original.width || winner.height !== original.height;
  const underBudget = winner.blob.size <= TARGET_IMAGE_BYTES;

  return {
    file: new File([winner.blob], renamedFile(file.name || "cover", winner.extension), {
      type: winner.type,
    }),
    original,
    size: { width: winner.width, height: winner.height },
    resized,
    winnerLabel: `${winner.extension} ${winner.width}×${winner.height}, ${formatKb(winner.blob.size)}`,
    underBudget,
    sizeRows,
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
    let sizeRows: SizeRow[] | null = null;
    let messageKind: "error" | "notice" = "notice";

    function setPreview(file: File) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      previewUrl = objectUrl;
    }

    async function acceptImage(file: File, input: HTMLInputElement | null, fromPaste: boolean) {
      try {
        const result = await prepareCoverImage(file);
        if (input) assignFile(input, result.file);
        setPreview(result.file);
        messageKind = "notice";
        sizeRows = result.sizeRows;
        const budgetNote = result.underBudget
          ? ""
          : ` Still over ${formatKb(TARGET_IMAGE_BYTES)} after shrinking.`;
        if (result.resized) {
          message = `Cover resized from ${result.original.width}×${result.original.height} to ${result.size.width}×${result.size.height}. Storing ${result.winnerLabel}.${budgetNote}`;
        } else if (fromPaste) {
          message = `Cover set from pasted image (${result.size.width}×${result.size.height}). Storing ${result.winnerLabel}.${budgetNote}`;
        } else {
          message = `Cover optimized. Storing ${result.winnerLabel}.${budgetNote}`;
        }
        void h.update();
      } catch {
        if (input && !fromPaste) input.value = "";
        messageKind = "error";
        message = "Could not read that image.";
        sizeRows = null;
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
              width: "180px",
              maxHeight: "240px",
              objectFit: "contain",
              borderRadius: "10px",
              background: "#141210",
              border: "1px solid #4a4036",
              "@media (max-width: 560px)": {
                width: "120px",
                maxHeight: "160px",
              },
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
          Paste an image into the description field to use it as the cover. Starts at up to{" "}
          {MAX_IMAGE_EDGE}×{MAX_IMAGE_EDGE} px, then steps down scales/formats to aim for{" "}
          {formatKb(TARGET_IMAGE_BYTES)} or less.
        </p>
        {message ? (
          <div mix={css({ display: "flex", flexDirection: "column", gap: "6px" })}>
            <p
              mix={css({
                margin: 0,
                fontSize: "14px",
                color: messageKind === "error" ? "#ffb4a8" : "#b8d4a8",
              })}
            >
              {message}
            </p>
            {sizeRows && messageKind === "notice" ? (
              <ul
                mix={css({
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  fontSize: "13px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  color: "#c4b8a8",
                  display: "grid",
                  gridTemplateColumns: "auto auto auto",
                  columnGap: "12px",
                  rowGap: "2px",
                  justifyContent: "start",
                })}
              >
                {sizeRows.map((row) => (
                  <li
                    key={row.label}
                    mix={css({
                      display: "contents",
                      color: row.selected ? "#b8d4a8" : row.bytes == null ? "#7a7064" : undefined,
                    })}
                  >
                    <span>{row.label}</span>
                    <span>{row.bytes == null ? "unsupported" : formatKb(row.bytes)}</span>
                    <span>{row.selected ? "← stored" : ""}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);
