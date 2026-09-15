import '../../../../app/globals.css'
import '../../../../app/marketing.css'
import '../../../../app/operations-dashboard.css'
import '../../../../app/admin-layout-fixes.css'
import '../../../../app/admin-mentoring-tables.css'
import '../../../../app/mentor-weekly-controls.css'
import '../../../../app/profile-management.css'
import '../../../../app/calendar-integration.css'

export default function CarouselFixtureLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>
}
