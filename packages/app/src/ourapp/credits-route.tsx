/**
 * Route wrapper для CreditsPage — навешивает useNavigate и default export
 * чтобы lazy() в app.tsx работал.
 */
import { useNavigate } from "@solidjs/router"
import { CreditsPage } from "./credits-page"

export default function CreditsRoute() {
  const navigate = useNavigate()
  return <CreditsPage onClose={() => navigate(-1)} />
}
