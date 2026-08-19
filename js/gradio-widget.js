(function () {
  const openButton = document.querySelector("#exam-inquiry-button");
  const panel = document.querySelector("#gradio-chat-panel");
  const closeButton = document.querySelector("#gradio-chat-close");

  if (!openButton || !panel || !closeButton) return;

  function openChat() {
    panel.hidden = false;
    openButton.setAttribute("aria-expanded", "true");
    closeButton.focus();
  }

  function closeChat() {
    panel.hidden = true;
    openButton.setAttribute("aria-expanded", "false");
    openButton.focus();
  }

  openButton.addEventListener("click", openChat);
  closeButton.addEventListener("click", closeChat);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) closeChat();
  });
})();
