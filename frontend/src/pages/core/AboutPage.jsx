import { useEffect } from "react";
import HomePage from "./HomePage";

export default function AboutPage() {
  useEffect(() => {
    let frame = 0;
    let attempts = 0;

    const scrollToAbout = () => {
      const target = document.getElementById("about");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (attempts < 10) {
        attempts += 1;
        frame = window.requestAnimationFrame(scrollToAbout);
      }
    };

    scrollToAbout();
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <HomePage />;
}


