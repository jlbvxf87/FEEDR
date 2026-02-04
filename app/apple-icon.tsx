import { ImageResponse } from "next/og";

// Force Node.js runtime to avoid Edge Runtime __dirname issues
export const runtime = "nodejs";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0B0E11",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "40px",
        }}
      >
        {/* F arrow icon */}
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
          {/* Top wing - teal */}
          <path d="M15 35 L50 20 L85 35 L85 45 L50 60 L15 45 Z" fill="#2EE6C9" />
          {/* Bottom left - blue */}
          <path d="M15 50 L50 65 L50 90 L15 75 Z" fill="#1FB6FF" />
          {/* Bottom right - light blue */}
          <path d="M50 65 L85 50 L85 65 L50 80 Z" fill="#3A9EFF" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
