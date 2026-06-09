/**
 * Route wrapper для SettingsPage.
 */
import { useNavigate } from "@solidjs/router"
import { SettingsPage } from "./settings-page"

export default function SettingsRoute() {
  const navigate = useNavigate()
  return <SettingsPage onClose={() => navigate(-1)} />
}
