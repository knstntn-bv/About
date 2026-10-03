// A4 CV from the same markdown model as the page.
// Dates sit in a narrow left column; the role and description sit on the right.

import { cvDocument, skillsText } from "./render.js";

const PAGE_W = 595.28;
const MARGIN_L = 46;
const MARGIN_R = 42;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 44;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const DATE_W = 86;
const COL_GAP = 12;

const INK = "#22201e";
const MUTED = "#5c564f";
const ACCENT = "#9d1c1c";
const LINK = "#1a4f8b";

const RU_LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function cleanText(raw) {
  return String(raw)
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function safeUrl(url) {
  const value = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(value)) return value;
  return "";
}

function startsMarkup(text, index) {
  if (text.startsWith("[", index) && /^\[([^\]]+)\]\(([^)\s]+)\)/.test(text.slice(index))) {
    return true;
  }
  if (text.startsWith("**", index)) return true;
  const boundary = index === 0 || /[\s>(]/.test(text[index - 1]);
  if (!boundary) return false;
  if (text.startsWith("_", index) && /^_([^_\n]+)_(?=$|[\s<.,);:!?—–-])/.test(text.slice(index))) {
    return true;
  }
  if (text.startsWith("*", index) && /^\*([^*\n]+)\*(?=$|[\s<.,);:!?—–-])/.test(text.slice(index))) {
    return true;
  }
  return false;
}

function mergePlain(parts) {
  const out = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    const plain = !part.bold && !part.italics && !part.link;
    const prevPlain = prev && !prev.bold && !prev.italics && !prev.link;
    if (plain && prevPlain) prev.text += part.text;
    else out.push({ ...part });
  }
  return out;
}

function linkPhones(parts) {
  const out = [];
  const re = /\+\d[\d\s().-]{6,}\d/g;
  for (const part of parts) {
    if (part.bold || part.italics || part.link) {
      out.push(part);
      continue;
    }
    re.lastIndex = 0;
    let last = 0;
    let match;
    let found = false;
    while ((match = re.exec(part.text))) {
      found = true;
      if (match.index > last) out.push({ text: part.text.slice(last, match.index) });
      const phone = match[0];
      out.push({
        text: phone,
        link: "tel:" + phone.replace(/[^\d+]/g, ""),
        color: LINK,
        decoration: "underline",
      });
      last = match.index + phone.length;
    }
    if (!found) out.push(part);
    else if (last < part.text.length) out.push({ text: part.text.slice(last) });
  }
  return out.filter((part) => part.text);
}

function tightenHyphens(value) {
  return value.replace(/(?<=\p{L})-(?=\p{L})/gu, "\u2011");
}

function simplify(parts) {
  const glued = parts.map((part) =>
    part.link ? part : { ...part, text: tightenHyphens(part.text) }
  );
  if (!glued.length) return "";
  if (glued.length === 1 && !glued[0].bold && !glued[0].italics && !glued[0].link) {
    return glued[0].text;
  }
  return glued;
}

function richText(raw) {
  const text = cleanText(raw);
  const parts = [];
  let i = 0;
  while (i < text.length) {
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(i));
    if (link) {
      const href = safeUrl(link[2]);
      if (href) {
        parts.push({
          text: link[1],
          link: href,
          color: LINK,
          decoration: "underline",
        });
      } else {
        parts.push({ text: link[1] });
      }
      i += link[0].length;
      continue;
    }
    const bold = /^\*\*([^*]+)\*\*/.exec(text.slice(i));
    if (bold) {
      parts.push({ text: bold[1], bold: true });
      i += bold[0].length;
      continue;
    }
    const boundary = i === 0 || /[\s>(]/.test(text[i - 1]);
    if (boundary) {
      const italic = /^_([^_\n]+)_(?=$|[\s<.,);:!?—–-])/.exec(text.slice(i));
      if (italic) {
        parts.push({ text: italic[1], italics: true });
        i += italic[0].length;
        continue;
      }
      const em = /^\*([^*\n]+)\*(?=$|[\s<.,);:!?—–-])/.exec(text.slice(i));
      if (em) {
        parts.push({ text: em[1], italics: true });
        i += em[0].length;
        continue;
      }
    }
    let j = i + 1;
    while (j < text.length && !startsMarkup(text, j)) j += 1;
    parts.push({ text: text.slice(i, j) });
    i = j;
  }
  return simplify(linkPhones(mergePlain(parts)));
}

function formatDate(date) {
  const value = cleanText(date);
  if (!value) return value;
  const match = /^(.*?)\s+-\s+(.*)$/.exec(value);
  if (!match || value.length <= 22) return value;
  return `${match[1]} -\n${match[2]}`;
}

function pair(date, content, bottom) {
  const stack = Array.isArray(content) ? content : [content];
  return {
    columns: [
      {
        width: DATE_W,
        text: date || "",
        style: "date",
      },
      { width: "*", stack },
    ],
    columnGap: COL_GAP,
    margin: [0, 0, 0, bottom],
  };
}

function bullet(item) {
  return {
    columns: [
      { width: 8, text: "•", style: "bullet", margin: [0, 0.4, 0, 0] },
      { width: "*", text: richText(item), style: "body" },
    ],
    columnGap: 3,
  };
}

function blockContent(block) {
  if (block.type === "ul") return block.items.map(bullet);
  if (block.type === "h") {
    return [{ text: richText(block.text), style: "org" }];
  }
  if (block.type === "p") {
    const skills = skillsText(block.text);
    if (skills) return [{ text: richText(skills), style: "skills" }];
    return [{ text: richText(block.text), style: "body" }];
  }
  return [{ text: "" }];
}

function sectionHead(title) {
  return {
    stack: [
      { text: cleanText(title).toUpperCase(), style: "section" },
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: CONTENT_W,
            y2: 0,
            lineWidth: 0.8,
            lineColor: ACCENT,
          },
        ],
      },
    ],
    margin: [0, 12, 0, 7],
  };
}

function entryPieces(entry) {
  const head = [{ text: richText(entry.title), style: "job" }];
  if (entry.subtitle) head.push({ text: richText(entry.subtitle), style: "org" });
  const rows = [pair(formatDate(entry.date), head, 1)];
  for (const block of entry.body) {
    const bits = blockContent(block);
    bits.forEach((bit, index) => {
      const lastBit = index === bits.length - 1;
      const gap = block.type === "ul" ? (lastBit ? 2 : 1) : 2;
      rows.push(pair("", bit, gap));
    });
  }
  rows[rows.length - 1].margin = [0, 0, 0, 8];
  for (const row of rows) row.unbreakable = true;
  if (rows.length === 1) return rows;
  return [{ stack: [rows[0], rows[1]], unbreakable: true }, ...rows.slice(2)];
}

function blockPieces(block) {
  const bits = blockContent(block);
  return bits.map((bit, index) => ({
    ...bit,
    margin: [0, 0, 0, index === bits.length - 1 ? 6 : 2],
    unbreakable: true,
  }));
}

function nodePieces(node) {
  return node.kind === "entry" ? entryPieces(node) : blockPieces(node.block);
}

function sectionPieces(section) {
  const head = sectionHead(section.title);
  const pieces = section.nodes.flatMap(nodePieces);
  if (!pieces.length) return [head];
  return [{ stack: [head, pieces[0]], unbreakable: true }, ...pieces.slice(1)];
}

export function pdfFilename(name, lang, kind = "cv") {
  const mapped = String(name).replace(/[А-ЯЁа-яё]/g, (char) => {
    const lower = char.toLowerCase();
    const latin = RU_LATIN[lower] || "";
    if (!latin) return "";
    return char === lower ? latin : latin[0].toUpperCase() + latin.slice(1);
  });
  const slug = mapped
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const base = slug || "CV";
  const code = lang === "en" ? "EN" : "RU";
  const label = kind === "resume" ? "Resume" : "CV";
  return `${base}-${label}-${code}.pdf`;
}

export function buildCvPdf(markdown) {
  const doc = cvDocument(markdown);
  const header = [{ text: doc.name || "CV", style: "name" }];
  if (doc.role) header.push({ text: richText(doc.role), style: "role" });
  for (const contact of doc.contacts) {
    header.push({ text: richText(contact.text), style: "contact" });
  }

  return {
    pageSize: "A4",
    pageMargins: [MARGIN_L, MARGIN_TOP, MARGIN_R, MARGIN_BOTTOM],
    info: {
      title: `${doc.name} — CV`,
      author: doc.name,
      subject: doc.role || "CV",
    },
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      color: INK,
      lineHeight: 1.22,
    },
    styles: {
      name: { fontSize: 18, bold: true, color: INK, margin: [0, 0, 0, 1] },
      role: { fontSize: 10.5, color: ACCENT, margin: [0, 1, 0, 3] },
      contact: { fontSize: 9, color: MUTED, margin: [0, 1, 0, 0], lineHeight: 1.28 },
      section: { fontSize: 9, bold: true, characterSpacing: 0.7, margin: [0, 0, 0, 3] },
      job: { fontSize: 11, bold: true, color: ACCENT },
      org: { fontSize: 10, bold: true, margin: [0, 1, 0, 0] },
      date: {
        fontSize: 8,
        color: MUTED,
        alignment: "right",
        lineHeight: 1.2,
        margin: [0, 2, 0, 0],
      },
      body: { fontSize: 9, lineHeight: 1.25 },
      skills: { fontSize: 8, italics: true, color: MUTED, lineHeight: 1.25 },
      bullet: { fontSize: 9, color: ACCENT, alignment: "center" },
      footer: { fontSize: 8, color: "#8a847f" },
    },
    footer(current, total) {
      return {
        columns: [
          { text: doc.name, style: "footer" },
          { text: `${current} / ${total}`, style: "footer", alignment: "right" },
        ],
        margin: [MARGIN_L, 12, MARGIN_R, 0],
      };
    },
    content: [{ stack: header, margin: [0, 0, 0, 2] }, ...doc.sections.flatMap(sectionPieces)],
  };
}

let pdfMakeLoading = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const found = document.querySelector(`script[data-pdf-src="${src}"]`);
    if (found) {
      if (found.dataset.loaded === "1") resolve();
      else found.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.dataset.pdfSrc = src;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function ensurePdfMake() {
  if (!pdfMakeLoading) {
    pdfMakeLoading = (async () => {
      const base = new URL(".", window.location.href);
      await loadScript(new URL("vendor/pdfmake.min.js", base).href);
      await loadScript(new URL("vendor/vfs_fonts.js", base).href);
      if (!window.pdfMake) throw new Error("pdfMake missing");
      return window.pdfMake;
    })().catch((error) => {
      pdfMakeLoading = null;
      throw error;
    });
  }
  return pdfMakeLoading;
}

export async function downloadCvPdf(markdown, lang, kind = "cv") {
  const pdfMake = await ensurePdfMake();
  const definition = buildCvPdf(markdown);
  const filename = pdfFilename(cvDocument(markdown).name, lang, kind);
  await new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(definition).download(filename, () => resolve());
    } catch (error) {
      reject(error);
    }
  });
}
