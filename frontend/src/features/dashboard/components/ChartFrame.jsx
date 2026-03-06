import { useEffect, useRef, useState } from "react";
import { ResponsiveContainer } from "recharts";

export default function ChartFrame({ height = 300, children }) {
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const updateReadyState = () => {
      const { width, height: measuredHeight } = node.getBoundingClientRect();
      setIsReady(width > 0 && measuredHeight > 0);
    };

    updateReadyState();

    const rafId = window.requestAnimationFrame(updateReadyState);
    const observer = new ResizeObserver(updateReadyState);
    observer.observe(node);
    window.addEventListener("resize", updateReadyState);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", updateReadyState);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", minWidth: 0, height, minHeight: height }}
    >
      {isReady ? (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={height}
        >
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
