const test = require("node:test");
const assert = require("node:assert/strict");

function createElement({ hidden = false } = {}) {
  return {
    hidden,
    attributes: {},
    listeners: {},
    focused: false,
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    focus() { this.focused = true; }
  };
}

test("시험 문의 패널을 열고 닫아도 접수 폼 입력값이 유지된다", () => {
  const openButton = createElement();
  const panel = createElement({ hidden: true });
  const closeButton = createElement();
  const documentListeners = {};
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
    addEventListener(name, handler) { documentListeners[name] = handler; }
  };

  delete require.cache[require.resolve("../js/gradio-widget.js")];
  require("../js/gradio-widget.js");

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
});
