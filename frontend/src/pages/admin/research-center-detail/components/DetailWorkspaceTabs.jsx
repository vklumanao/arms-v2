import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DetailWorkspaceTabs({ activeTab, onTabChange }) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid h-auto w-full grid-cols-2 gap-2 border border-slate-200 bg-white p-1 sm:w-fit sm:grid-cols-none sm:grid-flow-col sm:gap-1">
        <TabsTrigger
          value="projects"
          className="min-h-10 rounded-md data-[state=active]:bg-emerald-50 data-[state=active]:text-[#1E293B]"
        >
          Projects
        </TabsTrigger>
        <TabsTrigger
          value="affiliates"
          className="min-h-10 rounded-md data-[state=active]:bg-emerald-50 data-[state=active]:text-[#1E293B]"
        >
          Affiliates
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
