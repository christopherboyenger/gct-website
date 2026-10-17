(() => {
  "use strict";
  document.documentElement?.classList.add("has-js");
  if (
    location.pathname === "/" &&
    ["#creators", "#brands"].includes(location.hash)
  ) {
    location.replace(
      (location.hash === "#brands" ? "/brands" : "/creators") + location.search,
    );
    return;
  }
  const PUBLIC_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dXFqcGN4bm5pa2JpZ2l4dXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNDI1OTIsImV4cCI6MjA4OTgxODU5Mn0.KapJSHim09aVHucFvnsvuRVKNocvAnIeVIrqI565YfY";
  const emit = (event, detail = {}) => {
    const payload = { event, page: location.pathname, ...detail };
    window.dispatchEvent(
      new CustomEvent("gct:conversion", { detail: payload }),
    );
    if (Array.isArray(window.dataLayer)) window.dataLayer.push(payload);
  };
  emit("gct_page_view");
  document
    .querySelectorAll("[data-track]")
    .forEach((a) =>
      a.addEventListener("click", () =>
        emit("gct_cta_click", { action: a.dataset.track }),
      ),
    );
  const menu = document.querySelector(".menu-toggle"),
    nav = document.querySelector(".nav-links");
  function closeMenu() {
    if (!menu) return;
    nav.classList.remove("is-open");
    menu.setAttribute("aria-expanded", "false");
    menu.textContent = "Menu";
  }
  menu?.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    nav.classList.toggle("is-open", open);
    menu.setAttribute("aria-expanded", String(open));
    menu.textContent = open ? "Close" : "Menu";
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu?.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menu.focus();
    }
  });
  nav
    ?.querySelectorAll("a")
    .forEach((a) => a.addEventListener("click", closeMenu));
  matchMedia("(min-width:761px)").addEventListener("change", closeMenu);
  const goals = {
    "Creator content": [
      "Content with a golf perspective",
      "Discuss product demonstrations, on-course stories and other creator-made assets. Agree on deliverables, revisions and the channels where you can use the content.",
    ],
    "Product seeding": [
      "Put your product in play",
      "Discuss the creators your product suits, what you can supply and whether any content deliverables are being agreed. Gifting alone does not guarantee a post.",
    ],
    "Creator partnerships": [
      "Build an ongoing connection",
      "Discuss a longer relationship with creators who fit your brand, with a clear scope, compensation, usage rights and review points.",
    ],
  };
  document.querySelectorAll("[data-goal]").forEach((button) =>
    button.addEventListener("click", () => {
      const goal = button.dataset.goal;
      document
        .querySelectorAll("[data-goal]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      document.getElementById("goal-title").textContent = goals[goal][0];
      document.getElementById("goal-copy").textContent = goals[goal][1];
      const select = document.querySelector("select[name=goal]");
      if (select) select.value = goal;
      emit("gct_goal_selected", { goal });
    }),
  );
  document.querySelectorAll("[data-film]").forEach((button) => {
    const video = button.parentElement.querySelector("video");
    button.addEventListener("click", async () => {
      if (video.paused) {
        try {
          await video.play();
          button.textContent = "Pause";
          button.setAttribute(
            "aria-label",
            "Pause " + video.getAttribute("aria-label"),
          );
        } catch {
          button.textContent = "Try again";
        }
      } else {
        video.pause();
        button.textContent = "Play";
        button.setAttribute(
          "aria-label",
          "Play " + video.getAttribute("aria-label"),
        );
      }
    });
    video.addEventListener("pause", () => {
      button.textContent = "Play";
    });
  });
  const filmObserver =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((e) => {
              if (!e.isIntersecting) e.target.pause();
            }),
          { threshold: 0.05 },
        )
      : null;
  document.querySelectorAll("video").forEach((v) => filmObserver?.observe(v));
  document.querySelectorAll(".lead-form[data-audience]").forEach((form) => {
    let pending = false,
      started = false;
    const button = form.querySelector("[type=submit]"),
      status = form.querySelector("[role=status]"),
      label = button.textContent,
      audience = form.dataset.audience;
    form.addEventListener("input", () => {
      if (!started) {
        emit("gct_form_started", { audience });
        started = true;
      }
      form.elements.name.setCustomValidity("");
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pending) return;
      if (!form.elements.name.value.trim()) {
        form.elements.name.setCustomValidity("Enter your name.");
        form.elements.name.reportValidity();
        return;
      }
      if (!form.reportValidity()) return;
      pending = true;
      button.disabled = true;
      button.textContent = "Saving…";
      form.setAttribute("aria-busy", "true");
      status.hidden = true;
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 15000);
      const profile = form.elements.profile.value.trim();
      const body = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        audience,
        profile:
          audience === "brand"
            ? profile + " | " + form.elements.goal.value
            : profile,
        consent: form.elements.consent.checked,
        website: form.elements.website.value,
      };
      try {
        const response = await fetch(form.action, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: PUBLIC_KEY,
            Authorization: "Bearer " + PUBLIC_KEY,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success !== true)
          throw new Error(
            response.status === 429
              ? "Too many attempts. Please wait a little and try again."
              : response.status === 400
                ? data.error || "Check your details and try again."
                : "We couldn’t save your details. Please try again.",
          );
        form.reset();
        status.className = "form-status";
        status.textContent =
          audience === "brand"
            ? "Your interest is saved. We’ll contact you about brand opportunities for the next season."
            : "You’re on the creator waitlist. We’ll email you about the next season and opportunities to take part.";
        emit("gct_form_submitted", { audience });
        started = false;
      } catch (error) {
        status.className = "form-status error";
        status.textContent =
          error.name === "AbortError"
            ? "The connection took too long. Your details are still here. Please try again."
            : error instanceof TypeError
              ? "Unable to connect. Your details are still here. Check your connection and try again."
              : error.message;
        emit("gct_form_error", { audience });
      } finally {
        clearTimeout(timeout);
        pending = false;
        button.disabled = false;
        button.textContent = label;
        form.removeAttribute("aria-busy");
        status.hidden = false;
        status.focus();
      }
    });
  });
  document
    .querySelector("[data-experience]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      if (!f.reportValidity()) return;
      const body = [
        "Property: " + f.elements.property.value.trim(),
        "Location: " + f.elements.location.value.trim(),
        "Format: " + f.elements.format.value,
        "Timing: " + f.elements.timing.value.trim(),
        "",
        "I’d like to discuss a GCT creator experience.",
      ].join("\n");
      location.href =
        "mailto:info@golfcreatoropen.com?subject=" +
        encodeURIComponent("GCT creator experience inquiry") +
        "&body=" +
        encodeURIComponent(body);
      emit("gct_experience_email_prepared");
    });
})();
