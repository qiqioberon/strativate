import Link from 'next/link'

export default function NotFound() {
  return <main className="page-main">
    <div className="page-intro">
      <p className="kicker">404 · Page not found</p>
      <h1>This page <em>isn&apos;t available.</em></h1>
      <p>Check the URL or return to Strativate&apos;s homepage.</p>
    </div>
    <Link href="/" className="button button-primary">Back to Home</Link>
  </main>
}
