export function FaqAnswer({ answer, testId }: { answer: string; testId?: string }) {
  const text = answer.trim()
  const markers = Array.from(text.matchAll(/(?:^|\s)(\d+)[.)]\s+/g))
  const isNumberedList = markers.length > 1
    && markers[0].index === 0
    && markers.every((marker, index) => Number(marker[1]) === index + 1)
  const steps = isNumberedList
    ? markers.map((marker, index) => text.slice(marker.index + marker[0].length, markers[index + 1]?.index).trim())
    : []

  if (steps.length && steps.every(Boolean)) {
    return (
      <ol className="faq-answer__steps" data-testid={testId}>
        {steps.map((step, index) => <li key={index}>{step}</li>)}
      </ol>
    )
  }

  return <p data-testid={testId}>{answer}</p>
}
