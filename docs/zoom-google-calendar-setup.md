# Managed Zoom rooms and Google Calendar

Strativate uses reusable Zoom links entered by Admin. The application does not need Zoom OAuth credentials, call the Zoom API, or receive Zoom webhooks. Google Calendar still handles mentor free/busy and mentoring event creation, updates, and cancellation.

## Configure rooms

1. Open **Admin → Zoom → Add Zoom Link**.
2. Enter a distinct room name and the real HTTPS Zoom meeting URL owned by Strativate. Do not add generated or placeholder URLs.
3. Keep the room Active to make it available for scheduling. Every active room adds capacity for one concurrent mentoring session across Private and Intensive Mentoring.
4. Add or deactivate rooms as operational needs change. A room assigned to an upcoming session must be reassigned before deactivation; referenced rooms cannot be deleted.

Rooms use full interval overlap. A session ending at 20:15 does not conflict with one starting at 20:15. Admin can let the scheduler choose the first available room or select a particular available room. The database verifies the assignment when saving.

## Session links

For a scheduled session, the effective meeting URL is the manual session override when present, otherwise the assigned managed room URL. A manual override keeps its managed room reserved. Admin can clear it with **Kembali ke link Zoom terkelola**.

Changing a room or its reusable URL updates future session links. Strativate reconciles affected Google Calendar events with the effective URL. If Calendar sync fails, retry it from the session detail. Cancellation releases the room and cancels the Calendar event. The Zoom meeting itself is never deleted by Strativate.

Existing scheduled sessions from the retired Zoom API retain their generated URL as a manual link. Admin may assign a managed room when ready; no generated URL is converted into a reusable room automatically.

For Google OAuth setup and scopes, see [Google Calendar setup](google-calendar-setup.md).
