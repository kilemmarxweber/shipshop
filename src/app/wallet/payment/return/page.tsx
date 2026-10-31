import { getAppName } from "@/lib/app-name";
import { CinetPayReturnView } from "./return-view";

export default function CinetPayReturnPage() {
  return <CinetPayReturnView appName={getAppName()} />;
}
