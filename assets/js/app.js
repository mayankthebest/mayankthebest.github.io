/* ==========================================================================
   Mayank Kumar — résumé site behaviour
   - theme toggle (persisted)
   - scroll progress + active nav
   - reveal on scroll
   - "Export to Word": builds a Word-compatible document from the page DOM,
     so the site markup stays the single source of truth for the content.
   ========================================================================== */

(function () {
  "use strict";

  /* ─────────────────────────── theme ─────────────────────────── */

  var root = document.documentElement;
  var STORE = "mk-resume-theme";

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    var btn = document.getElementById("themeToggle");
    if (btn) {
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#080d18" : "#f6f7fb");
  }

  var stored = null;
  try { stored = localStorage.getItem(STORE); } catch (e) { /* private mode */ }

  if (stored) {
    applyTheme(stored);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    applyTheme("light");
  }

  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(STORE, next); } catch (e) { /* ignore */ }
    });
  }

  /* ─────────────────── scroll progress + active nav ─────────────────── */

  var bar = document.getElementById("scrollBar");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  function onScroll() {
    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      bar.style.width = pct + "%";
    }

    var current = null;
    var probe = window.scrollY + window.innerHeight * 0.28;
    sections.forEach(function (s) {
      if (s.offsetTop <= probe) current = s.id;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + current);
    });
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();

  /* ─────────────────────── reveal on scroll ─────────────────────── */

  var revealTargets = document.querySelectorAll(
    ".section > .prose, .cards > .card, .tl-item, .skill-block, .pub, .cred-col, .stats, .cta"
  );

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.01 });

    Array.prototype.forEach.call(revealTargets, function (el, i) {
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(i % 4, 3) * 60 + "ms";
      io.observe(el);
    });

    // Failsafe: content must never stay hidden because an observer missed a
    // callback (viewport resize, print, restored scroll position, etc.).
    var showAll = function () {
      Array.prototype.forEach.call(revealTargets, function (el) {
        el.classList.add("in");
        el.style.transitionDelay = "0ms";
      });
    };
    setTimeout(showAll, 2500);
    window.addEventListener("beforeprint", showAll);
    window.addEventListener("resize", function () { setTimeout(showAll, 250); }, { passive: true });
  }

  /* ───────────────────────────── year ───────────────────────────── */

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ───────────────────────────── toast ───────────────────────────── */

  var toastEl = document.getElementById("toast");
  var toastTimer;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  /* ═══════════════════════ Word export ═══════════════════════ */

  var INLINE_KEEP = { B: 1, STRONG: 1, I: 1, EM: 1, A: 1, BR: 1 };

  function esc(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function tidy(text) {
    return String(text).replace(/\s+/g, " ").trim();
  }

  /** Returns inline HTML for an element, keeping only simple formatting tags. */
  function inline(el) {
    if (!el) return "";
    var clone = el.cloneNode(true);

    // Unwrap or drop everything that is not simple inline formatting.
    var walk = function (node) {
      var children = Array.prototype.slice.call(node.childNodes);
      children.forEach(function (child) {
        if (child.nodeType === 1) {
          walk(child);
          if (!INLINE_KEEP[child.tagName]) {
            while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
            child.parentNode.removeChild(child);
          } else if (child.tagName === "A") {
            var href = child.getAttribute("href") || "";
            child.setAttribute("href", href);
            Array.prototype.slice.call(child.attributes).forEach(function (attr) {
              if (attr.name !== "href") child.removeAttribute(attr.name);
            });
          } else {
            Array.prototype.slice.call(child.attributes).forEach(function (attr) {
              child.removeAttribute(attr.name);
            });
          }
        }
      });
    };
    walk(clone);

    return tidy(clone.innerHTML);
  }

  function textOf(el) {
    return el ? tidy(el.textContent) : "";
  }

  /** Direct list items of an element, ignoring nested pill/chip lists. */
  function bulletsOf(el) {
    return Array.prototype.slice.call(el.querySelectorAll("li"))
      .filter(function (li) {
        return !li.closest(".pills") && !li.closest(".chips");
      })
      .map(function (li) { return inline(li); })
      .filter(Boolean);
  }

  function groupOf(el) {
    var labelEl = el.querySelector("[data-wx-h]");
    var label = "";
    if (labelEl) {
      label = labelEl.getAttribute("data-wx-h") || textOf(labelEl);
    }

    var items;
    if (el.classList.contains("chips")) {
      items = Array.prototype.slice.call(el.querySelectorAll(".chip"));
    } else {
      items = Array.prototype.slice.call(el.querySelectorAll("li"));
    }
    var values = items.map(textOf).filter(Boolean);

    return { type: "group", label: label, items: values };
  }

  function entryOf(el) {
    var headEl = el.querySelector("[data-wx-h]");
    var metaEl = el.querySelector("[data-wx-m]");
    var subEl = el.querySelector(".tl-sub");

    var groups = Array.prototype.slice.call(el.querySelectorAll('[data-wx="group"]'))
      .map(groupOf)
      .filter(function (g) { return g.items.length; });

    return {
      type: "entry",
      heading: headEl ? (headEl.getAttribute("data-wx-h") || textOf(headEl)) : "",
      meta: textOf(metaEl),
      sub: subEl && subEl !== headEl ? textOf(subEl) : "",
      bullets: bulletsOf(el),
      groups: groups
    };
  }

  /** Walks the live DOM and returns an ordered, structured résumé model. */
  function collect() {
    var model = { header: {}, sections: [] };

    model.header.name = textOf(document.querySelector(".hero-name"));
    model.header.role = textOf(document.querySelector(".hero-role"));
    model.header.contacts = Array.prototype.slice
      .call(document.querySelectorAll(".contact a"))
      .map(function (a) {
        // Drop the decorative icon glyph before reading the label.
        var clone = a.cloneNode(true);
        var icon = clone.querySelector(".ci");
        if (icon) icon.remove();
        return { text: tidy(clone.textContent), href: a.getAttribute("href") };
      });

    Array.prototype.slice.call(document.querySelectorAll("section.section[data-wx-title]"))
      .forEach(function (section) {
        var out = { title: section.getAttribute("data-wx-title"), blocks: [] };

        Array.prototype.slice.call(section.querySelectorAll("[data-wx]")).forEach(function (node) {
          if (node.getAttribute("data-wx") === "skip") return;
          if (node.closest('[data-wx="skip"]') && node.closest('[data-wx="skip"]') !== node) return;

          // Nested nodes are handled by their owning entry.
          var parent = node.parentElement;
          while (parent && parent !== section) {
            if (parent.matches('[data-wx="entry"]')) return;
            parent = parent.parentElement;
          }

          var kind = node.getAttribute("data-wx");
          if (kind === "para") {
            var html = inline(node);
            if (html) out.blocks.push({ type: "para", html: html });
          } else if (kind === "bullets") {
            var items = bulletsOf(node);
            if (items.length) out.blocks.push({ type: "bullets", items: items });
          } else if (kind === "entry") {
            out.blocks.push(entryOf(node));
          } else if (kind === "group") {
            var g = groupOf(node);
            if (g.items.length) out.blocks.push(g);
          }
        });

        if (out.blocks.length) model.sections.push(out);
      });

    // Publications are links, not data-wx nodes; append them to Writing.
    var writing = model.sections.filter(function (s) { return /Writing/i.test(s.title); })[0];
    if (writing) {
      var pubs = Array.prototype.slice.call(document.querySelectorAll(".pub")).map(function (p) {
        return (
          esc(textOf(p.querySelector("h3"))) +
          " — <i>" + esc(textOf(p.querySelector(".pub-src"))) + "</i> · " +
          '<a href="' + esc(p.getAttribute("href")) + '">' + esc(p.getAttribute("href")) + "</a>"
        );
      });
      if (pubs.length) writing.blocks.unshift({ type: "bullets", items: pubs });
    }

    return model;
  }

  /** Renders the model as a Word-compatible HTML document. */
  function buildWordDocument(model) {
    var h = model.header;
    var parts = [];

    parts.push('<h1 class="nm">' + esc(h.name) + "</h1>");
    if (h.role) parts.push('<p class="role">' + esc(h.role) + "</p>");

    if (h.contacts.length) {
      parts.push(
        '<p class="contact">' +
        h.contacts
          .map(function (c) {
            var href = c.href || "";
            return /^(mailto:|tel:|https?:)/.test(href)
              ? '<a href="' + esc(href) + '">' + esc(c.text) + "</a>"
              : esc(c.text);
          })
          .join(' <span class="sep">|</span> ') +
        "</p>"
      );
    }

    parts.push('<p class="rule"></p>');

    model.sections.forEach(function (section) {
      parts.push("<h2>" + esc(section.title.replace(/&amp;/g, "&")) + "</h2>");

      section.blocks.forEach(function (block) {
        if (block.type === "para") {
          parts.push("<p>" + block.html + "</p>");
        } else if (block.type === "bullets") {
          parts.push("<ul>" + block.items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>");
        } else if (block.type === "group") {
          parts.push(
            '<p class="grp"><b>' + esc(block.label || "") + (block.label ? ": " : "") + "</b>" +
            esc(block.items.join(" · ")) + "</p>"
          );
        } else if (block.type === "entry") {
          parts.push(
            '<table class="ent"><tr>' +
            '<td class="ent-l">' + block.heading + "</td>" +
            '<td class="ent-r">' + esc(block.meta) + "</td>" +
            "</tr></table>"
          );
          if (block.sub) parts.push('<p class="sub">' + esc(block.sub) + "</p>");
          if (block.bullets.length) {
            parts.push("<ul>" + block.bullets.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>");
          }
          block.groups.forEach(function (g) {
            parts.push(
              '<p class="grp"><b>' + esc(g.label || "") + (g.label ? ": " : "") + "</b>" +
              esc(g.items.join(" · ")) + "</p>"
            );
          });
        }
      });
    });

    var styles = [
      "@page WordSection1 { size: 21cm 29.7cm; margin: 1.5cm 1.7cm 1.5cm 1.7cm; }",
      "div.WordSection1 { page: WordSection1; }",
      "body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; color: #1f2430; line-height: 1.35; }",
      "h1.nm { font-size: 22pt; margin: 0 0 2pt; color: #10233d; letter-spacing: -.4pt; }",
      "p.role { font-size: 10.5pt; margin: 0 0 4pt; color: #b26a08; font-weight: bold; }",
      "p.contact { font-size: 9pt; margin: 0 0 6pt; color: #45506a; }",
      "p.contact a { color: #45506a; text-decoration: none; }",
      "p.contact span.sep { color: #b8c0d0; }",
      "p.rule { border-bottom: 1pt solid #b26a08; margin: 0 0 10pt; padding: 0; height: 0; line-height: 0; }",
      "h2 { font-size: 11.5pt; margin: 14pt 0 5pt; color: #10233d; text-transform: uppercase; letter-spacing: .6pt; border-bottom: .75pt solid #d5dae4; padding-bottom: 2pt; }",
      "p { margin: 0 0 6pt; }",
      "table.ent { width: 100%; border-collapse: collapse; margin: 8pt 0 1pt; }",
      "td.ent-l { font-size: 11pt; font-weight: bold; color: #10233d; padding: 0; }",
      "td.ent-r { font-size: 9pt; color: #5a6478; text-align: right; white-space: nowrap; padding: 0; }",
      "p.sub { font-size: 9.5pt; color: #5a6478; font-style: italic; margin: 0 0 4pt; }",
      "ul { margin: 0 0 6pt 0; padding-left: 16pt; }",
      "li { margin: 0 0 3pt; }",
      "p.grp { font-size: 9.5pt; color: #45506a; margin: 3pt 0 6pt; }",
      "b, strong { color: #10233d; }",
      "a { color: #10233d; }"
    ].join("\n");

    return (
      "\ufeff<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
      "xmlns:w='urn:schemas-microsoft-com:office:word' " +
      "xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'>" +
      "<title>" + esc(h.name) + " — Resume</title>" +
      "<!--[if gte mso 9]><xml><w:WordDocument>" +
      "<w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/>" +
      "</w:WordDocument></xml><![endif]-->" +
      "<style>" + styles + "</style></head>" +
      "<body><div class='WordSection1'>" + parts.join("") + "</div></body></html>"
    );
  }

  function download(filename, html) {
    var blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportWord() {
    try {
      var model = collect();
      var html = buildWordDocument(model);
      var stamp = new Date().toISOString().slice(0, 7); // YYYY-MM
      download("Mayank-Kumar-Resume-" + stamp + ".doc", html);
      toast("Word document downloaded");
    } catch (err) {
      console.error(err);
      toast("Export failed — try Print / PDF instead");
    }
  }

  ["exportWord", "exportWord2"].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", exportWord);
  });

  var printBtn = document.getElementById("printBtn");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      document.querySelectorAll("details.more").forEach(function (d) { d.open = true; });
      window.print();
    });
  }

  // Expose for quick manual verification in the console.
  window.__resumeExport = { collect: collect, buildWordDocument: buildWordDocument };
})();
