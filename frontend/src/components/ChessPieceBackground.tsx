import { useEffect, useState, useMemo } from "react";

// Compute squareSize: nearest integer divisor of viewport width close to target
const computeSquareSize = (viewportWidth: number, target = 60): number => {
  const cols = Math.round(viewportWidth / target);
  return viewportWidth / cols;
};

export function ChessPieceBackground() {
  const [squareSize, setSquareSize] = useState<number>(() => {
    const sz = computeSquareSize(window.innerWidth);
    document.documentElement.style.setProperty("--sq", `${sz}px`);
    return sz;
  });

  useEffect(() => {
    let timeoutId: number;

    const handleResize = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const sz = computeSquareSize(window.innerWidth);
        document.documentElement.style.setProperty("--sq", `${sz}px`);
        setSquareSize(sz);
      }, 200);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(timeoutId);
    };
  }, []);

  const piecesData = useMemo(() => {
    const cols = Math.round(window.innerWidth / squareSize); // exact integer
    const rows = Math.ceil(5000 / squareSize);

    // Weighted table: pawns most common, kings & queens rarest
    const weightedLight = [
      "♙", "♙", "♙", "♙", "♙", "♙",  // 6× pawn  (~43%)
      "♘", "♘",                          // 2× knight (~14%)
      "♗", "♗",                          // 2× bishop (~14%)
      "♖", "♖",                          // 2× rook   (~14%)
      "♕",                               // 1× queen  (~7%)
      "♔"                                // 1× king   (~7%)
    ];
    const weightedDark = [
      "♟", "♟", "♟", "♟", "♟", "♟",  // 6× dark pawn
      "♞", "♞",                          // 2× dark knight
      "♝", "♝",                          // 2× dark bishop
      "♜", "♜",                          // 2× dark rook
      "♛",                               // 1× dark queen
      "♚"                                // 1× dark king
    ];

    const list: {
      key: string;
      col: number;
      row: number;
      symbol: string;
      color: string;
      opacity: number;
    }[] = [];

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const hash = (col * 2654435761 + row * 2246822519) >>> 0;
        if (hash % 10 === 0) {
          const isLight = (col + row) % 2 === 0;
          const isDark = (hash >> 12) % 3 === 0; // ~33% dark pieces

          let symbol: string;
          let color: string;
          let opacity: number;

          if (isDark) {
            symbol = weightedDark[(hash >> 4) % weightedDark.length];
            color = "#1a1a1a";
            opacity = isLight ? 0.20 : 0.28;
          } else {
            symbol = weightedLight[(hash >> 4) % weightedLight.length];
            color = "#800020";
            opacity = isLight ? 0.28 : 0.38;
          }

          list.push({ key: `${col}-${row}`, col, row, symbol, color, opacity });
        }
      }
    }

    return list;
  }, [squareSize]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0
      }}
    >
      {piecesData.map((p) => (
        <span
          key={p.key}
          style={{
            position: "absolute",
            left: p.col * squareSize,
            top: p.row * squareSize,
            width: squareSize,
            height: squareSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${squareSize * 0.7}px`,
            color: p.color,
            opacity: p.opacity,
            userSelect: "none",
            pointerEvents: "none"
          }}
        >
          {p.symbol}
        </span>
      ))}
    </div>
  );
}

