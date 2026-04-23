import { ImageResponse } from "next/og";
import { createElement } from "react";

export const dynamic = "force-static";

const SUPPORTED_SIZES = new Set([180, 192, 512]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: sizeParam } = await params;
  const size = Number.parseInt(sizeParam, 10);

  if (!SUPPORTED_SIZES.has(size)) {
    return new Response("Not found", { status: 404 });
  }

  const fontSize = Math.round(size * 0.28);

  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111111",
          color: "#fafafa",
          fontSize,
          fontWeight: 700,
          letterSpacing: "-0.08em",
        },
      },
      "AG"
    ),
    {
      width: size,
      height: size,
    }
  );
}
