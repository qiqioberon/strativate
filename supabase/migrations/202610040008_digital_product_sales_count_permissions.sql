-- Allow authenticated admins to manage the Digital Product sales-count display flag.
-- Row Level Security continues to restrict writes to admin accounts.

grant insert (show_sales_count), update (show_sales_count)
  on public.digital_products to authenticated;
