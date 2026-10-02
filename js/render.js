// Turns markdown from /data into HTML.
// A CV entry is an h2, an optional h3, then a short line that contains a year.

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url) {
  const value = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(value)) return value;
  return "#";
}

function linkPhones(html) {
  return html
    .split(/(<[^>]+>)/)
    .map((chunk) => {
      if (chunk.startsWith("<")) return chunk;
      return chunk.replace(/\+\d[\d\s().-]{6,}\d/g, (phone) => {
        const href = "tel:" + phone.replace(/[^\d+]/g, "");
        return `<a href="${href}">${phone}</a>`;
      });
    })
    .join("");
}

function inline(raw) {
  let html = escapeHtml(raw);
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => {
    const href = safeUrl(url.replace(/&amp;/g, "&"));
    return `<a href="${escapeHtml(href)}">${text}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(
    /(^|[\s>(])_([^_\n]+)_(?=$|[\s<.,);:!?—–-])/g,
    "$1<em>$2</em>"
  );
  html = html.replace(
    /(^|[\s>(])\*([^*\n]+)\*(?=$|[\s<.,);:!?—–-])/g,
    "$1<em>$2</em>"
  );
  html = html.replace(/\n/g, "<br>");
  return linkPhones(html);
}

function stripMarkers(text) {
  return text.replace(/[_*]/g, "").replace(/\s+/g, " ").trim();
}

function isDateLine(text) {
  if (!text || text.includes("\n") || text.includes("[")) return false;
  const plain = stripMarkers(text);
  if (!plain || plain.length > 48) return false;
  const words = plain.split(" ").filter(Boolean);
  if (words.length > 7) return false;
  return /\d{4}/.test(plain);
}

function skillsText(text) {
  const match = text.match(/^\*([^*\n]+)\*$/);
  if (!match) return null;
  const inner = match[1].trim();
  if (/^(Skills|Навыки)\s*:/i.test(inner)) return inner;
  return null;
}

function trailingYear(line) {
  const match = line.match(/^(.*)\s-\s_(\d{4})_\s*$/);
  if (!match) return null;
  return { title: match[1].trim(), year: match[2] };
}

function parseBlocks(markdown) {
  const lines = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ type: "p", text: paragraph.join("\n") });
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    blocks.push({ type: "ul", items: list.slice() });
    list = [];
  }

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "h",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^\s*-\s+/, "").trim());
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderBlock(block) {
  if (block.type === "p") {
    const skills = skillsText(block.text);
    if (skills) return `<p class="skills">${inline(skills)}</p>`;
    return `<p>${inline(block.text)}</p>`;
  }
  if (block.type === "ul") {
    const items = block.items.map((item) => `<li>${inline(item)}</li>`).join("");
    return `<ul>${items}</ul>`;
  }
  if (block.type === "h") {
    const tag = block.level === 1 ? "h2" : "h3";
    return `<${tag}>${inline(block.text)}</${tag}>`;
  }
  return "";
}

function entryHtml(entry) {
  const org = entry.subtitle
    ? `<p class="entry-org">${inline(entry.subtitle)}</p>`
    : "";
  const date = entry.date
    ? `<p class="entry-date">${inline(entry.date)}</p>`
    : "";
  const body = entry.body.length
    ? `<div class="entry-body">${entry.body.map(renderBlock).join("")}</div>`
    : "";
  return `<article class="entry"><div class="entry-head"><div class="entry-titles"><h3>${inline(entry.title)}</h3>${org}</div>${date}</div>${body}</article>`;
}

function renderEntries(blocks) {
  const entries = [];
  let current = null;

  for (const block of blocks) {
    if (block.type === "h" && block.level === 2) {
      current = { title: block.text, subtitle: "", date: "", body: [] };
      entries.push(current);
      continue;
    }
    if (!current) continue;
    if (
      block.type === "h" &&
      block.level === 3 &&
      !current.subtitle &&
      !current.date &&
      current.body.length === 0
    ) {
      current.subtitle = block.text;
      continue;
    }
    if (
      !current.date &&
      current.body.length === 0 &&
      block.type === "p" &&
      isDateLine(block.text)
    ) {
      current.date = stripMarkers(block.text);
      continue;
    }
    current.body.push(block);
  }

  return `<div class="entries">${entries.map(entryHtml).join("")}</div>`;
}

function renderLoose(blocks) {
  let html = "";
  for (const block of blocks) {
    if (block.type !== "p") {
      html += renderBlock(block);
      continue;
    }
    const lines = block.text.split("\n");
    const year = trailingYear(lines[0]);
    if (!year) {
      html += renderBlock(block);
      continue;
    }
    const rest = lines.slice(1).join("\n").trim();
    html += entryHtml({
      title: year.title,
      subtitle: "",
      date: year.year,
      body: rest ? [{ type: "p", text: rest }] : [],
    });
  }
  return `<div class="entries">${html}</div>`;
}

function renderSection(section) {
  const hasEntries = section.blocks.some(
    (block) => block.type === "h" && block.level === 2
  );
  const body = hasEntries
    ? renderEntries(section.blocks)
    : renderLoose(section.blocks);
  return `<section class="cv-section"><h2>${inline(section.title)}</h2>${body}</section>`;
}

function parseCv(markdown) {
  const blocks = parseBlocks(markdown);
  let index = 0;
  let name = "";
  let role = "";

  if (blocks[index]?.type === "h" && blocks[index].level === 1) {
    const title = blocks[index].text;
    const splitAt = title.indexOf(" - ");
    if (splitAt === -1) {
      name = title;
    } else {
      name = title.slice(0, splitAt).trim();
      role = title.slice(splitAt + 3).trim();
    }
    index += 1;
  }

  const contacts = [];
  while (
    index < blocks.length &&
    !(blocks[index].type === "h" && blocks[index].level === 1)
  ) {
    if (blocks[index].type === "p") contacts.push(blocks[index]);
    index += 1;
  }

  const sections = [];
  while (index < blocks.length) {
    if (!(blocks[index].type === "h" && blocks[index].level === 1)) {
      index += 1;
      continue;
    }
    const section = { title: blocks[index].text, blocks: [] };
    index += 1;
    while (
      index < blocks.length &&
      !(blocks[index].type === "h" && blocks[index].level === 1)
    ) {
      section.blocks.push(blocks[index]);
      index += 1;
    }
    sections.push(section);
  }

  return { name, role, contacts, sections };
}

export function siteTitle(markdown) {
  const heading = parseBlocks(markdown).find(
    (block) => block.type === "h" && block.level === 1
  );
  return heading ? stripMarkers(heading.text) : "";
}

export function renderProse(markdown) {
  const blocks = parseBlocks(markdown);
  const titleAt = blocks.findIndex(
    (block) => block.type === "h" && block.level === 1
  );
  const body = titleAt === -1 ? blocks : blocks.filter((_, index) => index !== titleAt);
  return body.map(renderBlock).join("");
}

export function renderProjects(markdown) {
  const blocks = parseBlocks(markdown);
  const cards = [];
  let current = null;

  for (const block of blocks) {
    if (block.type === "h" && block.level === 2) {
      current = { title: block.text, body: [] };
      cards.push(current);
      continue;
    }
    if (current) current.body.push(block);
  }

  return cards
    .map(
      (card) =>
        `<article class="project"><h2>${inline(card.title)}</h2><div class="project-body">${card.body.map(renderBlock).join("")}</div></article>`
    )
    .join("");
}

export function renderCv(markdown) {
  const doc = parseCv(markdown);
  const contacts = doc.contacts
    .map((block) => `<p>${inline(block.text)}</p>`)
    .join("");
  const sections = doc.sections.map(renderSection).join("");
  const role = doc.role ? `<p class="cv-role">${inline(doc.role)}</p>` : "";
  const contactBlock = contacts
    ? `<div class="cv-contacts">${contacts}</div>`
    : "";

  return `<header class="cv-intro"><h1>${inline(doc.name)}</h1>${role}${contactBlock}</header>${sections}`;
}
