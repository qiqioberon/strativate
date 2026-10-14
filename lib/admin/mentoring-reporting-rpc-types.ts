import type { MentoringMentorOption, MentoringReport, MentoringReportFilters } from './mentoring-reporting'

// Include this map in Database.public.Functions so both browser and server clients retain typed contracts.
export type MentoringReportingFunctions = {
  get_admin_mentoring_report: {
    Args: {
      p_from?: string | null; p_to?: string; p_kind?: MentoringReportFilters['kind']; p_mentor?: string
      p_status?: MentoringReportFilters['status']; p_query?: string; p_mentee?: string | null
      p_session_page?: number; p_mentor_page?: number; p_mentee_page?: number; p_review_page?: number
      p_page_size?: number; p_export?: boolean
    }
    Returns: MentoringReport
  }
  search_admin_reporting_mentors: { Args: { p_query?: string; p_limit?: number }; Returns: MentoringMentorOption[] }
}
