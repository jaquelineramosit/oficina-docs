/*
 * Configuração do Mermaid usado pelo Material for MkDocs.
 *
 * Resolve dois problemas de renderização dos diagramas:
 *
 * 1. Layout ELK. O tema carrega o Mermaid a partir do CDN, mas sem o pacote de
 *    layout ELK. Sem ele, os diagramas declarados com `config: layout: elk` no
 *    front matter caem silenciosamente no layout padrão (dagre) e o site mostra
 *    um arranjo diferente do descrito nos arquivos Markdown.
 *
 * 2. Cores e dimensões. O tema injeta o SVG em um shadow root fechado, fora do
 *    alcance do `extra.css`. As correções de contraste e de escala precisam,
 *    portanto, ser aplicadas ao próprio SVG antes da inserção.
 *
 * O script publica um `window.mermaid` antes do primeiro uso do tema. O Material
 * detecta a variável já definida, deixa de baixar sua própria cópia e passa a
 * usar esta instância.
 */
(function () {
  "use strict";

  var MERMAID_URL = "https://unpkg.com/mermaid@11.16.0/dist/mermaid.esm.min.mjs";
  var ELK_URL =
    "https://unpkg.com/@mermaid-js/layout-elk@0.2.2/dist/mermaid-layout-elk.esm.min.mjs";

  /*
   * Os diagramas declaram cores fixas em `classDef` e `style`, pensadas para o
   * tema claro. Cada cor autoral é trocada por uma variável CSS equivalente,
   * definida em `extra.css` para os dois temas. Variáveis CSS atravessam o
   * shadow root, então a troca de tema continua funcionando sem re-renderizar.
   */
  var PALETTE = {
    /* Azul: ator, aplicação, API, portas, estados da saga. */
    "#E8F1F8": "--oficina-dg-blue-bg",
    "#3F6075": "--oficina-dg-blue-line",
    /* Verde-azulado: rede, bancos, consultas, conclusão com sucesso. */
    "#EEF4F2": "--oficina-dg-teal-bg",
    "#00897B": "--oficina-dg-teal-line",
    /* Âmbar: borda pública, Lambda, infraestrutura, decisão, alerta. */
    "#FFF8E1": "--oficina-dg-amber-bg",
    "#A06A00": "--oficina-dg-amber-line",
    "#2F2500": "--oficina-dg-amber-fg",
    /* Cinza: filas, domínio, adaptadores. */
    "#F4F7FB": "--oficina-dg-gray-bg",
    "#627282": "--oficina-dg-gray-line",
    /* Escuro: provedor externo e estados finais. */
    "#263238": "--oficina-dg-dark-bg",
    "#111922": "--oficina-dg-dark-line",
    /* Texto padrão dos nós. */
    "#1F2933": "--oficina-dg-fg",
    /* Fundos e bordas dos subgráficos. */
    "#FFF9E8": "--oficina-dg-amber-surface",
    "#E6D4A3": "--oficina-dg-amber-border",
    "#F3FAF8": "--oficina-dg-teal-surface",
    "#B7DCD6": "--oficina-dg-teal-border",
    "#F6F8FB": "--oficina-dg-gray-surface",
    "#D9E1EA": "--oficina-dg-gray-border"
  };

  var PALETTE_RE = new RegExp(Object.keys(PALETTE).join("|"), "gi");

  var UPPERCASE = {};
  Object.keys(PALETTE).forEach(function (hex) {
    UPPERCASE[hex.toUpperCase()] = PALETTE[hex];
  });

  /*
   * O tema define `.nodeLabel p { color: ... }`, que vence a herança e anula a
   * cor declarada no `classDef` — o texto dos nós escuros ficava ilegível.
   * Devolver o parágrafo para `inherit` reativa a cor autoral.
   */
  var PATCH_CSS =
    "<style>" +
    ".nodeLabel p,.nodeLabel span{color:inherit!important}" +
    "</style>";

  function themeAware(svg) {
    return svg.replace(PALETTE_RE, function (hex) {
      return "var(" + UPPERCASE[hex.toUpperCase()] + ")";
    });
  }

  /*
   * O Mermaid limita o SVG à largura natural do diagrama (`max-width`), o que
   * impede qualquer ampliação. A restrição é removida e o dimensionamento passa
   * a ser controlado pelo elemento que hospeda o diagrama.
   */
  function fluidSize(svg) {
    return svg.replace(/<svg\b[^>]*>/, function (tag) {
      return (
        tag
          .replace(/\sstyle="[^"]*"/g, "")
          .replace(/\swidth="[^"]*"/g, "")
          .replace(/\sheight="[^"]*"/g, "")
          .replace(/>$/, "") + ' style="width:100%;height:auto;display:block">'
      );
    });
  }

  function naturalSize(svg) {
    var box = /viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/.exec(svg);
    if (!box) {
      return null;
    }
    return { width: parseFloat(box[1]), height: parseFloat(box[2]) };
  }

  if (window.mermaid) {
    return;
  }

  var engine = null;
  var config = null;

  function preconnect() {
    var link = document.createElement("link");
    link.rel = "preconnect";
    link.href = "https://unpkg.com";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }

  function load() {
    if (!engine) {
      engine = Promise.all([import(MERMAID_URL), import(ELK_URL)]).then(function (modules) {
        var mermaid = modules[0].default;
        mermaid.registerLayoutLoaders(modules[1].default);
        if (config) {
          mermaid.initialize(config);
        }
        return mermaid;
      });
    }
    return engine;
  }

  window.mermaid = {
    initialize: function (options) {
      config = options;
      if (engine) {
        engine.then(function (mermaid) {
          mermaid.initialize(options);
        });
      }
    },

    render: function (id, text, container) {
      return load()
        .then(function (mermaid) {
          return mermaid.render(id, text, container);
        })
        .then(function (result) {
          var size = naturalSize(result.svg);
          var svg = themeAware(fluidSize(result.svg)).replace(
            /<\/svg>\s*$/,
            PATCH_CSS + "</svg>"
          );

          return {
            svg: svg,

            /*
             * O Material chama esta função com o shadow root logo após inserir o
             * diagrama na página. É o único acesso ao conteúdo renderizado, já
             * que o shadow root é fechado.
             */
            fn: function (shadow) {
              if (result.bindFunctions) {
                result.bindFunctions(shadow);
              }
              var viewer = window.oficinaDiagram;
              if (viewer && shadow.host) {
                viewer.enhance(shadow.host, size);
              }
            }
          };
        });
    }
  };

  /*
   * Em páginas com diagramas, a busca dos módulos começa imediatamente, sem
   * esperar o tema montar o primeiro diagrama. Reduz o tempo em que o bloco
   * aparece como código bruto em conexões lentas.
   */
  if (document.querySelector("pre.mermaid, .mermaid")) {
    preconnect();
    load();
  }
})();
