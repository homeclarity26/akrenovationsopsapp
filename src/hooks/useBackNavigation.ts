// Safe in-app back navigation.
//
// Problem: a plain `navigate(-1)` goes back in the browser's history stack,
// which — on mobile Safari in particular — can include pages from before the
// user entered the app (e.g., they clicked a magic link email, landed on
// /employee/notes as their very first page, then tapped the in-page Back
// arrow). `navigate(-1)` pops Safari out of the app entirely instead of
// taking them to the parent route inside.
//
// Fix: React Router v6 sets `location.key` to the literal string 'default'
// on the very first render after a fresh page load. Any subsequent in-app
// navigation gives it a non-'default' key (a hash like 'p0m8sjc6'). So
// "is there real app history behind me?" simplifies to "location.key !==
// 'default'". When we have history, pop it; when we don't, navigate to a
// sensible app-owned fallback route.
//
// Usage:
//   const goBack = useBackNavigation('/employee')
//   <button onClick={goBack}>← Back</button>

import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function useBackNavigation(fallback: string): () => void {
  const location = useLocation()
  const navigate = useNavigate()

  return useCallback(() => {
    if (location.key !== 'default') {
      navigate(-1)
    } else {
      navigate(fallback, { replace: true })
    }
  }, [location.key, navigate, fallback])
}
