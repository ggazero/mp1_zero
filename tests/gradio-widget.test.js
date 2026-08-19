const test = require("node:test");
const assert = require("node:assert/strict");

function createElement({ hidden = false } = {}) {
  const classes = new Set();
  return {
    hidden,
    attributes: {},
    listeners: {},
    focused: false,
    classList: {
      toggle(name, force) { force ? classes.add(name) : classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    focus() { this.focused = true; }
  };
}

test("시험 문의 패널을 열고 닫아도 접수 폼 입력값이 유지된다", () => {
  let heroBottom = 900;
  const openButton = createElement();
  openButton.getBoundingClientRect = () => ({ top: 700, height: 60 });
  const panel = createElement({ hidden: true });
  const closeButton = createElement();
  const hero = createElement();
  hero.getBoundingClientRect = () => ({ top: 0, bottom: heroBottom });
  const footer = createElement();
  footer.getBoundingClientRect = () => ({ top: 1200, bottom: 1300 });
  const documentListeners = {};
  const windowListeners = {};
  const formValues = {
    certificate: "한식조리기능사",
    name: "홍길동",
    phone: "010-1234-5678",
    note: "오후 연락 요청"
  };

  global.document = {
    querySelector(selector) {
      return {
        "#exam-inquiry-button": openButton,
        "#gradio-chat-panel": panel,
        "#gradio-chat-close": closeButton
      }[selector];
    },
    querySelectorAll(selector) { return selector === ".hero, .lookup-section, .footer" ? [hero, footer] : []; },
    addEventListener(name, handler) { documentListeners[name] = handler; }
  };
  global.window = {
    addEventListener(name, handler) { windowListeners[name] = handler; },
    requestAnimationFrame(handler) { handler(); return 1; }
  };

  delete require.cache[require.resolve("../js/gradio-widget.js")];
  require("../js/gradio-widget.js");

  assert.equal(openButton.classList.contains("on-dark-background"), true);
  heroBottom = 500;
  windowListeners.scroll();
  assert.equal(openButton.classList.contains("on-dark-background"), false);

  openButton.listeners.click();
  assert.equal(panel.hidden, false);
  assert.equal(openButton.attributes["aria-expanded"], "true");
  assert.equal(closeButton.focused, true);

  closeButton.listeners.click();
  assert.equal(panel.hidden, true);
  assert.equal(openButton.attributes["aria-expanded"], "false");
  assert.deepEqual(formValues, {
    certificate: "한식조리기능사",
    name: "홍길동",
    phone: "010-1234-5678",
    note: "오후 연락 요청"
  });

  delete global.document;
  delete global.window;
});
