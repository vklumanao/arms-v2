import { AboutSection } from "@/pages/core";
import { PublicRecordsPage } from "@/pages/public-records";

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




