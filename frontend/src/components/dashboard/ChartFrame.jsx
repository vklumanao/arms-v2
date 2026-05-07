function toCssSize(value) {
  if (value == null) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

export default function ChartFrame({
  height = "clamp(240px, 52vw, 320px)",
  minHeight,
  className = "",
  style = {},
  children,
}) {
  const cssHeight = toCssSize(height);
  const cssMinHeight = toCssSize(minHeight ?? height);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        minWidth: 0,
        height: cssHeight,
        minHeight: cssMinHeight,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
