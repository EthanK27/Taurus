import { useState } from 'react'

export function TestButton({ label }) {
  const [clicked, setClicked] = useState(false)

  return (
    <button type="button" onClick={() => setClicked(true)}>
      {clicked ? 'Clicked' : label}
    </button>
  )
}