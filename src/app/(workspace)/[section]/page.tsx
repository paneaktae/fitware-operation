import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { report, type ClientReport } from "@/lib/data";
import Workspace from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { section } = await params;
  if (
    ![
      "dashboard",
      "inventory",
      "campaigns",
      "leads",
      "advisor",
      "analytics",
      "settings",
    ].includes(section)
  )
    notFound();
  const data = await report("30d");
  return (
    <Workspace
      initialData={JSON.parse(JSON.stringify(data)) as ClientReport}
      section={section}
      owner={session.user.name}
    />
  );
}
