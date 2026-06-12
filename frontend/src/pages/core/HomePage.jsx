import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicRecordsPage } from "@/pages/public-records";

export default function HomePage() {
  return (
    <div className="page-stack-xl">
      <section className="scroll-mt-24 sm:scroll-mt-28">
        <PublicRecordsPage />
      </section>
    </div>
  );
}
