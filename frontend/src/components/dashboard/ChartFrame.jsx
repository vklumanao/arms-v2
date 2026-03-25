export default function ChartFrame({ height = 300, children }) {
  return (
    <div style={{ width: "100%", minWidth: 0, height, minHeight: height }}>
      {children}
    </div>
  );
}
