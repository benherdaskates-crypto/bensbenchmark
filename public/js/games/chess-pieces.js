/* ============================================================
   BensBenchmark chess pieces: one set of SVG drawings used
   everywhere (board, captures, promotion, previews), so every
   piece matches in size, weight and style.
   ChessPieces.svg('N') -> white knight, ChessPieces.svg('q') -> black queen.
   ============================================================ */
(function (root) {
  'use strict';

  // Drawn on a 45 x 45 grid. Body shapes take the piece colour;
  // .dt lines are details drawn in the opposite colour.
  const BASE = '<path d="M11 35.5h23a1.5 1.5 0 0 1 1.5 1.5v1.5a1.5 1.5 0 0 1-1.5 1.5H11a1.5 1.5 0 0 1-1.5-1.5V37a1.5 1.5 0 0 1 1.5-1.5z"/>';
  const SHAPES = {
    p: '<circle cx="22.5" cy="11.5" r="5.2"/>' +
       '<path d="M17.5 19h10l-1.6 3.2c3.4 3 5.1 7.5 5.1 13.3H14c0-5.8 1.7-10.3 5.1-13.3z"/>' + BASE,
    r: '<path d="M12 8.5h4.2v3.2h3.9V8.5h4.8v3.2h3.9V8.5H33v7.2l-3.2 3.1v12.9l3.2 3.8H12l3.2-3.8V18.8L12 15.7z"/>' +
       '<path class="dt" d="M15.2 18.8h14.6M15.2 31.7h14.6"/>' + BASE,
    n: '<path d="M14 35.5c-.3-6.2 2.1-10.5 6.6-13.6-3 .2-5.6 1.4-7.8 3.6l-3.1-2.9c.4-5.4 4.3-10.4 9.2-12.8l.6-3.8 3.4 3.1C30.7 9.6 35 15.4 35 23.6v11.9z"/>' +
       '<circle class="dt-fill" cx="20.6" cy="14.6" r="1.35"/>' +
       '<path class="dt" d="M11.6 22.9l1.9-1.1M26.5 12.6c3.2 2.3 5.1 6.4 5.4 11.6"/>' + BASE,
    b: '<circle cx="22.5" cy="7.4" r="2.6"/>' +
       '<path d="M22.5 10.3c-5.3 3.9-8.4 8.8-8.4 13.6 0 3.1 1.9 5.4 4.5 6.4h7.8c2.6-1 4.5-3.3 4.5-6.4 0-4.8-3.1-9.7-8.4-13.6z"/>' +
       '<path d="M16.6 30.3h11.8l2.2 5.2H14.4z"/>' +
       '<path class="dt" d="M24.6 15.4l-4.4 5.6"/>' + BASE,
    q: '<circle cx="9.8" cy="13.6" r="2.3"/><circle cx="16" cy="10.4" r="2.3"/><circle cx="22.5" cy="9.2" r="2.3"/><circle cx="29" cy="10.4" r="2.3"/><circle cx="35.2" cy="13.6" r="2.3"/>' +
       '<path d="M10.3 15.4l4.3 13.7h15.8l4.3-13.7-6 6.1-2.6-9.6-3.6 9.1-3.6-9.1-2.6 9.6z"/>' +
       '<path d="M14.4 29.1h16.2l1.6 6.4H12.8z"/>' +
       '<path class="dt" d="M14.6 29.1h15.8"/>' + BASE,
    k: '<path class="thick" d="M22.5 3.5v7.2M19 7.1h7"/>' +
       '<path d="M22.5 12.4c-3 0-5.1 2.1-5.1 5 0 1.8.7 3.2 1.9 4.4h6.4c1.2-1.2 1.9-2.6 1.9-4.4 0-2.9-2.1-5-5.1-5z"/>' +
       '<path d="M10.6 21.4c0-3.2 2.4-5.3 5.3-5.3 3 0 5.1 2 6.6 5.1 1.5-3.1 3.6-5.1 6.6-5.1 2.9 0 5.3 2.1 5.3 5.3 0 3.9-2.9 6.9-5.3 8.9H15.9c-2.4-2-5.3-5-5.3-8.9z"/>' +
       '<path d="M15.6 30.3h13.8l1.8 5.2H13.8z"/>' +
       '<path class="dt" d="M15.9 30.3h13.2"/>' + BASE,
  };

  const CSS = `
.cp { display:block; width:100%; height:100%; overflow:visible; }
.cp path, .cp circle { stroke-width:1.5; stroke-linejoin:round; stroke-linecap:round; }
.cp.w path, .cp.w circle { fill:#fbfbf8; stroke:#202024; }
.cp.b path, .cp.b circle { fill:#2b2b30; stroke:#0c0c0e; }
.cp .dt { fill:none !important; stroke-width:1.4; }
.cp.w .dt { stroke:#202024; } .cp.b .dt { stroke:#d8d8dc; }
.cp.w .dt-fill { fill:#202024 !important; stroke:none !important; } .cp.b .dt-fill { fill:#d8d8dc !important; stroke:none !important; }
.cp .thick { fill:none !important; stroke-width:2.6 !important; }
.cp.w .thick { stroke:#202024 !important; } .cp.b .thick { stroke:#0c0c0e !important; }
.cp { filter: drop-shadow(0 1.5px 1.2px rgba(0,0,0,.35)); }
`;
  function css() {
    if (typeof document === 'undefined' || document.getElementById('cp-css')) return;
    const s = document.createElement('style'); s.id = 'cp-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function svg(piece, extraClass) {
    css();
    const white = piece === piece.toUpperCase();
    const kind = piece.toLowerCase();
    return '<svg class="cp ' + (white ? 'w' : 'b') + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 45 45" aria-hidden="true">' + SHAPES[kind] + '</svg>';
  }

  root.ChessPieces = { svg, css };
})(typeof self !== 'undefined' ? self : this);
