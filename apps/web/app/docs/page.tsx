import { redirect } from "next/navigation";

export default function LegacyDocsRedirect() {
  redirect("/settings/advanced/docs");
}
