/*
 * Visualizador dos diagramas Mermaid.
 *
 * Envolve cada diagrama renderizado em uma área rolável com controles de
 * ampliação, ajuste à largura e tela cheia. Sem isso os diagramas maiores ficam
 * reduzidos à largura da coluna de texto e os rótulos se tornam ilegíveis.
 *
 * O ponto de entrada é `window.oficinaDiagram.enhance`, chamado por
 * `mermaid-setup.js` assim que o tema insere o SVG na página.
 */
(function () {
  "use strict";

  var MIN_SCALE = 0.1;
  var MAX_SCALE = 4;
  var FACTOR = 1.3;

  var TEXT = {
    group: "Diagrama",
    zoomIn: "Ampliar",
    zoomOut: "Reduzir",
    fit: "Ajustar à largura",
    enter: "Abrir em tela cheia",
    exit: "Sair da tela cheia",
    level: "Nível de ampliação",
    hint: "Amplie, ajuste à largura ou abra em tela cheia. Ampliado, arraste para deslocar."
  };

  var PATH = {
    zoomOut: "M19 13H5v-2h14v2Z",
    zoomIn: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z",
    fit: "M4 9V4h5v2H6v3H4m11-5h5v5h-2V6h-3V4M4 15h2v3h3v2H4v-5m14 0h2v5h-5v-2h3v-3Z",
    enter: "M5 5h6v2H7v4H5V5m8 0h6v6h-2V7h-4V5m4 8h2v6h-6v-2h4v-4M5 13h2v4h4v2H5v-6Z",
    exit: "M9 5h2v6H5V9h4V5m4 0h2v4h4v2h-6V5m-8 8h6v6h-2v-4H5v-2m10 0h6v2h-4v4h-2v-6Z"
  };

  function icon(path) {
    return (
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="' +
      path +
      '"/></svg>'
    );
  }

  function button(action, label, path) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = "oficina-diagram__button";
    el.dataset.action = action;
    el.title = label;
    el.setAttribute("aria-label", label);
    el.innerHTML = icon(path);
    return el;
  }

  function clamp(value) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function View(host, size) {
    this.host = host;
    this.natural = size && size.width > 0 ? size : null;
    this.scale = 1;
    this.fitted = true;
    this.build();
    this.fit();
  }

  View.prototype.build = function () {
    var view = this;

    var root = document.createElement("div");
    root.className = "oficina-diagram";
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", TEXT.group);

    var stage = document.createElement("div");
    stage.className = "oficina-diagram__stage";
    stage.tabIndex = 0;

    var bar = document.createElement("div");
    bar.className = "oficina-diagram__bar";

    var hint = document.createElement("p");
    hint.className = "oficina-diagram__hint";
    hint.textContent = TEXT.hint;

    var actions = document.createElement("div");
    actions.className = "oficina-diagram__actions";

    var level = document.createElement("span");
    level.className = "oficina-diagram__level";
    level.setAttribute("aria-label", TEXT.level);
    level.setAttribute("aria-live", "polite");

    var full = button("full", TEXT.enter, PATH.enter);

    actions.appendChild(level);
    actions.appendChild(button("out", TEXT.zoomOut, PATH.zoomOut));
    actions.appendChild(button("in", TEXT.zoomIn, PATH.zoomIn));
    actions.appendChild(button("fit", TEXT.fit, PATH.fit));
    actions.appendChild(full);

    bar.appendChild(hint);
    bar.appendChild(actions);

    this.host.parentNode.insertBefore(root, this.host);
    stage.appendChild(this.host);
    root.appendChild(stage);
    root.appendChild(bar);

    this.root = root;
    this.stage = stage;
    this.level = level;
    this.fullButton = full;

    actions.addEventListener("click", function (event) {
      var target = event.target.closest("[data-action]");
      if (!target) {
        return;
      }
      if (target.dataset.action === "in") {
        view.zoom(FACTOR);
      } else if (target.dataset.action === "out") {
        view.zoom(1 / FACTOR);
      } else if (target.dataset.action === "fit") {
        view.fit();
      } else {
        view.toggleFullscreen();
      }
    });

    stage.addEventListener(
      "wheel",
      function (event) {
        if (!event.ctrlKey && !event.metaKey) {
          return;
        }
        event.preventDefault();
        view.zoom(event.deltaY < 0 ? FACTOR : 1 / FACTOR, event);
      },
      { passive: false }
    );

    this.bindDrag();

    window.addEventListener("resize", function () {
      if (view.root.isConnected && view.fitted) {
        view.fit();
      }
    });
  };

  /* Deslocamento por arraste, disponível apenas quando o diagrama transborda. */
  View.prototype.bindDrag = function () {
    var view = this;
    var origin = null;

    this.stage.addEventListener("pointerdown", function (event) {
      var overflowX = view.stage.scrollWidth > view.stage.clientWidth;
      var overflowY = view.stage.scrollHeight > view.stage.clientHeight;
      if (event.button !== 0 || (!overflowX && !overflowY)) {
        return;
      }
      origin = {
        x: event.clientX,
        y: event.clientY,
        left: view.stage.scrollLeft,
        top: view.stage.scrollTop
      };
      view.stage.setPointerCapture(event.pointerId);
      view.stage.classList.add("is-dragging");
      event.preventDefault();
    });

    this.stage.addEventListener("pointermove", function (event) {
      if (!origin) {
        return;
      }
      view.stage.scrollLeft = origin.left - (event.clientX - origin.x);
      view.stage.scrollTop = origin.top - (event.clientY - origin.y);
    });

    ["pointerup", "pointercancel"].forEach(function (name) {
      view.stage.addEventListener(name, function () {
        origin = null;
        view.stage.classList.remove("is-dragging");
      });
    });
  };

  /* Largura útil da área rolável, já descontado o espaçamento interno. */
  View.prototype.width = function () {
    var style = window.getComputedStyle(this.stage);
    var inner =
      this.stage.clientWidth -
      parseFloat(style.paddingLeft || 0) -
      parseFloat(style.paddingRight || 0);
    return Math.max(inner, 1);
  };

  /* Escala em que o diagrama cabe na largura disponível, nunca acima do natural. */
  View.prototype.fitScale = function () {
    if (!this.natural) {
      return 1;
    }
    return clamp(Math.min(1, this.width() / this.natural.width));
  };

  View.prototype.fit = function () {
    this.apply(this.fitScale());
    this.fitted = true;
  };

  View.prototype.zoom = function (factor, event) {
    var before = this.scale;
    var next = clamp(before * factor);
    if (next === before) {
      return;
    }

    var anchorX = this.stage.clientWidth / 2;
    var anchorY = this.stage.clientHeight / 2;
    if (event) {
      var box = this.stage.getBoundingClientRect();
      anchorX = event.clientX - box.left;
      anchorY = event.clientY - box.top;
    }

    var ratio = next / before;
    var left = (this.stage.scrollLeft + anchorX) * ratio - anchorX;
    var top = (this.stage.scrollTop + anchorY) * ratio - anchorY;

    this.apply(next);
    this.fitted = false;
    this.stage.scrollLeft = left;
    this.stage.scrollTop = top;
  };

  View.prototype.apply = function (scale) {
    this.scale = scale;
    if (this.natural) {
      this.host.style.width = Math.round(this.natural.width * scale) + "px";
    }
    /* Acima do ajuste à largura o diagrama ganha uma área rolável própria. */
    this.root.classList.toggle("is-zoomed", scale > this.fitScale() + 0.001);
    this.level.textContent = Math.round(scale * 100) + "%";
  };

  View.prototype.toggleFullscreen = function () {
    if (fullscreenElement() === this.root) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else if (this.root.requestFullscreen) {
      this.root.requestFullscreen();
    } else if (this.root.webkitRequestFullscreen) {
      this.root.webkitRequestFullscreen();
    }
  };

  View.prototype.syncFullscreen = function () {
    var active = fullscreenElement() === this.root;
    this.root.classList.toggle("is-fullscreen", active);
    this.fullButton.title = active ? TEXT.exit : TEXT.enter;
    this.fullButton.setAttribute("aria-label", active ? TEXT.exit : TEXT.enter);
    this.fullButton.innerHTML = icon(active ? PATH.exit : PATH.enter);
    this.fit();
  };

  var views = [];

  ["fullscreenchange", "webkitfullscreenchange"].forEach(function (name) {
    document.addEventListener(name, function () {
      views = views.filter(function (view) {
        return view.root.isConnected;
      });
      views.forEach(function (view) {
        view.syncFullscreen();
      });
    });
  });

  window.oficinaDiagram = {
    enhance: function (host, size) {
      if (!host || host.dataset.oficinaDiagram || !host.parentNode) {
        return;
      }
      host.dataset.oficinaDiagram = "true";
      views.push(new View(host, size));
    }
  };
})();
