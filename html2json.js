function convertHtml2JsonAndSet() {
  const htmlTextAreaValue = document.getElementById("html").value;
  const jsonObj = html2json(htmlTextAreaValue);
  const jsonArea = document.getElementById("json");
  jsonArea.textContent = JSON.stringify(jsonObj, null, 2);
}

function html2json(htmlText) {
  let i = 0;

  const voidTags = new Set([
    "area", "base", "br", "col", "embed",
    "hr", "img", "input", "link", "meta",
    "param", "source", "track", "wbr"
  ]);

  function skipSpaces() {
    while (i < htmlText.length && /\s/.test(htmlText[i])) {
      i++;
    }
  }

  // Читаємо тег до символу >, враховуючи лапки
  function readTag() {
    const start = i;
    let quote = null;

    while (i < htmlText.length) {
      const char = htmlText[i++];

      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        break;
      }
    }

    return htmlText.slice(start, i);
  }


  function parseCSS(css) {
    const result = {};

    // Знаходимо блоки: селектор { оголошення }
    const blocks = css.matchAll(/([^{}]+)\{([^{}]*)\}/g);

    for (const block of blocks) {
      const selectors = block[1]
        .trim()
        .split(",")
        .map(selector => selector.trim());

      const declarations = {};

      block[2].split(";").forEach(declaration => {
        const colon = declaration.indexOf(":");

        if (colon === -1) return;

        const property = declaration.slice(0, colon).trim();
        const value = declaration.slice(colon + 1).trim();

        if (property && value) {
          declarations[property] = value;
        }
      });

      for (const selector of selectors) {
        if (selector) {
          result[selector] = {
            ...(result[selector] || {}),
            ...declarations
          };
        }
      }
    }

    return result;
  }

  // Розбираємо назву тега та атрибути
  function parseOpeningTag(source) {
    const match = source.match(/^<\s*([^\s/>]+)/);

    if (!match) return null;

    const tag = match[1].toLowerCase();
    const attributes = {};

    const rest = source.slice(match[0].length)
      .replace(/\/?\s*>$/, "");

    const attrRegex =
      /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

    let attr;

    while ((attr = attrRegex.exec(rest)) !== null) {
      const name = attr[1].toLowerCase();
      const value = attr[2] ?? attr[3] ?? attr[4] ?? "";

      attributes[name] = value;
    }

    return { tag, attributes };
  }

  // Розбираємо один HTML-елемент
  function parseElement() {
    if (htmlText[i] !== "<" ||
      htmlText.startsWith("</", i) ||
      htmlText.startsWith("<!--", i)) {
      return null;
    }

    const source = readTag();
    const parsed = parseOpeningTag(source);

    if (!parsed) return null;

    const { tag, attributes } = parsed;

    const result = { tag };

    if (Object.keys(attributes).length > 0) {
      result.attributes = attributes;
    }

    // Теги без вкладеного вмісту
    if (voidTags.has(tag) || /\/\s*>$/.test(source)) {
      return result;
    }

    const children = [];
    let text = "";

    while (i < htmlText.length) {
      // HTML-коментар
      if (htmlText.startsWith("<!--", i)) {
        const end = htmlText.indexOf("-->", i + 4);
        i = end === -1 ? htmlText.length : end + 3;
        continue;
      }

      // Закривальний тег
      if (htmlText.startsWith("</", i)) {
        const end = htmlText.indexOf(">", i);

        if (end === -1) {
          i = htmlText.length;
          break;
        }

        const closingTag = htmlText
          .slice(i + 2, end)
          .trim()
          .split(/\s/)[0]
          .toLowerCase();

        i = end + 1;

        if (closingTag === tag) break;

        continue;
      }

      // Дочірній елемент
      if (htmlText[i] === "<" &&
        i + 1 < htmlText.length &&
        /[a-zA-Z]/.test(htmlText[i + 1])) {
        const child = parseElement();

        if (child) {
          children.push(child);
          continue;
        }
      }

      // Звичайний текст
      if (htmlText[i] !== "<") {
        const start = i;

        while (i < htmlText.length && htmlText[i] !== "<") {
          i++;
        }

        const value = htmlText.slice(start, i);

        if (tag === "style" || tag === "script") {
          text += value;
        } else {
          const trimmed = value.trim();

          if (trimmed) {
            text += (text ? " " : "") + trimmed;
          }
        }
      } else {
        // Наприклад, декларація або некоректний фрагмент
        i++;
      }
    }

    if (text) {
      if (tag === "style") {
        result.css = parseCSS(text);
      } else if (tag === "script") {
        // Залишаємо JavaScript масивом рядків
        result.text = text
          .split("\n")
          .map(line => line.trim())
          .filter(line => line.trim() !== "");
      } else {
        result.text = text;
      }
    }

    if (children.length) {
      result.children = children;
    }

    return result;
  }

  // Розбираємо кореневі елементи
  let result;

  while (i < htmlText.length) {
    skipSpaces();

    if (i >= htmlText.length) break;

    if (htmlText.startsWith("<!--", i)) {
      const end = htmlText.indexOf("-->", i + 4);
      i = end === -1 ? htmlText.length : end + 3;
      continue;
    }

    if (htmlText[i] === "<" &&
      i + 1 < htmlText.length &&
      /[a-zA-Z]/.test(htmlText[i + 1])) {
      const node = parseElement();

      if (node) result = node;
    } else {
      // Пропускаємо декларації та сторонній текст
      const next = htmlText.indexOf("<", i + 1);
      i = next === -1 ? htmlText.length : next;
    }
  }

  return {
    "Conversion results": result,
    "input length": htmlText.length,
  };

}

function showExample1() {
  const htmlExample =
    `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport">
    <title>Sample HTML</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>Welcome to My Website</h1>
    </header>
    <nav>
        <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
        </ul>
    </nav>
    <main>
        <section id="home">
            <h2>Home Section</h2>
            <p>This is the home section of the webpage.</p>
        </section>
        <section id="about">
            <h2>About Section</h2>
            <p>This is the about section of the webpage.</p>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 My Website</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>
`;
  const jsonContent = {
    "Comment 1":
      "You have to think about how to take into account various html inputs so your json structure will cover them all and handle different cases.",
    "Comment 2":
      "When you make any choice in terms of selecting specific json structure for conversion - be ready to provide reasoning behind such choice.",
  };

  document.getElementById("html").value = htmlExample;
  document.getElementById("json").textContent = JSON.stringify(
    jsonContent,
    null,
    2
  );
}

function showExample2() {
  const htmlExample = `<div>
<p>Hello world!</p>
  <button>Click me!</button>
  <textarea>Some very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long string.</textarea>
</div>
`;
  const jsonContent = {
    "Comment 1":
      "You have to think about how to take into account various html inputs so your json structure will cover them all and handle different cases.",
    "Comment 2":
      "When you make any choice in terms of selecting specific json structure for conversion - be ready to provide reasoning behind such choice.",
  };

  document.getElementById("html").value = htmlExample;
  document.getElementById("json").textContent = JSON.stringify(
    jsonContent,
    null,
    2
  );
}
