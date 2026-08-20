(function () {
  const openButton = document.querySelector("#exam-inquiry-button");
  const panel = document.querySelector("#gradio-chat-panel");
  const closeButton = document.querySelector("#gradio-chat-close");
  const frame = document.querySelector("#gradio-chat-frame");
  const darkSections = [...(document.querySelectorAll?.(".hero, .lookup-section, .footer") || [])];

  if (!openButton || !panel || !closeButton) return;

  let frameReloadCount = 0;
  const SESSION_KEEP_ALIVE_INTERVAL = 30000;

  function keepSessionAlive() {
    if (frame?.contentWindow) {
      try {
        frame.contentWindow.postMessage({ type: "keep_alive" }, "*");
      } catch (_) {
        // Cross-origin, silent fail
      }
    }
  }

  function trackFrameReload() {
    if (!frame) return;
    const initialSrc = frame.src;
    let watchInterval = null;

    const checkReload = () => {
      if (frame.src !== initialSrc && frame.src) {
        frameReloadCount++;
        console.warn(`Gradio iframe reloaded (${frameReloadCount}). Session may have timed out.`);
      }
    };

    const cleanup = () => {
      if (watchInterval) clearInterval(watchInterval);
    };

    const startWatching = () => {
      watchInterval = setInterval(checkReload, 5000);
      if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", cleanup);
      }
    };

    startWatching();
    return cleanup;
  }

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

  let sessionKeepAliveInterval = null;

  function injectFrameStyles() {
    if (!frame?.contentDocument) return;
    try {
      const style = frame.contentDocument.createElement("style");
      style.textContent = `
        * { font-size: 1.1em !important; }
        button { min-height: 48px !important; padding: 12px 20px !important; font-size: 18px !important; }
        input, textarea, select { min-height: 48px !important; padding: 12px !important; font-size: 18px !important; }
        .message-wrap { padding: 12px !important; }
        .chat-message { padding: 12px !important; font-size: 18px !important; }
        .textbox { font-size: 18px !important; }
      `;
      frame.contentDocument.head.appendChild(style);
    } catch (_) {
      // Cross-origin, retry after load
      setTimeout(injectFrameStyles, 1000);
    }
  }

  function openChat() {
    panel.hidden = false;
    openButton.setAttribute("aria-expanded", "true");
    closeButton.focus();

    if (!sessionKeepAliveInterval) {
      sessionKeepAliveInterval = setInterval(keepSessionAlive, SESSION_KEEP_ALIVE_INTERVAL);
    }

    setTimeout(injectFrameStyles, 500);
  }

  function closeChat() {
    panel.hidden = true;
    openButton.setAttribute("aria-expanded", "false");
    openButton.focus();

    if (sessionKeepAliveInterval) {
      clearInterval(sessionKeepAliveInterval);
      sessionKeepAliveInterval = null;
    }
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

  trackFrameReload();
  updateButtonContrast();
})();
