/**
 * Route wrapper для HelpPage.
 */
import { useNavigate } from "@solidjs/router"
import { HelpPage } from "./help-page"

export default function HelpRoute() {
  const navigate = useNavigate()
  return <HelpPage onClose={() => navigate(-1)} />
}
