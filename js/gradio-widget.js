(function () {
  const openButton = document.querySelector("#exam-inquiry-button");
  const panel = document.querySelector("#gradio-chat-panel");
  const closeButton = document.querySelector("#gradio-chat-close");
  const darkSections = [...(document.querySelectorAll?.(".hero, .lookup-section, .footer") || [])];

  if (!openButton || !panel || !closeButton) return;

  function updateButtonContrast() {
    if (!openButton.getBoundingClientRect || !darkSections.length) return;
    const buttonRect = openButton.getBoundingClientRect();
    const buttonCenterY = buttonRect.top + buttonRect.height / 2;
    const isOnDarkBackground = darkSections.some((section) => {
      const sectionRect = section.getBoundingClientRect();
      return buttonCenterY >= sectionRect.top && buttonCenterY <= sectionRect.bottom;
    });
    openButton.classList.toggle("on-dark-background", isOnDarkBackground);
  }

  let contrastFrame = null;
  function scheduleContrastUpdate() {
    if (contrastFrame !== null) return;
    contrastFrame = true;
    const update = () => {
      contrastFrame = null;
      updateButtonContrast();
    };
    if (typeof window !== "undefined" && window.requestAnimationFrame) window.requestAnimationFrame(update);
    else setTimeout(update, 0);
  }

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
  if (typeof window !== "undefined") {
    window.addEventListener("scroll", scheduleContrastUpdate, { passive: true });
    window.addEventListener("resize", scheduleContrastUpdate);
  }
  updateButtonContrast();
})();
