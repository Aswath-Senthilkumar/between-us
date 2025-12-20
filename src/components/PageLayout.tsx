import React from "react";

type Theme = "white" | "blue" | "pink" | "green";

interface PageLayoutProps {
  children: React.ReactNode;
  theme: Theme;
  className?: string;
}

const themeImages: Record<Theme, string> = {
  white: "/white_paper.png",
  blue: "/blue_paper.png",
  pink: "/pink_paper.png",
  green: "/green_paper.png",
};

export default function PageLayout({
  children,
  theme,
  className = "",
}: PageLayoutProps) {
  React.useEffect(() => {
    // Preload all theme images
    Object.values(themeImages).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  return (
    <div
      className="fixed inset-0 w-full h-[100dvh] bg-cover bg-center transition-all duration-500 overflow-y-auto"
      style={{
        backgroundImage: `url('${themeImages[theme]}')`,
      }}
    >
      <div className={`min-h-full w-full backdrop-blur-[1px] ${className}`}>
        {children}
      </div>
    </div>
  );
}
