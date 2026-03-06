import { AboutSection } from "@/features/core/pages/home/sections";
import { PublicRecordsPage } from "@/features/public-records";

export default function HomePage() {
  return (
    <div className="page-stack-xl">
      <section id="home" className="scroll-mt-28">
        <PublicRecordsPage />
      </section>
      <AboutSection />
    </div>
  );
}


